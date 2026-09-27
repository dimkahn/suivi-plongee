package fr.club.plongee.planning;

import fr.club.plongee.planning.service.GroupeEntrainementService;
import fr.club.plongee.planning.service.GroupeEntrainementService.DemandeGroupe;
import fr.club.plongee.planning.service.GroupeEntrainementService.EleveSaisonVue;
import fr.club.plongee.planning.service.GroupeEntrainementService.GroupeVue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Groupes d'entraînement d'une saison (Débutants, Perfect N1, Prépa N2...) :
 * consultés par les encadrants, composés par un admin.
 */
@RestController
@RequestMapping("/api/groupes-entrainement")
public class GroupeEntrainementController {

    public record DemandeOrdre(@NotNull List<Long> groupeIds) {}

    /** {@code groupeId} null : l'élève n'est plus dans aucun groupe. */
    public record DemandeRangement(Long groupeId) {}

    private final GroupeEntrainementService service;

    public GroupeEntrainementController(GroupeEntrainementService service) {
        this.service = service;
    }

    /** Sans saison précisée : la saison ouverte. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<GroupeVue> lister(@RequestParam(required = false) Long saisonId) {
        return service.lister(saisonId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public GroupeVue creer(@Valid @RequestBody DemandeGroupe demande) {
        return service.creer(demande);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public GroupeVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeGroupe demande) {
        return service.modifier(id, demande);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id) {
        service.supprimer(id);
    }

    @PutMapping("/saison/{saisonId}/ordre")
    @PreAuthorize("hasRole('ADMIN')")
    public List<GroupeVue> ordonner(@PathVariable Long saisonId, @Valid @RequestBody DemandeOrdre demande) {
        return service.ordonner(saisonId, demande.groupeIds());
    }

    @GetMapping("/saison/{saisonId}/eleves")
    @PreAuthorize("hasRole('ADMIN')")
    public List<EleveSaisonVue> elevesDeLaSaison(@PathVariable Long saisonId) {
        return service.elevesDeLaSaison(saisonId);
    }

    @PutMapping("/saison/{saisonId}/eleves/{eleveId}")
    @PreAuthorize("hasRole('ADMIN')")
    public EleveSaisonVue ranger(@PathVariable Long saisonId, @PathVariable Long eleveId,
                                 @RequestBody DemandeRangement demande) {
        return service.ranger(saisonId, eleveId, demande.groupeId());
    }

    @PostMapping("/saison/{saisonId}/suggestions")
    @PreAuthorize("hasRole('ADMIN')")
    public List<EleveSaisonVue> appliquerSuggestions(@PathVariable Long saisonId) {
        return service.appliquerSuggestions(saisonId);
    }
}
