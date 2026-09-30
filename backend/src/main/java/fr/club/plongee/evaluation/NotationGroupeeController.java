package fr.club.plongee.evaluation;

import fr.club.plongee.evaluation.service.NotationGroupeeService;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Notation groupée depuis la feuille de présence : plusieurs élèves présents,
 * un ou plusieurs critères, un même commentaire. L'habilitation (niveau
 * d'encadrement suffisant pour chaque élève) est vérifiée par le service,
 * élève par élève, puisqu'elle dépend du cursus de chacun.
 */
@RestController
@RequestMapping("/api/seances/{seanceId}/notation-groupee")
public class NotationGroupeeController {

    private final NotationGroupeeService service;

    public NotationGroupeeController(NotationGroupeeService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasRole('MONITEUR')")
    public NotationGroupeeService.BilanNotationGroupee noter(
            @PathVariable Long seanceId,
            @RequestBody NotationGroupeeService.NotationGroupee demande,
            @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return service.noter(seanceId, demande, auteur);
    }
}
