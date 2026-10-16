package fr.club.plongee.sejour.application;

import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.sejour.domaine.port.Sejours;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Qui modifie un séjour (V80, choix du club 2026) : son créateur (celui qui
 * a créé la sortie) et les organisateurs qu'il a désignés, rien d'autre —
 * être ADMIN ou directeur technique ne suffit pas. Les autres encadrants le
 * lisent avec leur compte, les participants par le lien et le code.
 * <p>
 * Désigner les organisateurs : le créateur, et un ADMIN pour reprendre un
 * séjour dont le créateur est inconnu ou a quitté le club.
 * <p>
 * Utilisé dans les {@code @PreAuthorize} du contrôleur
 * ({@code @droitsSejour.organise(#id, authentication)}), comme
 * l'habilitation à noter.
 */
@Component("droitsSejour")
public class DroitsSejour {

    private final Sejours sejours;

    public DroitsSejour(Sejours sejours) {
        this.sejours = sejours;
    }

    public boolean organise(Long sortieId, Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && organise(sortieId, p.id());
    }

    @Transactional(readOnly = true)
    public boolean organise(Long sortieId, Long utilisateurId) {
        if (sortieId == null || utilisateurId == null) return false;
        return sejours.organise(sortieId, utilisateurId);
    }

    public boolean peutDesigner(Long sortieId, Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && peutDesigner(sortieId, p);
    }

    @Transactional(readOnly = true)
    public boolean peutDesigner(Long sortieId, UtilisateurPrincipal p) {
        if (p.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        return sejours.estCreateur(sortieId, p.id());
    }
}
