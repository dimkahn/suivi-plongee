package fr.club.plongee.securite;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Principal expose dans le SecurityContext. Il porte l'identifiant de
 * l'utilisateur : aucun controleur ne doit faire confiance a un id de
 * moniteur transmis dans le corps d'une requete.
 */
public record UtilisateurPrincipal(Long id, String email, String motDePasse,
                                   boolean actif, NiveauEncadrement niveauEncadrement,
                                   List<GrantedAuthority> autorisations) implements UserDetails {

    public static UtilisateurPrincipal de(Utilisateur u) {
        List<GrantedAuthority> roles = u.getRoles().stream()
                .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r.name()))
                .toList();
        return new UtilisateurPrincipal(u.getId(), u.getEmail(), u.getMotDePasse(),
                u.estActifLe(Calendrier.aujourdhui()), u.getNiveauEncadrement(), roles);
    }

    /** Compte de sécurité surface qui n'est ni moniteur ni administrateur : limité aux séances confiées. */
    public boolean limiteAuxSeancesConfiees() {
        return aLeRole(RoleNom.SECURITE_SURFACE) && !aLeRole(RoleNom.MONITEUR) && !aLeRole(RoleNom.ADMIN);
    }

    private boolean aLeRole(RoleNom role) {
        return autorisations.stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role.name()));
    }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return autorisations; }
    @Override public String getPassword() { return motDePasse; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonExpired() { return actif; }
    @Override public boolean isAccountNonLocked() { return actif; }
    @Override public boolean isCredentialsNonExpired() { return actif; }
    @Override public boolean isEnabled() { return actif; }
}
