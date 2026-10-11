package fr.club.plongee.evaluation;

import fr.club.plongee.evaluation.service.SyntheseGroupeService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Synthèse des compétences des élèves d'un groupe d'entraînement, en lecture pour les encadrants. */
@RestController
@RequestMapping("/api/groupes-entrainement/{groupeId}/synthese-competences")
public class SyntheseGroupeController {

    private final SyntheseGroupeService service;

    public SyntheseGroupeController(SyntheseGroupeService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public SyntheseGroupeService.SyntheseGroupeVue synthese(@PathVariable Long groupeId) {
        return service.synthese(groupeId);
    }
}
