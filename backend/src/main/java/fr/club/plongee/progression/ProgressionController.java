package fr.club.plongee.progression;

import fr.club.plongee.progression.service.ProgressionService;
import fr.club.plongee.progression.service.ProgressionService.DemandeProgression;
import fr.club.plongee.progression.service.ProgressionService.ProgressionResume;
import fr.club.plongee.progression.service.ProgressionService.ProgressionVue;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Progressions types : consultables par tout encadrant connecté, écrites par un admin. */
@RestController
@RequestMapping("/api/progressions")
public class ProgressionController {

    private final ProgressionService service;

    public ProgressionController(ProgressionService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProgressionResume> lister() {
        return service.lister();
    }

    @GetMapping("/{id}")
    public ProgressionVue detail(@PathVariable Long id) {
        return service.detail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ProgressionVue creer(@Valid @RequestBody DemandeProgression demande) {
        return service.creer(demande);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProgressionVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeProgression demande) {
        return service.modifier(id, demande);
    }

    @PostMapping("/{id}/copie")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ProgressionVue copier(@PathVariable Long id) {
        return service.copier(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id) {
        service.supprimer(id);
    }
}
