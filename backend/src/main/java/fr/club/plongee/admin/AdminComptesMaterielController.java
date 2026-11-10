package fr.club.plongee.admin;

import fr.club.plongee.admin.service.AdminComptesMaterielService;
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
 * Comptes des directeurs techniques qui ne sont pas moniteurs du club,
 * réservés aux ADMIN comme les comptes moniteurs ; écran Administration ›
 * Personnes › Directeurs techniques non moniteurs.
 */
@RestController
@RequestMapping("/api/admin/comptes-materiel")
@PreAuthorize("hasRole('ADMIN')")
public class AdminComptesMaterielController {

    public record CompteMaterielVue(Long id, String email, String nom, String prenom, boolean actif) {}

    public record DemandeActivation(@NotNull Boolean actif) {}

    public record DemandeCompteMateriel(@NotBlank @Email String email, @NotBlank String nom, @NotBlank String prenom) {}

    private final AdminComptesMaterielService service;

    public AdminComptesMaterielController(AdminComptesMaterielService service) {
        this.service = service;
    }

    @GetMapping
    public List<CompteMaterielVue> lister() {
        return service.lister().stream().map(AdminComptesMaterielController::vue).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompteMaterielVue creer(@Valid @RequestBody DemandeCompteMateriel demande) {
        return vue(service.creer(demande.email(), demande.nom(), demande.prenom()));
    }

    @PutMapping("/{id}")
    public CompteMaterielVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeCompteMateriel demande) {
        return vue(service.modifier(id, demande.email(), demande.nom(), demande.prenom()));
    }

    @PutMapping("/{id}/activation")
    public CompteMaterielVue changerActivation(@PathVariable Long id, @Valid @RequestBody DemandeActivation demande) {
        return vue(service.changerActivation(id, demande.actif()));
    }

    @PostMapping("/{id}/lien-reinitialisation")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void envoyerLienReinitialisation(@PathVariable Long id) {
        service.envoyerLienReinitialisation(id);
    }

    private static CompteMaterielVue vue(Utilisateur u) {
        return new CompteMaterielVue(u.getId(), u.getEmail(), u.getNom(), u.getPrenom(), u.isActif());
    }
}
