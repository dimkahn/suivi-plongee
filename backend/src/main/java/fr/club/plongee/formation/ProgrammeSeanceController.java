package fr.club.plongee.formation;

import fr.club.plongee.evaluation.service.HabilitationService;
import fr.club.plongee.formation.service.ProgrammeSeanceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Programme d'exercices d'une séance : un par groupe d'entraînement, plus un
 * programme commun. Consulté par tous les encadrants, préparé par ceux du
 * groupe (ou un admin), avant comme après la séance. La fiche de suivi d'un
 * élève en reçoit sa part avec la grille (voir GrilleService).
 */
@RestController
@RequestMapping("/api/seances/{seanceId}/programme")
public class ProgrammeSeanceController {

    private final ProgrammeSeanceService service;

    public ProgrammeSeanceController(ProgrammeSeanceService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ProgrammeSeanceService.ProgrammeVue lire(@PathVariable Long seanceId, Authentication authentication) {
        return service.programme(seanceId, HabilitationService.principal(authentication));
    }

    /** Remplace le programme d'un groupe (sans groupe : le programme commun) par la liste reçue, dans son ordre. */
    @PutMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ProgrammeSeanceService.ProgrammeVue enregistrer(
            @PathVariable Long seanceId,
            @RequestParam(required = false) Long groupeId,
            @RequestBody List<ProgrammeSeanceService.DemandeExercice> exercices,
            Authentication authentication) {
        return service.enregistrer(seanceId, groupeId, exercices, HabilitationService.principal(authentication));
    }
}
