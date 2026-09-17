package fr.club.plongee.securite;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Liste minimale des moniteurs actifs, pour les menus déroulants des
 * encadrants (choix du DP sur une fiche de sécurité...). Distincte de
 * {@code /api/admin/moniteurs} : celle-ci est réservée à l'ADMIN et porte la
 * gestion complète des comptes (email, activation, mot de passe).
 */
@RestController
@RequestMapping("/api/moniteurs")
public class MoniteurController {

    public record MoniteurOptionVue(Long id, String nomComplet, String niveauEncadrement) {}

    private final UtilisateurRepository utilisateurs;

    public MoniteurController(UtilisateurRepository utilisateurs) {
        this.utilisateurs = utilisateurs;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<MoniteurOptionVue> lister() {
        return utilisateurs.parRole(RoleNom.MONITEUR).stream()
                .filter(Utilisateur::isActif)
                .map(u -> new MoniteurOptionVue(u.getId(), u.nomComplet(),
                        u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name()))
                .toList();
    }
}
