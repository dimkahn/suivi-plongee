package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.materiel.service.PretService;
import fr.club.plongee.materiel.service.PretService.DeclarationPret;
import fr.club.plongee.materiel.service.PretService.EquipementPreteVue;
import fr.club.plongee.materiel.service.PretService.PretVue;
import fr.club.plongee.materiel.service.PretService.TypeEmprunteur;
import fr.club.plongee.sejour.FraisService.ActeurFrais;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Le matériel du club emprunté pendant un séjour, déclaré par ceux qui l'ont
 * emprunté, comme les frais (demande du club, 2026). Chaque déclaration est
 * un vrai prêt du matériel ({@link PretService#declarer}), rattaché à la
 * sortie, avec tous ses contrôles ; le directeur technique le retrouve dans
 * ses prêts et en note le retour. Qui a déclaré quoi est gardé dans
 * {@code sejour_pret} (V84).
 * <p>
 * Droits, selon qui agit ({@link ActeurFrais}, comme pour les frais) :
 * <ul>
 *   <li>tout participant déclare ce qu'il a emprunté lui-même, élève
 *   compris (une déclaration n'engage pas d'argent), détendeur compris :
 *   sa désinfection entre au journal légal et s'atteste par un encadrant,
 *   ici au retour, par celui qui reçoit le matériel (demande du club, 2026) ;</li>
 *   <li>les organisateurs et les moniteurs inscrits déclarent pour
 *   n'importe quel participant, et attestent alors la désinfection d'un
 *   détendeur à la déclaration ;</li>
 *   <li>un refus ne nomme pas l'emprunteur d'un équipement déjà prêté ;</li>
 *   <li>chacun annule ce qu'il a déclaré, tant que le matériel n'est pas
 *   rendu ; l'organisateur annule tout ;</li>
 *   <li>un participant ne voit que ses propres emprunts ; les encadrants
 *   voient tous ceux du séjour ;</li>
 *   <li>un participant qui n'a rien emprunté le dit lui-même
 *   ({@code rien_emprunte}, V91) : la carte « Mon séjour » cesse de lui
 *   demander ; déclarer un emprunt retire cette réponse. Ceux qui voient
 *   tous les emprunts voient aussi qui n'a rien emprunté et qui n'a pas
 *   encore répondu, pour relancer.</li>
 * </ul>
 */
@Service
public class PretsSejourService {

    public record DroitsPrets(Long moiId, boolean peutDeclarer, boolean pourLesAutres) {}

    /** {@code participantId} : le participant qui a emprunté, s'il est retrouvé dans le séjour. */
    public record PretSejourVue(Long id, Long participantId, String emprunteur, LocalDate datePret,
                                LocalDate dateRetourPrevue, LocalDate dateRetour, boolean enRetard,
                                boolean annulable, List<EquipementPreteVue> equipements) {}

    public record EmprunteurPossibleVue(Long id, String prenom, String nom) {}

    /**
     * {@code disponibles} : le matériel qui peut être déclaré (vide pour qui
     * ne déclare pas) ; {@code participants} : ceux pour qui l'acteur peut
     * déclarer ; {@code rienEmprunte} : celui qui regarde a dit n'avoir rien
     * emprunté ; {@code rienEmpruntePar}, {@code sansReponse} : les
     * participants sans emprunt qui l'ont dit, ou pas encore (vides pour qui
     * ne voit que ses emprunts).
     */
    public record PretsSejourVue(List<PretSejourVue> prets, List<EquipementPreteVue> disponibles,
                                 List<EmprunteurPossibleVue> participants, DroitsPrets droits,
                                 boolean rienEmprunte, List<EmprunteurPossibleVue> rienEmpruntePar,
                                 List<EmprunteurPossibleVue> sansReponse) {}

    public record DemandeDeclarationPret(@NotNull Long participantId, @NotNull LocalDate datePret,
                                         @NotEmpty List<Long> equipementIds, Boolean detendeursDesinfectes) {}

    public record DemandeRienEmprunte(@NotNull Boolean rienEmprunte) {}

    /** Une ligne de {@code sejour_pret} : quel participant a emprunté, et qui l'a déclaré. */
    record PretDeclare(Long pretId, Long participantId, Long parUtilisateurId, Long parParticipantId) {}

    /** Ce qu'il faut d'un participant pour lui rattacher un prêt. */
    record Inscrit(Long id, Long eleveId, Long utilisateurId, String nom, String prenom, boolean rienEmprunte) {
        String nomComplet() {
            return prenom + " " + nom;
        }
    }

    private final PretService prets;
    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;

    public PretsSejourService(PretService prets, NamedParameterJdbcTemplate jdbc, SortieService sorties) {
        this.prets = prets;
        this.jdbc = jdbc;
        this.sorties = sorties;
    }

    /** {@code encadrant} : un compte d'encadrant, qui lit tous les emprunts du séjour. */
    @Transactional(readOnly = true)
    public PretsSejourVue lire(Long sortieId, ActeurFrais acteur, boolean encadrant) {
        DroitsPrets droits = droits(acteur);
        boolean tout = encadrant || acteur.gestionnaire() || droits.pourLesAutres();
        List<Inscrit> inscrits = inscrits(sortieId).stream()
                .sorted(Comparator.comparing((Inscrit p) -> p.nom().toLowerCase(Locale.ROOT))
                        .thenComparing(p -> p.prenom().toLowerCase(Locale.ROOT)))
                .toList();
        Map<Long, PretDeclare> parPret = declaresDuSejour(sortieId).stream()
                .collect(Collectors.toMap(PretDeclare::pretId, Function.identity()));

        List<PretSejourVue> tous = prets.parSortie(sortieId).stream()
                .map(p -> vue(p, parPret.get(p.id()), inscrits, acteur))
                .toList();
        List<PretSejourVue> liste = tous.stream()
                .filter(p -> tout || (p.participantId() != null && p.participantId().equals(acteur.participantId())))
                .toList();
        Set<Long> ontEmprunte = tous.stream().map(PretSejourVue::participantId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<Inscrit> sansEmprunt = !tout ? List.of()
                : inscrits.stream().filter(p -> !ontEmprunte.contains(p.id())).toList();
        List<EquipementPreteVue> disponibles = !droits.peutDeclarer() ? List.of()
                : prets.disponibles(sorties.sortie(sortieId).getDateFin());
        List<EmprunteurPossibleVue> pourQui = inscrits.stream()
                .filter(p -> droits.pourLesAutres() || (droits.peutDeclarer() && p.id().equals(acteur.participantId())))
                .map(PretsSejourService::possible)
                .toList();
        return new PretsSejourVue(liste, disponibles, pourQui, droits, rienEmprunte(acteur.participantId()),
                sansEmprunt.stream().filter(Inscrit::rienEmprunte).map(PretsSejourService::possible).toList(),
                sansEmprunt.stream().filter(p -> !p.rienEmprunte()).map(PretsSejourService::possible).toList());
    }

    @Transactional
    public void declarer(Long sortieId, DemandeDeclarationPret d, ActeurFrais acteur) {
        DroitsPrets droits = droits(acteur);
        if (!droits.peutDeclarer()) {
            throw new RegleMetierException("Seuls les participants du séjour déclarent le matériel emprunté.");
        }
        if (!droits.pourLesAutres() && !d.participantId().equals(acteur.participantId())) {
            throw new RegleMetierException("Vous ne déclarez que le matériel que vous avez emprunté vous-même ; "
                    + "pour un autre, passez par un moniteur du séjour.");
        }
        Inscrit emprunteur = inscrits(sortieId).stream().filter(p -> p.id().equals(d.participantId())).findFirst()
                .orElseThrow(() -> new RessourceIntrouvableException("Participant introuvable dans ce séjour"));
        // La désinfection d'un détendeur entre à son journal légal et s'atteste par un encadrant identifié :
        // à la déclaration s'il déclare, sinon au retour, par celui qui reçoit le matériel.
        boolean parUnEncadrant = droits.pourLesAutres();
        PretVue pret = prets.declarer(new DeclarationPret(emprunteur.eleveId(), emprunteur.utilisateurId(),
                emprunteur.nomComplet(), sortieId, d.datePret(), d.equipementIds(),
                parUnEncadrant ? d.detendeursDesinfectes() : null, !parUnEncadrant,
                nomDe(sortieId, acteur), acteur.utilisateurId()));
        noter(new PretDeclare(pret.id(), emprunteur.id(), acteur.utilisateurId(), acteur.participantId()));
        repondre(emprunteur.id(), false);
    }

    /** Le participant qui agit dit lui-même n'avoir rien emprunté (ou revient sur sa réponse). */
    @Transactional
    public void rienEmprunte(Long sortieId, boolean rien, ActeurFrais acteur) {
        if (acteur.participantId() == null) {
            throw new RegleMetierException("Seuls les participants du séjour disent s'ils ont emprunté du matériel.");
        }
        boolean aDesEmprunts = declaresDuSejour(sortieId).stream()
                .anyMatch(d -> acteur.participantId().equals(d.participantId()));
        if (rien && aDesEmprunts) {
            throw new RegleMetierException("Vous avez déclaré du matériel pour ce séjour : "
                    + "annulez d'abord la déclaration faite par erreur.");
        }
        repondre(acteur.participantId(), rien);
    }

    @Transactional
    public void annuler(Long sortieId, Long pretId, ActeurFrais acteur) {
        PretVue pret = prets.parSortie(sortieId).stream().filter(p -> p.id().equals(pretId)).findFirst()
                .orElseThrow(() -> new RessourceIntrouvableException("Prêt introuvable dans ce séjour"));
        PretDeclare declaration = declaresDuSejour(sortieId).stream().filter(x -> x.pretId().equals(pretId))
                .findFirst().orElse(null);
        if (!annulable(pret, declaration, acteur)) {
            throw new RegleMetierException("Seul celui qui a déclaré ce prêt, ou l'organisateur, l'annule.");
        }
        prets.annuler(pretId);
    }

    // ------------------------------------------------------------------

    private static DroitsPrets droits(ActeurFrais a) {
        return new DroitsPrets(a.participantId(), a.gestionnaire() || a.participantId() != null, a.pourLesAutres());
    }

    private static EmprunteurPossibleVue possible(Inscrit p) {
        return new EmprunteurPossibleVue(p.id(), p.prenom(), p.nom());
    }

    /** Déclaré depuis le séjour, encore en cours, par celui qui agit (ou l'organisateur). */
    private static boolean annulable(PretVue p, PretDeclare d, ActeurFrais a) {
        if (d == null || p.dateRetour() != null) return false;
        if (a.gestionnaire()) return true;
        return (a.utilisateurId() != null && a.utilisateurId().equals(d.parUtilisateurId()))
                || (a.participantId() != null && a.participantId().equals(d.parParticipantId()));
    }

    private static PretSejourVue vue(PretVue p, PretDeclare d, List<Inscrit> inscrits, ActeurFrais acteur) {
        Long participant = d != null ? d.participantId() : inscrits.stream()
                .filter(x -> (p.emprunteurType() == TypeEmprunteur.ELEVE && p.emprunteurId().equals(x.eleveId()))
                        || (p.emprunteurType() == TypeEmprunteur.ENCADRANT && p.emprunteurId().equals(x.utilisateurId())))
                .map(Inscrit::id).findFirst().orElse(null);
        return new PretSejourVue(p.id(), participant, p.emprunteur(), p.datePret(), p.dateRetourPrevue(),
                p.dateRetour(), p.enRetard(), annulable(p, d, acteur), p.equipements());
    }

    /** « Prénom Nom » de celui qui déclare : sa ligne de participant, sinon son compte (l'organisateur). */
    private String nomDe(Long sortieId, ActeurFrais a) {
        if (a.participantId() != null) {
            return inscrits(sortieId).stream().filter(p -> p.id().equals(a.participantId()))
                    .map(Inscrit::nomComplet).findFirst().orElse("un participant");
        }
        return jdbc.query("SELECT prenom || ' ' || nom FROM utilisateur WHERE id = :id",
                        new MapSqlParameterSource("id", a.utilisateurId()), (rs, i) -> rs.getString(1))
                .stream().findFirst().orElse("un organisateur");
    }

    private boolean rienEmprunte(Long participantId) {
        return participantId != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT rien_emprunte FROM sejour_participant WHERE id = :id",
                new MapSqlParameterSource("id", participantId), Boolean.class));
    }

    private void repondre(Long participantId, boolean rien) {
        jdbc.update("UPDATE sejour_participant SET rien_emprunte = :rien WHERE id = :id",
                new MapSqlParameterSource("rien", rien).addValue("id", participantId));
    }

    private List<Inscrit> inscrits(Long sortieId) {
        return jdbc.query("""
                SELECT id, eleve_id, utilisateur_id, nom, prenom, rien_emprunte FROM sejour_participant
                 WHERE sortie_id = :sortie""", new MapSqlParameterSource("sortie", sortieId),
                (rs, i) -> inscrit(rs));
    }

    private static Inscrit inscrit(ResultSet rs) throws SQLException {
        return new Inscrit(rs.getLong("id"), rs.getObject("eleve_id", Long.class),
                rs.getObject("utilisateur_id", Long.class), rs.getString("nom"), rs.getString("prenom"),
                rs.getBoolean("rien_emprunte"));
    }

    /** Ceux des prêts de la sortie qui ont été déclarés depuis son séjour. */
    private List<PretDeclare> declaresDuSejour(Long sortieId) {
        return jdbc.query("""
                SELECT sp.pret_id, sp.participant_id, sp.declare_par_utilisateur_id, sp.declare_par_participant_id
                  FROM sejour_pret sp JOIN pret p ON p.id = sp.pret_id
                 WHERE p.sortie_id = :sortie""", new MapSqlParameterSource("sortie", sortieId),
                (rs, i) -> new PretDeclare(rs.getLong(1), rs.getObject(2, Long.class), rs.getObject(3, Long.class),
                        rs.getObject(4, Long.class)));
    }

    private void noter(PretDeclare d) {
        jdbc.update("""
                INSERT INTO sejour_pret (pret_id, participant_id, declare_par_utilisateur_id, declare_par_participant_id)
                VALUES (:pret, :participant, :parUtilisateur, :parParticipant)""",
                new MapSqlParameterSource("pret", d.pretId()).addValue("participant", d.participantId())
                        .addValue("parUtilisateur", d.parUtilisateurId())
                        .addValue("parParticipant", d.parParticipantId()));
    }
}
