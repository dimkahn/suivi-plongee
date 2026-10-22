package fr.club.plongee.sejour;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.function.Supplier;

/**
 * Une création du séjour faite une seule fois, même rejouée par le
 * téléphone qui l'a gardée hors ligne (table {@code sejour_reference_client},
 * V99_2). La référence est notée dans la même transaction que la création :
 * une création refusée (422) ne la garde pas. Les droits restent vérifiés
 * avant, par le contrôleur, à chaque envoi.
 */
@Component
public class RejeuSejour {

    /** L'en-tête qui porte la référence tirée par le téléphone. */
    public static final String EN_TETE = "X-Reference-Client";

    private final NamedParameterJdbcTemplate jdbc;

    public RejeuSejour(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Fait la création, sauf si cette référence l'a déjà faite pour ce
     * séjour ; rend l'id créé (null si la création n'en rend pas). Sans
     * référence (appli en ligne d'avant), la création est toujours faite.
     */
    @Transactional
    public Long idCreeUneFois(Long sortieId, String reference, Supplier<Long> creation) {
        if (reference == null || reference.isBlank()) return creation.get();
        MapSqlParameterSource p = new MapSqlParameterSource("sortie", sortieId).addValue("reference", reference);
        List<Long> deja = jdbc.query("""
                SELECT objet_id FROM sejour_reference_client WHERE sortie_id = :sortie AND reference = :reference""",
                p, (rs, i) -> rs.getObject(1) == null ? null : rs.getLong(1));
        if (!deja.isEmpty()) return deja.getFirst();
        Long id = creation.get();
        jdbc.update("""
                INSERT INTO sejour_reference_client (sortie_id, reference, objet_id)
                VALUES (:sortie, :reference, :objet)""", p.addValue("objet", id));
        return id;
    }

    /** Pour une création qui ne rend pas d'id. */
    @Transactional
    public void uneFois(Long sortieId, String reference, Runnable creation) {
        idCreeUneFois(sortieId, reference, () -> {
            creation.run();
            return null;
        });
    }
}
