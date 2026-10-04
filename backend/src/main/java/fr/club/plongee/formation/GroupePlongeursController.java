package fr.club.plongee.formation;

import fr.club.plongee.formation.service.EnvoiParametresSejourService;
import fr.club.plongee.formation.service.GroupePlongeursService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
                                @NotBlank String prenom, String aptitude, String qualificationPreparee,
                                @Email @Size(max = 255) String email) {}

    public record DemandeGroupePlongeurs(@NotBlank String nom, @NotNull Long saisonId,
                                         @NotNull List<@Valid DemandeMembre> membres) {}

    public record DemandeEnvoiParametres(@NotNull Long sortieId) {}

    private final GroupePlongeursService service;
    private final EnvoiParametresSejourService envoi;

    public GroupePlongeursController(GroupePlongeursService service, EnvoiParametresSejourService envoi) {
        this.service = service;
        this.envoi = envoi;
    }

    /**
     * Fin de séjour : chaque plongeur du groupe reçoit par courriel les
     * paramètres des seules plongées de la sortie où il figure.
     */
    @PostMapping("/{id}/envoi-parametres")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public EnvoiParametresSejourService.BilanEnvoi envoyerParametres(@PathVariable Long id,
                                                                     @Valid @RequestBody DemandeEnvoiParametres demande) {
        return envoi.envoyer(id, demande.sortieId());
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
                                m.nom(), m.prenom(), m.aptitude(), m.qualificationPreparee(), m.email()))
                        .toList());
    }
}
