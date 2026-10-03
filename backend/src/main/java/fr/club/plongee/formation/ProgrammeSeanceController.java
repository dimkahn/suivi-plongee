package fr.club.plongee.formation;

import fr.club.plongee.formation.service.ProgrammeSeanceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Programme d'exercices d'une séance : préparé et consulté par les
 * encadrants, avant comme après la séance. La fiche de suivi d'un élève en
 * reçoit sa part avec la grille (voir GrilleService).
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
    public ProgrammeSeanceService.ProgrammeVue lire(@PathVariable Long seanceId) {
        return service.programme(seanceId);
    }

    /** Remplace tout le programme : la liste reçue, dans son ordre. */
    @PutMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ProgrammeSeanceService.ProgrammeVue enregistrer(
            @PathVariable Long seanceId,
            @RequestBody List<ProgrammeSeanceService.DemandeExercice> exercices) {
        return service.enregistrer(seanceId, exercices);
    }
}
