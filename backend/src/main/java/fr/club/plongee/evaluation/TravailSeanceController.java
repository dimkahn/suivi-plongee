package fr.club.plongee.evaluation;

import fr.club.plongee.evaluation.service.TravailSeanceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Ce que chaque groupe a travaillé pendant une séance, d'après les notes, en lecture pour les encadrants. */
@RestController
@RequestMapping("/api/seances/{seanceId}/travail")
public class TravailSeanceController {

    private final TravailSeanceService service;

    public TravailSeanceController(TravailSeanceService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public TravailSeanceService.TravailSeanceVue travail(@PathVariable Long seanceId) {
        return service.travail(seanceId);
    }
}
