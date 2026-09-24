package fr.club.plongee.evaluation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.domain.StatutAcquisition;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.evaluation.service.EvaluationService;
import fr.club.plongee.evaluation.service.GrilleService;
import fr.club.plongee.evaluation.service.HabilitationService;
import fr.club.plongee.formation.*;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.referentiel.ReferentielController;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Point d'entree de la synchronisation differee.
 *
 * Un moniteur saisit au bord du bassin, souvent sans reseau exploitable. Les
 * saisies sont mises en file cote navigateur puis rejouees ici. Deux exigences
 * en decoulent :
 *
 *  - chaque saisie est idempotente, via la reference generee par le client ;
 *  - une saisie refusee ne doit pas bloquer les suivantes, donc chaque element
 *    du lot est traite dans sa propre transaction et repond individuellement.
 */
@RestController
@RequestMapping("/api/synchronisation")
public class SynchronisationController {

    public enum Etat { ACCEPTEE, DEJA_ENREGISTREE, REFUSEE }

    public record SaisieDifferee(@NotNull String referenceClient, @NotNull Long cursusId,
                                 @NotNull Long critereId, Long seanceId,
                                 @NotNull StatutAcquisition statut, String commentaire,
                                 @NotNull LocalDate dateEvaluation) {}

    public record Resultat(String referenceClient, Etat etat, String raison, Long evaluationId) {}

    /** Tout ce dont le navigateur a besoin pour fonctionner sans reseau. */
    public record Paquet(Instant genereLe, List<CursusController.CursusVue> cursus,
                         List<SeanceController.SeanceVue> seances,
                         List<ReferentielController.ReferentielVue> referentiels,
                         List<GrilleService.GrilleVue> grilles) {}

    private final EvaluationService evaluations;
    private final EvaluationRepository depotEvaluations;
    private final HabilitationService habilitation;
    private final GrilleService grilles;
    private final CursusRepository cursus;
    private final SaisonRepository saisons;
    private final SeanceRepository seances;
    private final ReferentielRepository referentiels;

    public SynchronisationController(EvaluationService evaluations,
                                     EvaluationRepository depotEvaluations,
                                     HabilitationService habilitation, GrilleService grilles,
                                     CursusRepository cursus, SaisonRepository saisons,
                                     SeanceRepository seances, ReferentielRepository referentiels) {
        this.evaluations = evaluations;
        this.depotEvaluations = depotEvaluations;
        this.habilitation = habilitation;
        this.grilles = grilles;
        this.cursus = cursus;
        this.saisons = saisons;
        this.seances = seances;
        this.referentiels = referentiels;
    }

    /**
     * Volontairement non transactionnel : chaque saisie ouvre sa propre
     * transaction dans EvaluationService, si bien qu'un refus isole ne fait pas
     * perdre le reste de la file.
     */
    @PostMapping("/evaluations")
    @PreAuthorize("hasRole('MONITEUR')")
    public List<Resultat> rejouer(@Valid @RequestBody List<SaisieDifferee> saisies,
                                  @AuthenticationPrincipal UtilisateurPrincipal auteur,
                                  Authentication authentication) {
        List<Resultat> resultats = new ArrayList<>(saisies.size());

        for (SaisieDifferee s : saisies) {
            var dejaVue = depotEvaluations.findByReferenceClient(s.referenceClient());
            if (dejaVue.isPresent()) {
                resultats.add(new Resultat(s.referenceClient(), Etat.DEJA_ENREGISTREE,
                        null, dejaVue.get().getId()));
                continue;
            }

            if (!habilitation.peutEvaluer(s.cursusId(), authentication)) {
                resultats.add(new Resultat(s.referenceClient(), Etat.REFUSEE,
                        "Vous n'avez plus le droit de noter ce cursus.", null));
                continue;
            }

            try {
                Evaluation e = evaluations.noter(s.cursusId(),
                        new EvaluationService.Notation(s.critereId(), s.seanceId(), s.statut(),
                                s.commentaire(), s.dateEvaluation(), s.referenceClient()),
                        auteur);
                resultats.add(new Resultat(s.referenceClient(), Etat.ACCEPTEE, null, e.getId()));
            } catch (RegleMetierException | RessourceIntrouvableException erreur) {
                // Une regle du MFT peut refuser une saisie faite plusieurs heures
                // plus tot. Le refus remonte au moniteur, il n'est jamais absorbe.
                resultats.add(new Resultat(s.referenceClient(), Etat.REFUSEE,
                        erreur.getMessage(), null));
            }
        }
        return resultats;
    }

    /**
     * Amorce du mode hors ligne : referentiels, seances, cursus et grilles en
     * un seul appel, pour que l'application reste utilisable apres coupure.
     */
    @GetMapping("/paquet")
    public Paquet paquet(@RequestParam(required = false) Long saisonId,
                         @AuthenticationPrincipal UtilisateurPrincipal principal,
                         Authentication authentication) {
        Long saison = saisonId != null ? saisonId
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"))
                    .getId();

        List<Cursus> miens = cursus.parSaison(saison).stream()
                .filter(c -> habilitation.peutConsulter(c.getId(), authentication))
                .toList();

        List<CursusController.CursusVue> vuesCursus = miens.stream()
                .map(c -> new CursusController.CursusVue(c.getId(), c.getEleve().getId(), c.getEleve().nomComplet(),
                        c.getReferentiel().getNiveau().name(), c.getSaison().getLibelle(),
                        c.getStatut().name(),
                        c.getMoniteurReferent() == null ? null : c.getMoniteurReferent().nomComplet()))
                .toList();

        List<SeanceController.SeanceVue> vuesSeances = seances
                .findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison).stream()
                // "modifiable" et "ficheSecurite" ne servent qu'aux écrans de gestion des
                // séances et des fiches de sécurité, jamais consultés hors ligne : true par
                // défaut, ces écrans revérifient toujours en direct.
                .map(s -> new SeanceController.SeanceVue(s.getId(), s.getDateSeance(), s.getOrdre(),
                        s.getMilieu().name(), s.getLieu(), s.getSite(), s.getProfondeurMax(),
                        s.getCommentaire(), true, true))
                .toList();

        List<ReferentielController.ReferentielVue> vuesReferentiels = referentiels
                .findByActifTrueOrderByNiveau().stream()
                .map(this::referentielAllege)
                .toList();

        List<GrilleService.GrilleVue> vuesGrilles = miens.stream()
                .map(c -> grilles.grille(c.getId()))
                .toList();

        return new Paquet(Instant.now(), vuesCursus, vuesSeances, vuesReferentiels, vuesGrilles);
    }

    /** Les regles dont le navigateur a besoin pour refuser une saisie avant l'envoi. */
    private ReferentielController.ReferentielVue referentielAllege(Referentiel r) {
        return new ReferentielController.ReferentielVue(r.getId(), r.getNiveau().name(),
                r.getVersionMft(), r.getSource(), r.getDateApplication(), r.isActif(), r.getAgeMinimum(),
                r.getNiveauPrerequis() == null ? null : r.getNiveauPrerequis().name(),
                r.getQualificationRequise(), r.isMilieuNaturelExclusif(),
                r.getNiveauEncadrantValidation().name(), r.getNiveauEncadrantDelivrance().name(),
                r.getProfondeurMaxValidation(), r.getProfondeurMaxFormation(),
                r.getPrerogativeProfondeur(), List.of());
    }
}
