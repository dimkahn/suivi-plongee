package fr.club.plongee.formation;

import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.formation.service.SortieService.DemandeSortie;
import fr.club.plongee.formation.service.SortieService.SeancePossibleVue;
import fr.club.plongee.formation.service.SortieService.SortieVue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Sorties et séances qui les composent : consultées par les encadrants,
 * gérées par un admin ou le directeur technique (qui y rattache ses prêts
 * de matériel).
 */
@RestController
@RequestMapping("/api/sorties")
public class SortieController {

    public record DemandeSeances(@NotNull List<Long> seanceIds) {}

    private final SortieService service;

    public SortieController(SortieService service) {
        this.service = service;
    }

    /** {@code recentes} : à venir ou finies depuis peu (choix d'une sortie pour un prêt) ; sinon toutes. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN','DIRECTEUR_TECHNIQUE')")
    public List<SortieVue> lister(@RequestParam(defaultValue = "false") boolean recentes) {
        return service.lister(recentes);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN','DIRECTEUR_TECHNIQUE')")
    public SortieVue lire(@PathVariable Long id) {
        return service.lire(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_TECHNIQUE')")
    public SortieVue creer(@Valid @RequestBody DemandeSortie demande) {
        return service.creer(demande);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_TECHNIQUE')")
    public SortieVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeSortie demande) {
        return service.modifier(id, demande);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_TECHNIQUE')")
    public void supprimer(@PathVariable Long id) {
        service.supprimer(id);
    }

    /** Les séances des dates de la sortie, pour choisir celles qui en font partie. */
    @GetMapping("/{id}/seances-possibles")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_TECHNIQUE')")
    public List<SeancePossibleVue> seancesPossibles(@PathVariable Long id) {
        return service.seancesPossibles(id);
    }

    @PutMapping("/{id}/seances")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_TECHNIQUE')")
    public SortieVue definirSeances(@PathVariable Long id, @Valid @RequestBody DemandeSeances demande) {
        return service.definirSeances(id, demande.seanceIds());
    }
}
