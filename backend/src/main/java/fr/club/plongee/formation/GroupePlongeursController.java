package fr.club.plongee.formation;

import fr.club.plongee.formation.service.GroupePlongeursService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Groupes nommés et réutilisables de plongeurs (voir {@code
 * GroupePlongeursService}) : composés une fois pour un séjour, puis glissés-
 * déposés dans les palanquées de plusieurs fiches de sécurité successives,
 * sans ressaisir le roster à chaque plongée.
 */
@RestController
@RequestMapping("/api/groupes-plongeurs")
public class GroupePlongeursController {

    public record DemandeMembre(Long eleveId, Long utilisateurId, @NotBlank String nom,
                                @NotBlank String prenom, String aptitude, String qualificationPreparee) {}

    public record DemandeGroupePlongeurs(@NotBlank String nom, @NotNull Long saisonId,
                                         @NotNull List<@Valid DemandeMembre> membres) {}

    private final GroupePlongeursService service;

    public GroupePlongeursController(GroupePlongeursService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<GroupePlongeursService.GroupePlongeursVue> lister(@RequestParam Long saisonId) {
        return service.lister(saisonId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public GroupePlongeursService.GroupePlongeursVue creer(@Valid @RequestBody DemandeGroupePlongeurs demande) {
        return service.creer(saisie(demande));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public GroupePlongeursService.GroupePlongeursVue modifier(@PathVariable Long id,
                                                              @Valid @RequestBody DemandeGroupePlongeurs demande) {
        return service.modifier(id, saisie(demande));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public void supprimer(@PathVariable Long id) {
        service.supprimer(id);
    }

    private GroupePlongeursService.Saisie saisie(DemandeGroupePlongeurs demande) {
        return new GroupePlongeursService.Saisie(demande.nom(), demande.saisonId(),
                demande.membres().stream()
                        .map(m -> new GroupePlongeursService.Membre(m.eleveId(), m.utilisateurId(),
                                m.nom(), m.prenom(), m.aptitude(), m.qualificationPreparee()))
                        .toList());
    }
}
