package fr.club.plongee.sejour;

import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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

    private final NamedParameterJdbcTemplate jdbc;

    public DroitsSejour(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean organise(Long sortieId, Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && organise(sortieId, p.id());
    }

    @Transactional(readOnly = true)
    public boolean organise(Long sortieId, Long utilisateurId) {
        if (sortieId == null || utilisateurId == null) return false;
        Integer n = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM sejour WHERE sortie_id = :sortie AND createur_id = :moi)
                     + (SELECT COUNT(*) FROM sejour_organisateur WHERE sortie_id = :sortie AND utilisateur_id = :moi)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("moi", utilisateurId), Integer.class);
        return n != null && n > 0;
    }

    public boolean peutDesigner(Long sortieId, Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && peutDesigner(sortieId, p);
    }

    @Transactional(readOnly = true)
    public boolean peutDesigner(Long sortieId, UtilisateurPrincipal p) {
        if (p.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM sejour WHERE sortie_id = :sortie AND createur_id = :moi",
                new MapSqlParameterSource("sortie", sortieId).addValue("moi", p.id()), Integer.class);
        return n != null && n > 0;
    }
}
