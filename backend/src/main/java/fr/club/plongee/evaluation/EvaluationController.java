package fr.club.plongee.evaluation;

import fr.club.plongee.delivrance.RegleDelivranceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/cursus/{cursusId}")
public class EvaluationController {

    public record DemandeNotation(@NotNull Long critereId, Long seanceId,
                                  @NotNull StatutAcquisition statut,
                                  String commentaire, LocalDate dateEvaluation,
                                  String referenceClient) {}

    public record DemandeValidation(String commentaire) {}

    public record EvaluationVue(Long id, Long critereId, String statut, String commentaire,
                                LocalDate dateEvaluation, String parQui) {}

    private final EvaluationService evaluations;
    private final GrilleService grilles;
    private final RegleDelivranceService regles;

    public EvaluationController(EvaluationService evaluations, GrilleService grilles,
                                RegleDelivranceService regles) {
        this.evaluations = evaluations;
        this.grilles = grilles;
        this.regles = regles;
    }

    /** Lecture : encadrants, administratifs, ou l'eleve pour son propre cursus. */
    @GetMapping("/grille")
    @PreAuthorize("@habilitation.peutConsulter(#cursusId, authentication)")
    public GrilleService.GrilleVue grille(@PathVariable Long cursusId) {
        return grilles.grille(cursusId);
    }

    /** Saisie : role MONITEUR, actif, et niveau d'encadrement suffisant pour ce brevet. */
    @PostMapping("/evaluations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('MONITEUR') and @habilitation.peutEvaluer(#cursusId, authentication)")
    public EvaluationVue noter(@PathVariable Long cursusId,
                               @Valid @RequestBody DemandeNotation demande,
                               @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        Evaluation e = evaluations.noter(cursusId,
                new EvaluationService.Notation(demande.critereId(), demande.seanceId(),
                        demande.statut(), demande.commentaire(), demande.dateEvaluation(),
                        demande.referenceClient()),
                auteur);
        return vue(e);
    }

    @GetMapping("/criteres/{critereId}/historique")
    @PreAuthorize("@habilitation.peutConsulter(#cursusId, authentication)")
    public List<EvaluationVue> historique(@PathVariable Long cursusId, @PathVariable Long critereId) {
        return evaluations.historique(cursusId, critereId).stream().map(this::vue).toList();
    }

    /** Vue globale d'un élève : une colonne par séance, comme l'onglet individuel du tableur. */
    @GetMapping("/matrice")
    @PreAuthorize("@habilitation.peutConsulter(#cursusId, authentication)")
    public GrilleService.MatriceVue matrice(@PathVariable Long cursusId) {
        return grilles.matrice(cursusId);
    }

    @PostMapping("/competences/{blocId}/validation")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('MONITEUR') and @habilitation.peutEvaluer(#cursusId, authentication)")
    public void validerCompetence(@PathVariable Long cursusId, @PathVariable Long blocId,
                                  @RequestBody(required = false) DemandeValidation demande,
                                  @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        evaluations.validerBloc(cursusId, blocId,
                demande == null ? null : demande.commentaire(), auteur);
    }

    @GetMapping("/eligibilite")
    @PreAuthorize("@habilitation.peutConsulter(#cursusId, authentication)")
    public RegleDelivranceService.Eligibilite eligibilite(@PathVariable Long cursusId) {
        return regles.eligibilite(cursusId);
    }

    @PostMapping("/delivrance")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('MONITEUR')")
    public void delivrer(@PathVariable Long cursusId,
                         @RequestParam(required = false) String numeroBrevet,
                         @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        regles.delivrer(cursusId, numeroBrevet, auteur);
    }

    private EvaluationVue vue(Evaluation e) {
        return new EvaluationVue(e.getId(), e.getCritere().getId(), e.getStatut().name(),
                e.getCommentaire(), e.getDateEvaluation(), e.getMoniteur().nomComplet());
    }
}
