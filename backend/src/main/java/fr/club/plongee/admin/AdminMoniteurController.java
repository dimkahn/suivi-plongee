package fr.club.plongee.admin;

import fr.club.plongee.admin.service.AdminMoniteurService;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.repository.PhotoUtilisateurRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.time.LocalDate;
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
                              String niveauEncadrement, String niveauPlongeur, String numeroLicence,
                              LocalDate certificatValideJusquAu, boolean admin,
                              boolean autorisationImage, boolean aPhoto) {}

    /** {@code admin} facultatif : absent, le moniteur est cree sans le role ADMIN. */
    public record DemandeCreationMoniteur(@NotBlank @Email String email, @NotBlank String nom,
                                          @NotBlank String prenom,
                                          @NotNull NiveauEncadrement niveauEncadrement,
                                          @Pattern(regexp = "N[1-5]", message = "Niveau de plongeur attendu : N1 à N5.") String niveauPlongeur,
                                          String numeroLicence, LocalDate certificatValideJusquAu,
                                          Boolean admin) {}

    /**
     * {@code admin} facultatif : absent, le role ADMIN du moniteur reste tel
     * quel (compatibilite avec un ecran qui ne l'envoie pas).
     */
    public record DemandeModificationMoniteur(@NotBlank @Email String email, @NotBlank String nom,
                                              @NotBlank String prenom,
                                              @NotNull NiveauEncadrement niveauEncadrement,
                                          @Pattern(regexp = "N[1-5]", message = "Niveau de plongeur attendu : N1 à N5.") String niveauPlongeur,
                                              String numeroLicence, LocalDate certificatValideJusquAu,
                                              Boolean admin) {}

    public record DemandeAutorisationImage(@NotNull Boolean autorisationImage) {}

    public record DemandeActivation(@NotNull Boolean actif) {}

    public record DemandeMotDePasse(@NotBlank String nouveauMotDePasse) {}

    private final AdminMoniteurService service;
    private final PhotoUtilisateurRepository photos;

    public AdminMoniteurController(AdminMoniteurService service, PhotoUtilisateurRepository photos) {
        this.service = service;
        this.photos = photos;
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
                demande.niveauEncadrement(), demande.niveauPlongeur(), demande.numeroLicence(),
                demande.certificatValideJusquAu(), Boolean.TRUE.equals(demande.admin())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public MoniteurVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeModificationMoniteur demande,
                                @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return vue(service.modifier(id, auteur.id(), demande.email(), demande.nom(), demande.prenom(),
                demande.niveauEncadrement(), demande.niveauPlongeur(), demande.numeroLicence(),
                demande.certificatValideJusquAu(), demande.admin()));
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

    @PutMapping("/{id}/autorisation-image")
    @PreAuthorize("hasRole('ADMIN')")
    public MoniteurVue changerAutorisationImage(@PathVariable Long id,
                                               @Valid @RequestBody DemandeAutorisationImage demande) {
        return vue(service.changerAutorisationImage(id, demande.autorisationImage()));
    }

    @PostMapping("/{id}/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deposerPhoto(@PathVariable Long id, @RequestParam("fichier") MultipartFile fichier) {
        try {
            service.deposerPhoto(id, fichier.getBytes(), fichier.getContentType());
        } catch (IOException e) {
            throw new RegleMetierException("La photo n'a pas pu être lue.");
        }
    }

    @DeleteMapping("/{id}/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimerPhoto(@PathVariable Long id) {
        service.supprimerPhoto(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.supprimer(id, auteur.id());
    }

    private MoniteurVue vue(fr.club.plongee.securite.domain.Utilisateur u) {
        return new MoniteurVue(u.getId(), u.getEmail(), u.getNom(), u.getPrenom(), u.isActif(),
                u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name(),
                u.getNiveauPlongeur(), u.getNumeroLicence(), u.getCertificatValideJusquAu(), u.getRoles().contains(RoleNom.ADMIN),
                u.isAutorisationImage(), u.isAutorisationImage() && photos.existsById(u.getId()));
    }
}
