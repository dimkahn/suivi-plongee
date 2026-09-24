package fr.club.plongee.securite;

import fr.club.plongee.securite.domain.*;
import fr.club.plongee.securite.repository.*;
import fr.club.plongee.securite.service.*;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Liste minimale des moniteurs actifs, pour les menus déroulants des
 * encadrants (choix du DP sur une fiche de sécurité...) et le trombinoscope
 * des moniteurs. Distincte de {@code /api/admin/moniteurs} : celle-ci est
 * réservée à l'ADMIN et porte la gestion complète des comptes (email,
 * activation, mot de passe, droit à l'image, dépôt de photo).
 */
@RestController
@RequestMapping("/api/moniteurs")
public class MoniteurController {

    public record MoniteurOptionVue(Long id, String nomComplet, String niveauEncadrement) {}

    /** Une photo ne s'affiche jamais sans le droit à l'image du moniteur. */
    public record LigneTrombinoscopeMoniteur(Long id, String nomComplet, String niveauEncadrement,
                                             boolean aPhoto, boolean autorisationImage) {}

    private final UtilisateurRepository utilisateurs;
    private final PhotoUtilisateurRepository photos;

    public MoniteurController(UtilisateurRepository utilisateurs, PhotoUtilisateurRepository photos) {
        this.utilisateurs = utilisateurs;
        this.photos = photos;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<MoniteurOptionVue> lister() {
        return actifs().stream()
                .map(u -> new MoniteurOptionVue(u.getId(), u.nomComplet(), niveau(u)))
                .toList();
    }

    @GetMapping("/trombinoscope")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<LigneTrombinoscopeMoniteur> trombinoscope() {
        return actifs().stream()
                .map(u -> new LigneTrombinoscopeMoniteur(u.getId(), u.nomComplet(), niveau(u),
                        u.isAutorisationImage() && photos.existsById(u.getId()), u.isAutorisationImage()))
                .toList();
    }

    @GetMapping("/{id}/photo")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> photo(@PathVariable Long id) {
        return utilisateurs.findById(id)
                .filter(u -> u.getRoles().contains(RoleNom.MONITEUR) && u.isAutorisationImage())
                .flatMap(u -> photos.findById(id))
                .map(p -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(p.getTypeContenu()))
                        .body(p.getContenu()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private List<Utilisateur> actifs() {
        return utilisateurs.parRole(RoleNom.MONITEUR).stream().filter(Utilisateur::isActif).toList();
    }

    private static String niveau(Utilisateur u) {
        return u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name();
    }
}
