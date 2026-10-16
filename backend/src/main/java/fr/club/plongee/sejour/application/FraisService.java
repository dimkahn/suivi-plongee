package fr.club.plongee.sejour.application;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.materiel.application.PhotoPretService;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.sejour.domaine.FraisSejour;
import fr.club.plongee.sejour.domaine.Participant;
import fr.club.plongee.sejour.domaine.port.FraisSejours;
import fr.club.plongee.sejour.domaine.port.FraisSejours.Saisie;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

        Saisie saisie() {
            return new Saisie(utilisateurId, participantId);
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

    private final FraisSejours frais;
    private final ParticipantsSejour participants;
    private final SortieService sorties;
    private final DroitsSejour droits;

    public FraisService(FraisSejours frais, ParticipantsSejour participants, SortieService sorties,
                        DroitsSejour droits) {
        this.frais = frais;
        this.participants = participants;
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
        Optional<Participant> ligne = participants.participantDuCompte(sortieId, p.id());
        if (ligne.isEmpty()) return new ActeurFrais(p.id(), null, gestionnaire, moniteur, false);
        return new ActeurFrais(p.id(), ligne.get().id(), gestionnaire, moniteur,
                ligne.get().eleveId() != null && !moniteur);
    }

    /** L'acteur entré par le lien et le code : un participant sans compte. */
    @Transactional(readOnly = true)
    public ActeurFrais acteurParticipant(Long participantId) {
        Participant p = participants.participant(participantId)
                .orElseThrow(() -> new RessourceIntrouvableException("Participant introuvable"));
        return new ActeurFrais(null, participantId, false, false, p.eleveId() != null);
    }

    // ------------------------------------------------------------------
    //  Lecture
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public FraisVue lire(Long sortieId, ActeurFrais acteur) {
        List<FraisSejour.Depense> depenses = frais.depenses(sortieId);
        List<FraisSejour.Versement> versements = frais.versements(sortieId);
        DroitsFrais droitsFrais = new DroitsFrais(acteur.participantId(), acteur.peutAjouter(), acteur.pourLesAutres(),
                depenses.stream().filter(d -> auteur(acteur, d.saisieParUtilisateurId(), d.saisieParParticipantId()))
                        .map(FraisSejour.Depense::id).toList(),
                versements.stream().filter(v -> auteur(acteur, v.saisieParUtilisateurId(), v.saisieParParticipantId()))
                        .map(FraisSejour.Versement::id).toList());
        return new FraisVue(depenses, versements,
                FraisSejour.calculer(frais.participants(sortieId), depenses, versements), droitsFrais);
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
        return frais.creerDepense(sortieId, d.libelle(), d.categorie(), d.montantCentimes(), d.payeurId(), d.jour(),
                parts, acteur.saisie());
    }

    @Transactional
    public void modifierDepense(Long sortieId, Long depenseId, DemandeDepense d, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        List<FraisSejour.Part> parts = verifier(sortieId, d, acteur);
        frais.modifierDepense(depenseId, d.libelle(), d.categorie(), d.montantCentimes(), d.payeurId(), d.jour(),
                parts);
    }

    /** Ses photos partent avec elle. */
    @Transactional
    public void supprimerDepense(Long sortieId, Long depenseId, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        frais.supprimerDepense(depenseId);
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
        Saisie saisie = frais.saisieDepense(sortieId, depenseId)
                .orElseThrow(() -> new RessourceIntrouvableException("Dépense introuvable"));
        if (!auteur(acteur, saisie.parUtilisateurId(), saisie.parParticipantId())) {
            throw new RegleMetierException("Seul celui qui a saisi cette dépense, ou l'organisateur, la modifie.");
        }
    }

    private static void verifierMontant(Long centimes) {
        if (centimes == null || centimes <= 0) throw new RegleMetierException("Le montant doit être positif.");
        if (centimes > MONTANT_MAX_CENTIMES) {
            throw new RegleMetierException("Montant trop élevé (plus de 100 000 €) : vérifiez la saisie.");
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
        frais.creerVersement(sortieId, d.deId(), d.aId(), d.montantCentimes(), d.jour(), acteur.saisie());
    }

    @Transactional
    public void supprimerVersement(Long sortieId, Long versementId, ActeurFrais acteur) {
        Saisie saisie = frais.saisieVersement(sortieId, versementId)
                .orElseThrow(() -> new RessourceIntrouvableException("Remboursement introuvable"));
        if (!auteur(acteur, saisie.parUtilisateurId(), saisie.parParticipantId())) {
            throw new RegleMetierException("Seul celui qui a noté ce remboursement, ou l'organisateur, l'annule.");
        }
        frais.supprimerVersement(versementId);
    }

    // ------------------------------------------------------------------
    //  Photos des notes
    // ------------------------------------------------------------------

    @Transactional
    public void ajouterPhoto(Long sortieId, Long depenseId, byte[] contenu, String type, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        PhotoPretService.verifierImage(contenu, type);
        if (frais.photos(depenseId) >= PHOTOS_MAX_PAR_DEPENSE) {
            throw new RegleMetierException("Pas plus de " + PHOTOS_MAX_PAR_DEPENSE + " photos par dépense.");
        }
        frais.ajouterPhoto(depenseId, contenu, type);
    }

    @Transactional
    public void supprimerPhoto(Long sortieId, Long depenseId, Long photoId, ActeurFrais acteur) {
        verifierAuteurDepense(sortieId, depenseId, acteur);
        if (!frais.supprimerPhoto(depenseId, photoId)) {
            throw new RessourceIntrouvableException("Photo introuvable");
        }
    }

    /** Lisible par tous ceux qui lisent les frais du séjour (le contrôleur l'a vérifié). */
    @Transactional(readOnly = true)
    public ContenuPhoto photo(Long sortieId, Long depenseId, Long photoId) {
        return frais.photo(sortieId, depenseId, photoId)
                .map(p -> new ContenuPhoto(p.contenu(), p.type()))
                .orElseThrow(() -> new RessourceIntrouvableException("Photo introuvable"));
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    private void verifierParticipants(Long sortieId, Collection<Long> ids) {
        Set<Long> distincts = new HashSet<>(ids);
        if (participants.compterDuSejour(sortieId, distincts) != distincts.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
    }
}
