package fr.club.plongee.evaluation;

import fr.club.plongee.evaluation.service.SyntheseSeanceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Synthèse des notations d'une séance pour un niveau, en lecture pour les encadrants. */
@RestController
@RequestMapping("/api/seances/{seanceId}/synthese")
public class SyntheseSeanceController {

    private final SyntheseSeanceService service;

    public SyntheseSeanceController(SyntheseSeanceService service) {
        this.service = service;
    }

    /** Sans niveau précisé (ou absent de la séance) : le premier niveau des présents. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public SyntheseSeanceService.SyntheseVue synthese(@PathVariable Long seanceId,
                                                      @RequestParam(required = false) String niveau) {
        return service.synthese(seanceId, niveau);
    }
}
