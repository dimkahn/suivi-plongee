package fr.club.plongee.sejour.application;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.materiel.application.PretService;
import fr.club.plongee.materiel.application.PretService.DeclarationPret;
import fr.club.plongee.materiel.application.PretService.EquipementPreteVue;
import fr.club.plongee.materiel.application.PretService.PretVue;
import fr.club.plongee.materiel.application.PretService.TypeEmprunteur;
import fr.club.plongee.materiel.domaine.TypeEquipement;
import fr.club.plongee.sejour.application.FraisService.ActeurFrais;
import fr.club.plongee.sejour.domaine.Organisateur;
import fr.club.plongee.sejour.domaine.Participant;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour;
import fr.club.plongee.sejour.domaine.port.PretsDeclares;
import fr.club.plongee.sejour.domaine.port.PretsDeclares.PretDeclare;
import fr.club.plongee.sejour.domaine.port.Sejours;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Le matériel du club emprunté pendant un séjour, déclaré par ceux qui l'ont
 * emprunté, comme les frais (demande du club, 2026). Chaque déclaration est
 * un vrai prêt du matériel ({@link PretService#declarer}), rattaché à la
 * sortie, avec tous ses contrôles ; le directeur technique le retrouve dans
 * ses prêts et en note le retour.
 * <p>
 * Droits, selon qui agit ({@link ActeurFrais}, comme pour les frais) :
 * <ul>
 *   <li>tout participant déclare ce qu'il a emprunté lui-même, élève
 *   compris (une déclaration n'engage pas d'argent), sauf un détendeur :
 *   sa désinfection entre au journal légal et s'atteste par un encadrant ;</li>
 *   <li>les organisateurs et les moniteurs inscrits déclarent pour
 *   n'importe quel participant, détendeurs compris ;</li>
 *   <li>un refus ne nomme pas l'emprunteur d'un équipement déjà prêté ;</li>
 *   <li>chacun annule ce qu'il a déclaré, tant que le matériel n'est pas
 *   rendu ; l'organisateur annule tout ;</li>
 *   <li>un participant ne voit que ses propres emprunts ; les encadrants
 *   voient tous ceux du séjour.</li>
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
     * déclarer.
     */
    public record PretsSejourVue(List<PretSejourVue> prets, List<EquipementPreteVue> disponibles,
                                 List<EmprunteurPossibleVue> participants, DroitsPrets droits) {}

    public record DemandeDeclarationPret(@NotNull Long participantId, @NotNull LocalDate datePret,
                                         @NotEmpty List<Long> equipementIds, Boolean detendeursDesinfectes) {}

    private final PretService prets;
    private final PretsDeclares declares;
    private final ParticipantsSejour participants;
    private final Sejours sejours;
    private final SortieService sorties;

    public PretsSejourService(PretService prets, PretsDeclares declares, ParticipantsSejour participants,
                              Sejours sejours, SortieService sorties) {
        this.prets = prets;
        this.declares = declares;
        this.participants = participants;
        this.sejours = sejours;
        this.sorties = sorties;
    }

    /** {@code encadrant} : un compte d'encadrant, qui lit tous les emprunts du séjour. */
    @Transactional(readOnly = true)
    public PretsSejourVue lire(Long sortieId, ActeurFrais acteur, boolean encadrant) {
        DroitsPrets droits = droits(acteur);
        boolean tout = encadrant || acteur.gestionnaire() || droits.pourLesAutres();
        List<Participant> inscrits = participants.participants(sortieId).stream()
                .sorted(Comparator.comparing((Participant p) -> p.nom().toLowerCase(Locale.ROOT))
                        .thenComparing(p -> p.prenom().toLowerCase(Locale.ROOT)))
                .toList();
        Map<Long, PretDeclare> parPret = declares.duSejour(sortieId).stream()
                .collect(Collectors.toMap(PretDeclare::pretId, Function.identity()));

        List<PretSejourVue> liste = prets.parSortie(sortieId).stream()
                .map(p -> vue(p, parPret.get(p.id()), inscrits, acteur))
                .filter(p -> tout || (p.participantId() != null && p.participantId().equals(acteur.participantId())))
                .toList();
        List<EquipementPreteVue> disponibles = !droits.peutDeclarer() ? List.of()
                : prets.disponibles(sorties.sortie(sortieId).getDateFin()).stream()
                        .filter(e -> droits.pourLesAutres() || e.type() != TypeEquipement.DETENDEUR)
                        .toList();
        List<EmprunteurPossibleVue> pourQui = inscrits.stream()
                .filter(p -> droits.pourLesAutres() || (droits.peutDeclarer() && p.id().equals(acteur.participantId())))
                .map(p -> new EmprunteurPossibleVue(p.id(), p.prenom(), p.nom()))
                .toList();
        return new PretsSejourVue(liste, disponibles, pourQui, droits);
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
        // La désinfection entre au journal légal du détendeur : elle s'atteste par un encadrant identifié.
        if (!droits.pourLesAutres() && prets.contientUnDetendeur(d.equipementIds())) {
            throw new RegleMetierException("Un détendeur se déclare par l'organisateur ou un moniteur du séjour : "
                    + "c'est lui qui atteste sa désinfection.");
        }
        Participant emprunteur = participants.participant(d.participantId())
                .filter(p -> participants.compterDuSejour(sortieId, List.of(p.id())) == 1)
                .orElseThrow(() -> new RessourceIntrouvableException("Participant introuvable dans ce séjour"));
        PretVue pret = prets.declarer(new DeclarationPret(emprunteur.eleveId(), emprunteur.utilisateurId(),
                emprunteur.nomComplet(), sortieId, d.datePret(), d.equipementIds(), d.detendeursDesinfectes(),
                nomDe(sortieId, acteur), acteur.utilisateurId()));
        declares.noter(new PretDeclare(pret.id(), emprunteur.id(), acteur.utilisateurId(), acteur.participantId()));
    }

    @Transactional
    public void annuler(Long sortieId, Long pretId, ActeurFrais acteur) {
        PretVue pret = prets.parSortie(sortieId).stream().filter(p -> p.id().equals(pretId)).findFirst()
                .orElseThrow(() -> new RessourceIntrouvableException("Prêt introuvable dans ce séjour"));
        PretDeclare declaration = declares.duSejour(sortieId).stream().filter(x -> x.pretId().equals(pretId))
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

    /** Déclaré depuis le séjour, encore en cours, par celui qui agit (ou l'organisateur). */
    private static boolean annulable(PretVue p, PretDeclare d, ActeurFrais a) {
        if (d == null || p.dateRetour() != null) return false;
        if (a.gestionnaire()) return true;
        return (a.utilisateurId() != null && a.utilisateurId().equals(d.parUtilisateurId()))
                || (a.participantId() != null && a.participantId().equals(d.parParticipantId()));
    }

    private static PretSejourVue vue(PretVue p, PretDeclare d, List<Participant> inscrits, ActeurFrais acteur) {
        Long participant = d != null ? d.participantId() : inscrits.stream()
                .filter(x -> (p.emprunteurType() == TypeEmprunteur.ELEVE && p.emprunteurId().equals(x.eleveId()))
                        || (p.emprunteurType() == TypeEmprunteur.ENCADRANT && p.emprunteurId().equals(x.utilisateurId())))
                .map(Participant::id).findFirst().orElse(null);
        return new PretSejourVue(p.id(), participant, p.emprunteur(), p.datePret(), p.dateRetourPrevue(),
                p.dateRetour(), p.enRetard(), annulable(p, d, acteur), p.equipements());
    }

    /** « Prénom Nom » de celui qui déclare : sa ligne de participant, sinon l'organisateur. */
    private String nomDe(Long sortieId, ActeurFrais a) {
        if (a.participantId() != null) {
            return participants.participant(a.participantId()).map(Participant::nomComplet).orElse("un participant");
        }
        return sejours.organisateurs(sortieId).stream().filter(o -> o.id().equals(a.utilisateurId()))
                .map(Organisateur::nomComplet).findFirst().orElse("un organisateur");
    }
}
