package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.materiel.service.PhotoPretService;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * Les frais d'un séjour (V76, V77) : lecture, dépenses, remboursements et
 * photos des notes, selon qui agit ({@link ActeurFrais}).
 * <p>
 * Droits (choix du club, 2026) :
 * <ul>
 *   <li>les organisateurs (le créateur du séjour et ceux qu'il a désignés,
 *   {@link DroitsSejour}) font tout ;</li>
 *   <li>un moniteur inscrit au séjour saisit toute dépense, quel qu'en soit
 *   le payeur : c'est par lui que passent les élèves ;</li>
 *   <li>un autre participant (invité entré par le lien et le code, compte
 *   sans rôle d'élève) saisit les dépenses qu'il a payées lui-même ;</li>
 *   <li>un élève consulte seulement ;</li>
 *   <li>chacun modifie, supprime et complète de photos ce qu'il a saisi ;
 *   un remboursement reçu se note par celui qui le reçoit.</li>
 * </ul>
 */
@Service
public class FraisService {

    /** Au-delà, plus probablement une faute de frappe (centimes saisis comme des euros). */
    static final long MONTANT_MAX_CENTIMES = 10_000_000L;
    static final int PHOTOS_MAX_PAR_DEPENSE = 6;

    /**
     * Qui agit sur les frais. {@code participantId} : sa ligne parmi les
     * participants (null pour un encadrant ou un organisateur qui n'en est
     * pas) ; {@code eleve} : ce participant est un élève sans compte de
     * moniteur, qui passe par un moniteur pour saisir.
     */
    public record ActeurFrais(Long utilisateurId, Long participantId, boolean gestionnaire, boolean moniteur,
                              boolean eleve) {
        /** Lecture seule, sans être participant (encadrant, envoi du carnet). */
        public static final ActeurFrais LECTURE = new ActeurFrais(null, null, false, false, false);

        boolean peutAjouter() {
            return gestionnaire || (participantId != null && !eleve);
        }

        /** Saisir pour un autre payeur, noter tout remboursement : l'organisateur et les moniteurs du séjour. */
        boolean pourLesAutres() {
            return gestionnaire || (moniteur && participantId != null);
        }
    }

    /** Ce que l'acteur peut faire, pour que l'écran ne propose que le possible (le serveur revérifie). */
    public record DroitsFrais(Long moiId, boolean peutAjouter, boolean pourLesAutres,
                              List<Long> depensesModifiables, List<Long> versementsSupprimables) {}

    public record FraisVue(List<FraisSejour.Depense> depenses, List<FraisSejour.Versement> versements,
                           FraisSejour.Comptes comptes, DroitsFrais droits) {}

    /** {@code parts} : les participants qui partagent la dépense, chacun avec son poids. */
    public record DemandeDepense(@NotBlank @Size(max = 160) String libelle,
                                 @NotNull FraisSejour.CategorieDepense categorie,
                                 @NotNull Long montantCentimes, @NotNull Long payeurId, LocalDate jour,
                                 List<FraisSejour.Part> parts) {}

    public record DemandeVersement(@NotNull Long deId, @NotNull Long aId, @NotNull Long montantCentimes,
                                   LocalDate jour) {}

    public record ContenuPhoto(byte[] contenu, String type) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;
    private final DroitsSejour droits;

    public FraisService(NamedParameterJdbcTemplate jdbc, SortieService sorties, DroitsSejour droits) {
        this.jdbc = jdbc;
        this.sorties = sorties;
        this.droits = droits;
    }

    // ------------------------------------------------------------------
    //  Qui agit
    // ------------------------------------------------------------------

    /** L'acteur d'un compte connecté : sa ligne de participant s'il en a une (compte ou dossier élève). */
    @Transactional(readOnly = true)
    public ActeurFrais acteur(Long sortieId, UtilisateurPrincipal p) {
        boolean gestionnaire = droits.organise(sortieId, p.id());
        boolean moniteur = p.getAuthorities().stream().anyMatch(a -> "ROLE_MONITEUR".equals(a.getAuthority()));
        List<Map<String, Object>> lignes = jdbc.queryForList("""
                SELECT p.id, p.eleve_id FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie AND (p.utilisateur_id = :moi OR e.utilisateur_id = :moi)
                 ORDER BY p.id""", new MapSqlParameterSource("sortie", sortieId).addValue("moi", p.id()));
        if (lignes.isEmpty()) return new ActeurFrais(p.id(), null, gestionnaire, moniteur, false);
        Map<String, Object> ligne = lignes.getFirst();
        Long participant = ((Number) ligne.get("id")).longValue();
        return new ActeurFrais(p.id(), participant, gestionnaire, moniteur, ligne.get("eleve_id") != null && !moniteur);
    }

    /** L'acteur entré par le lien et le code : un participant sans compte. */
    @Transactional(readOnly = true)
    public ActeurFrais acteurParticipant(Long participantId) {
        Map<String, Object> ligne = jdbc.queryForMap("SELECT eleve_id FROM sejour_participant WHERE id = :p",
                new MapSqlParameterSource("p", participantId));
        return new ActeurFrais(null, participantId, false, false, ligne.get("eleve_id") != null);
    }

    // ------------------------------------------------------------------
    //  Lecture
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public FraisVue lire(Long sortieId, ActeurFrais acteur) {
        var id = new MapSqlParameterSource("id", sortieId);
        List<Long> participants = jdbc.queryForList(
                "SELECT id FROM sejour_participant WHERE sortie_id = :id ORDER BY LOWER(nom), LOWER(prenom)",
                id, Long.class);
        Map<Long, List<FraisSejour.Part>> parts = new HashMap<>();
        jdbc.query("""
                SELECT dp.depense_id, dp.participant_id, dp.parts FROM sejour_depense_part dp
                  JOIN sejour_depense d ON d.id = dp.depense_id
                  JOIN sejour_participant p ON p.id = dp.participant_id
                 WHERE d.sortie_id = :id ORDER BY p.nom, p.prenom""", id,
                rs -> { parts.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                        .add(new FraisSejour.Part(rs.getLong(2), rs.getInt(3))); });
        Map<Long, List<Long>> photos = new HashMap<>();
        jdbc.query("""
                SELECT ph.depense_id, ph.id FROM sejour_depense_photo ph
                  JOIN sejour_depense d ON d.id = ph.depense_id
                 WHERE d.sortie_id = :id ORDER BY ph.id""", id,
                rs -> { photos.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        List<FraisSejour.Depense> depenses = jdbc.query("""
                SELECT * FROM sejour_depense WHERE sortie_id = :id ORDER BY jour, id""", id,
                (rs, i) -> new FraisSejour.Depense(rs.getLong("id"), rs.getString("libelle"),
                        FraisSejour.CategorieDepense.valueOf(rs.getString("categorie")),
                        rs.getLong("montant_centimes"), rs.getLong("payeur_id"),
                        rs.getObject("jour", LocalDate.class), parts.getOrDefault(rs.getLong("id"), List.of()),
                        photos.getOrDefault(rs.getLong("id"), List.of()),
                        rs.getObject("saisie_par_utilisateur_id", Long.class),
                        rs.getObject("saisie_par_participant_id", Long.class)));
        List<FraisSejour.Versement> versements = jdbc.query("""
                SELECT * FROM sejour_versement WHERE sortie_id = :id ORDER BY jour, id""", id,
                (rs, i) -> new FraisSejour.Versement(rs.getLong("id"), rs.getLong("de_id"), rs.getLong("a_id"),
                        rs.getLong("montant_centimes"), rs.getObject("jour", LocalDate.class),
                        rs.getObject("saisie_par_utilisateur_id", Long.class),
                        rs.getObject("saisie_par_participant_id", Long.class)));
        DroitsFrais droits = new DroitsFrais(acteur.participantId(), acteur.peutAjouter(), acteur.pourLesAutres(),
                depenses.stream().filter(d -> auteur(acteur, d.saisieParUtilisateurId(), d.saisieParParticipantId()))
                        .map(FraisSejour.Depense::id).toList(),
                versements.stream().filter(v -> auteur(acteur, v.saisieParUtilisateurId(), v.saisieParParticipantId()))
                        .map(FraisSejour.Versement::id).toList());
        return new FraisVue(depenses, versements, FraisSejour.calculer(participants, depenses, versements), droits);
    }

    /** L'organisateur, ou celui qui a saisi la ligne (élève exclu : il ne saisit rien). */
    private static boolean auteur(ActeurFrais a, Long parUtilisateur, Long parParticipant) {
        if (a.gestionnaire()) return true;
        if (a.eleve()) return false;
        return (a.utilisateurId() != null && a.utilisateurId().equals(parUtilisateur))
                || (a.participantId() != null && a.participantId().equals(parParticipant));
    }

    // ------------------------------------------------------------------
    //  Dépenses
    // ------------------------------------------------------------------

    /** Renvoie l'id de la dépense créée, pour y joindre ensuite la photo de la note. */
    @Transactional
    public long creerDepense(Long sortieId, DemandeDepense d, ActeurFrais acteur) {
        sorties.sortie(sortieId);
        if (!acteur.peutAjouter()) {
            throw new RegleMetierException(acteur.eleve()
                    ? "Les élèves passent par un moniteur du séjour pour saisir leurs frais."
                    : "Seuls les participants du séjour saisissent des frais.");
        }
        List<FraisSejour.Part> parts = verifier(sortieId, d, acteur);
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour,
                       saisie_par_utilisateur_id, saisie_par_participant_id)
                VALUES (:sortie, :libelle, :categorie, :montant, :payeur, :jour, :parUtilisateur, :parParticipant)""",
                parametres(sortieId, d).addValue("parUtilisateur", acteur.utilisateurId())
                        .addValue("parParticipant", acteur.participantId()), cle, new String[]{"id"});
        long id = cle.getKey().longValue();
        ecrireParts(id, parts);
        return id;
    }

    @Transactional
    public void modifierDepense(Long sortieId, Long depenseId, DemandeDepense d, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        List<FraisSejour.Part> parts = verifier(sortieId, d, acteur);
        jdbc.update("""
                UPDATE sejour_depense SET libelle = :libelle, categorie = :categorie, montant_centimes = :montant,
                       payeur_id = :payeur, jour = :jour WHERE id = :depense""",
                parametres(sortieId, d).addValue("depense", depenseId));
        jdbc.update("DELETE FROM sejour_depense_part WHERE depense_id = :d", new MapSqlParameterSource("d", depenseId));
        ecrireParts(depenseId, parts);
    }

    /** Ses photos partent avec elle. */
    @Transactional
    public void supprimerDepense(Long sortieId, Long depenseId, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        jdbc.update("DELETE FROM sejour_depense WHERE id = :d", new MapSqlParameterSource("d", depenseId));
    }

    /** Les parts retenues : une par participant, au moins une. Payé par soi-même, sauf organisateur ou moniteur. */
    private List<FraisSejour.Part> verifier(Long sortieId, DemandeDepense d, ActeurFrais acteur) {
        verifierMontant(d.montantCentimes());
        if (!acteur.pourLesAutres() && !d.payeurId().equals(acteur.participantId())) {
            throw new RegleMetierException("Vous ne pouvez saisir que les dépenses que vous avez payées vous-même ; "
                    + "pour un autre, passez par un moniteur du séjour.");
        }
        Map<Long, FraisSejour.Part> parts = new LinkedHashMap<>();
        for (FraisSejour.Part p : d.parts() == null ? List.<FraisSejour.Part>of() : d.parts()) {
            if (p == null || p.participantId() == null) continue;
            if (p.parts() < 1 || p.parts() > 20) {
                throw new RegleMetierException("Le nombre de parts d'un participant va de 1 à 20.");
            }
            parts.put(p.participantId(), p);
        }
        if (parts.isEmpty()) {
            throw new RegleMetierException("Cochez au moins un participant qui partage cette dépense.");
        }
        List<Long> tous = new ArrayList<>(parts.keySet());
        tous.add(d.payeurId());
        verifierParticipants(sortieId, tous);
        return new ArrayList<>(parts.values());
    }

    private void verifierAuteurDepense(Long sortieId, Long depenseId, ActeurFrais acteur) {
        List<Map<String, Object>> lignes = jdbc.queryForList("""
                SELECT saisie_par_utilisateur_id AS u, saisie_par_participant_id AS p
                  FROM sejour_depense WHERE id = :d AND sortie_id = :sortie""",
                new MapSqlParameterSource("d", depenseId).addValue("sortie", sortieId));
        if (lignes.isEmpty()) throw new RessourceIntrouvableException("Dépense introuvable");
        if (!auteur(acteur, enLong(lignes.getFirst().get("u")), enLong(lignes.getFirst().get("p")))) {
            throw new RegleMetierException("Seul celui qui a saisi cette dépense, ou l'organisateur, la modifie.");
        }
    }

    private static void verifierMontant(Long centimes) {
        if (centimes == null || centimes <= 0) throw new RegleMetierException("Le montant doit être positif.");
        if (centimes > MONTANT_MAX_CENTIMES) {
            throw new RegleMetierException("Montant trop élevé (plus de 100 000 €) : vérifiez la saisie.");
        }
    }

    private static MapSqlParameterSource parametres(Long sortieId, DemandeDepense d) {
        return new MapSqlParameterSource("sortie", sortieId).addValue("libelle", d.libelle().trim())
                .addValue("categorie", d.categorie().name()).addValue("montant", d.montantCentimes())
                .addValue("payeur", d.payeurId()).addValue("jour", d.jour());
    }

    private void ecrireParts(Long depenseId, List<FraisSejour.Part> parts) {
        for (FraisSejour.Part p : parts) {
            jdbc.update("INSERT INTO sejour_depense_part (depense_id, participant_id, parts) VALUES (:d, :p, :n)",
                    new MapSqlParameterSource("d", depenseId).addValue("p", p.participantId()).addValue("n", p.parts()));
        }
    }

    // ------------------------------------------------------------------
    //  Remboursements
    // ------------------------------------------------------------------

    @Transactional
    public void creerVersement(Long sortieId, DemandeVersement d, ActeurFrais acteur) {
        sorties.sortie(sortieId);
        boolean recu = acteur.peutAjouter() && d.aId().equals(acteur.participantId());
        if (!acteur.pourLesAutres() && !recu) {
            throw new RegleMetierException("Un remboursement se note par celui qui l'a reçu, ou par un moniteur du séjour.");
        }
        verifierMontant(d.montantCentimes());
        if (d.deId().equals(d.aId())) {
            throw new RegleMetierException("Un remboursement va d'un participant à un autre.");
        }
        verifierParticipants(sortieId, List.of(d.deId(), d.aId()));
        jdbc.update("""
                INSERT INTO sejour_versement (sortie_id, de_id, a_id, montant_centimes, jour,
                       saisie_par_utilisateur_id, saisie_par_participant_id)
                VALUES (:sortie, :de, :a, :montant, :jour, :parUtilisateur, :parParticipant)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("de", d.deId()).addValue("a", d.aId())
                        .addValue("montant", d.montantCentimes()).addValue("jour", d.jour())
                        .addValue("parUtilisateur", acteur.utilisateurId())
                        .addValue("parParticipant", acteur.participantId()));
    }

    @Transactional
    public void supprimerVersement(Long sortieId, Long versementId, ActeurFrais acteur) {
        List<Map<String, Object>> lignes = jdbc.queryForList("""
                SELECT saisie_par_utilisateur_id AS u, saisie_par_participant_id AS p
                  FROM sejour_versement WHERE id = :v AND sortie_id = :sortie""",
                new MapSqlParameterSource("v", versementId).addValue("sortie", sortieId));
        if (lignes.isEmpty()) throw new RessourceIntrouvableException("Remboursement introuvable");
        if (!auteur(acteur, enLong(lignes.getFirst().get("u")), enLong(lignes.getFirst().get("p")))) {
            throw new RegleMetierException("Seul celui qui a noté ce remboursement, ou l'organisateur, l'annule.");
        }
        jdbc.update("DELETE FROM sejour_versement WHERE id = :v", new MapSqlParameterSource("v", versementId));
    }

    // ------------------------------------------------------------------
    //  Photos des notes
    // ------------------------------------------------------------------

    @Transactional
    public void ajouterPhoto(Long sortieId, Long depenseId, byte[] contenu, String type, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        PhotoPretService.verifierImage(contenu, type);
        var d = new MapSqlParameterSource("d", depenseId);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM sejour_depense_photo WHERE depense_id = :d", d, Integer.class)
                >= PHOTOS_MAX_PAR_DEPENSE) {
            throw new RegleMetierException("Pas plus de " + PHOTOS_MAX_PAR_DEPENSE + " photos par dépense.");
        }
        jdbc.update("INSERT INTO sejour_depense_photo (depense_id, contenu, type_contenu) VALUES (:d, :contenu, :type)",
                d.addValue("contenu", contenu).addValue("type", type));
    }

    @Transactional
    public void supprimerPhoto(Long sortieId, Long depenseId, Long photoId, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        if (jdbc.update("DELETE FROM sejour_depense_photo WHERE id = :p AND depense_id = :d",
                new MapSqlParameterSource("p", photoId).addValue("d", depenseId)) == 0) {
            throw new RessourceIntrouvableException("Photo introuvable");
        }
    }

    /** Lisible par tous ceux qui lisent les frais du séjour (le contrôleur l'a vérifié). */
    @Transactional(readOnly = true)
    public ContenuPhoto photo(Long sortieId, Long depenseId, Long photoId) {
        List<ContenuPhoto> photos = jdbc.query("""
                SELECT ph.contenu, ph.type_contenu FROM sejour_depense_photo ph
                  JOIN sejour_depense d ON d.id = ph.depense_id
                 WHERE ph.id = :p AND d.id = :d AND d.sortie_id = :sortie""",
                new MapSqlParameterSource("p", photoId).addValue("d", depenseId).addValue("sortie", sortieId),
                (rs, i) -> new ContenuPhoto(rs.getBytes(1), rs.getString(2)));
        if (photos.isEmpty()) throw new RessourceIntrouvableException("Photo introuvable");
        return photos.getFirst();
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    private void verifierParticipants(Long sortieId, Collection<Long> ids) {
        Set<Long> distincts = new HashSet<>(ids);
        Integer trouves = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE sortie_id = :sortie AND id IN (:ids)",
                new MapSqlParameterSource("sortie", sortieId).addValue("ids", distincts), Integer.class);
        if (trouves == null || trouves != distincts.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
    }

    private static Long enLong(Object valeur) {
        return valeur == null ? null : ((Number) valeur).longValue();
    }
}
