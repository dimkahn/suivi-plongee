package fr.club.plongee.admin;

import fr.club.plongee.admin.service.AdminSecuriteSurfaceService;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Comptes « sécurité surface » (pas moniteurs du club), réservés aux ADMIN
 * comme les comptes moniteurs ; montrés dans l'écran Moniteurs.
 */
@RestController
@RequestMapping("/api/admin/securite-surface")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSecuriteSurfaceController {

    public record CompteSurfaceVue(Long id, String email, String nom, String prenom, boolean actif) {}

    public record DemandeCompteSurface(@NotBlank @Email String email, @NotBlank String nom,
                                       @NotBlank String prenom) {}

    public record DemandeActivation(@NotNull Boolean actif) {}

    private final AdminSecuriteSurfaceService service;

    public AdminSecuriteSurfaceController(AdminSecuriteSurfaceService service) {
        this.service = service;
    }

    @GetMapping
    public List<CompteSurfaceVue> lister() {
        return service.lister().stream().map(AdminSecuriteSurfaceController::vue).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompteSurfaceVue creer(@Valid @RequestBody DemandeCompteSurface demande) {
        return vue(service.creer(demande.email(), demande.nom(), demande.prenom()));
    }

    @PutMapping("/{id}")
    public CompteSurfaceVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeCompteSurface demande) {
        return vue(service.modifier(id, demande.email(), demande.nom(), demande.prenom()));
    }

    @PutMapping("/{id}/activation")
    public CompteSurfaceVue changerActivation(@PathVariable Long id, @Valid @RequestBody DemandeActivation demande) {
        return vue(service.changerActivation(id, demande.actif()));
    }

    @PostMapping("/{id}/lien-reinitialisation")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void envoyerLienReinitialisation(@PathVariable Long id) {
        service.envoyerLienReinitialisation(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        service.supprimer(id);
    }

    private static CompteSurfaceVue vue(Utilisateur u) {
        return new CompteSurfaceVue(u.getId(), u.getEmail(), u.getNom(), u.getPrenom(), u.isActif());
    }
}
