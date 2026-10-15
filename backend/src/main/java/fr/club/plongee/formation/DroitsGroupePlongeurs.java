package fr.club.plongee.formation;

import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Qui modifie un groupe de plongeurs (V81, choix du club 2026) : le compte
 * qui a créé la liste et les organisateurs qu'il a désignés, comme pour un
 * séjour ({@code DroitsSejour}) — être ADMIN ne suffit pas. Les autres
 * encadrants le lisent, le reprennent dans leurs fiches de sécurité et
 * envoient les paramètres de fin de séjour.
 * <p>
 * Désigner les organisateurs : le créateur, et un ADMIN pour reprendre un
 * groupe dont le créateur est inconnu (groupe d'avant V81) ou a quitté le
 * club.
 * <p>
 * Utilisé dans les {@code @PreAuthorize} du contrôleur
 * ({@code @droitsGroupePlongeurs.organise(#id, authentication)}).
 */
@Component("droitsGroupePlongeurs")
public class DroitsGroupePlongeurs {

    private final NamedParameterJdbcTemplate jdbc;

    public DroitsGroupePlongeurs(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean organise(Long groupeId, Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && organise(groupeId, p.id());
    }

    @Transactional(readOnly = true)
    public boolean organise(Long groupeId, Long utilisateurId) {
        if (groupeId == null || utilisateurId == null) return false;
        Integer n = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM groupe_plongeurs WHERE id = :groupe AND createur_id = :moi)
                     + (SELECT COUNT(*) FROM groupe_plongeurs_organisateur
                         WHERE groupe_id = :groupe AND utilisateur_id = :moi)""",
                new MapSqlParameterSource("groupe", groupeId).addValue("moi", utilisateurId), Integer.class);
        return n != null && n > 0;
    }

    public boolean peutDesigner(Long groupeId, Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && peutDesigner(groupeId, p);
    }

    @Transactional(readOnly = true)
    public boolean peutDesigner(Long groupeId, UtilisateurPrincipal p) {
        if (p.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM groupe_plongeurs WHERE id = :groupe AND createur_id = :moi",
                new MapSqlParameterSource("groupe", groupeId).addValue("moi", p.id()), Integer.class);
        return n != null && n > 0;
    }
}
