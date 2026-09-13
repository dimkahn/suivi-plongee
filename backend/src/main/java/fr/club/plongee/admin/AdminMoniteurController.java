package fr.club.plongee.admin;

import fr.club.plongee.securite.NiveauEncadrement;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion des comptes moniteurs, reservee aux ADMIN. Restreint par
 * {@code /api/admin/**} dans SecurityConfig ; les {@code @PreAuthorize}
 * ci-dessous sont une redondance deliberee, comme pour les autres ecritures
 * sensibles de l'application.
 */
@RestController
@RequestMapping("/api/admin/moniteurs")
public class AdminMoniteurController {

    public record MoniteurVue(Long id, String email, String nom, String prenom, boolean actif,
                              String niveauEncadrement, String numeroLicence) {}

    public record DemandeCreationMoniteur(@NotBlank @Email String email, @NotBlank String nom,
                                          @NotBlank String prenom,
                                          @NotNull NiveauEncadrement niveauEncadrement,
                                          String numeroLicence) {}

    public record DemandeActivation(@NotNull Boolean actif) {}

    public record DemandeMotDePasse(@NotBlank String nouveauMotDePasse) {}

    private final AdminMoniteurService service;

    public AdminMoniteurController(AdminMoniteurService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<MoniteurVue> lister() {
        return service.lister().stream().map(this::vue).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public MoniteurVue creer(@Valid @RequestBody DemandeCreationMoniteur demande) {
        return vue(service.creer(demande.email(), demande.nom(), demande.prenom(),
                demande.niveauEncadrement(), demande.numeroLicence()));
    }

    @PutMapping("/{id}/activation")
    @PreAuthorize("hasRole('ADMIN')")
    public MoniteurVue changerActivation(@PathVariable Long id, @Valid @RequestBody DemandeActivation demande,
                                        @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return vue(service.changerActivation(id, auteur.id(), demande.actif()));
    }

    @PutMapping("/{id}/mot-de-passe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void changerMotDePasse(@PathVariable Long id, @Valid @RequestBody DemandeMotDePasse demande) {
        service.changerMotDePasse(id, demande.nouveauMotDePasse());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.supprimer(id, auteur.id());
    }

    private MoniteurVue vue(fr.club.plongee.securite.Utilisateur u) {
        return new MoniteurVue(u.getId(), u.getEmail(), u.getNom(), u.getPrenom(), u.isActif(),
                u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name(),
                u.getNumeroLicence());
    }
}
