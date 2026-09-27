package fr.club.plongee.planning;

import fr.club.plongee.evaluation.service.HabilitationService;
import fr.club.plongee.planning.service.PlanningService;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.planning.service.PlanningService.DemandeCase;
import fr.club.plongee.planning.service.PlanningService.DemandeSoiree;
import fr.club.plongee.planning.service.PlanningService.PlanningVue;
import fr.club.plongee.planning.service.PlanningService.SoireeVue;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Planning des soirées d'entraînement : consulté par les encadrants, tenu
 * par un admin, case par case (groupe × date) et soirée par soirée
 * (responsable de séance, note).
 */
@RestController
@RequestMapping("/api/planning")
public class PlanningController {

    private final PlanningService service;

    public PlanningController(PlanningService service) {
        this.service = service;
    }

    /** Sans saison précisée : la saison ouverte. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public PlanningVue planning(@RequestParam(required = false) Long saisonId, Authentication authentication) {
        UtilisateurPrincipal moi = HabilitationService.principal(authentication);
        return service.planning(saisonId, moi == null ? null : moi.id());
    }

    @PutMapping("/saison/{saisonId}/soirees/{date}/groupes/{groupeId}")
    @PreAuthorize("hasRole('ADMIN')")
    public SoireeVue definirCase(@PathVariable Long saisonId,
                                 @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                 @PathVariable Long groupeId, @Valid @RequestBody DemandeCase demande) {
        return service.definirCase(saisonId, date, groupeId, demande);
    }

    @PutMapping("/saison/{saisonId}/soirees/{date}")
    @PreAuthorize("hasRole('ADMIN')")
    public SoireeVue definirSoiree(@PathVariable Long saisonId,
                                   @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                   @Valid @RequestBody DemandeSoiree demande) {
        return service.definirSoiree(saisonId, date, demande);
    }
}
