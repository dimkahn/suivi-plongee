package fr.club.plongee;

import org.flywaydb.core.Flyway;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Répétition de la mise en production de V80 (créateur et organisateurs
 * d'un séjour) : une base migrée jusqu'à V79, avec une sortie créée depuis
 * l'appli (historique Envers) et une autre sans historique. Le créateur de
 * la première est retrouvé ; la seconde n'en a pas ; le reste ne bouge pas.
 */
class MigrationOrganisateursSejourTest {

    @Test
    @DisplayName("V80 retrouve le créateur des sorties dans leur historique, sans rien changer d'autre")
    void createurRetrouveDansLHistorique() {
        JdbcDataSource base = new JdbcDataSource();
        base.setURL("jdbc:h2:mem:repetition-v80;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("79").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(base);

        jdbc.update("INSERT INTO utilisateur (email, mot_de_passe, nom, prenom) VALUES ('dt@club.fr', 'x', 'Marchand', 'Gwendoline')");
        jdbc.update("INSERT INTO utilisateur (email, mot_de_passe, nom, prenom) VALUES ('autre@club.fr', 'x', 'Vasseur', 'Flora')");
        long dt = jdbc.queryForObject("SELECT id FROM utilisateur WHERE email = 'dt@club.fr'", Long.class);
        long autre = jdbc.queryForObject("SELECT id FROM utilisateur WHERE email = 'autre@club.fr'", Long.class);

        // Créée dans l'appli par la DT, modifiée ensuite par un autre compte ; son séjour a des infos.
        jdbc.update("INSERT INTO sortie (nom, date_debut, date_fin) VALUES ('Port-Cros', DATE '2027-06-10', DATE '2027-06-13')");
        long portCros = jdbc.queryForObject("SELECT id FROM sortie WHERE nom = 'Port-Cros'", Long.class);
        jdbc.update("INSERT INTO revision_audit (id, horodatage, acteur) VALUES (1, 0, 'dt@club.fr'), (2, 1, 'autre@club.fr')");
        jdbc.update("INSERT INTO sortie_aud (rev, revtype, id, nom) VALUES (1, 0, ?, 'Port-Cros'), (2, 1, ?, 'Port-Cros')",
                portCros, portCros);
        jdbc.update("INSERT INTO sejour (sortie_id, infos_pratiques) VALUES (?, 'Urgences : 112')", portCros);
        // Saisie sans historique, sans ligne de séjour.
        jdbc.update("INSERT INTO sortie (nom, date_debut, date_fin) VALUES ('Carrière', DATE '2027-05-01', DATE '2027-05-01')");
        long carriere = jdbc.queryForObject("SELECT id FROM sortie WHERE nom = 'Carrière'", Long.class);

        List<Map<String, Object>> sortiesAvant = jdbc.queryForList("SELECT * FROM sortie ORDER BY id");

        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("80").load().migrate();

        assertThat(jdbc.queryForList("SELECT * FROM sortie ORDER BY id")).isEqualTo(sortiesAvant);
        Map<String, Object> sejour = jdbc.queryForMap("SELECT * FROM sejour WHERE sortie_id = ?", portCros);
        assertThat(sejour.get("INFOS_PRATIQUES")).isEqualTo("Urgences : 112");
        assertThat(((Number) sejour.get("CREATEUR_ID")).longValue()).isEqualTo(dt).isNotEqualTo(autre);
        assertThat(jdbc.queryForObject("SELECT createur_id FROM sejour WHERE sortie_id = ?", Long.class, carriere)).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sejour_organisateur", Integer.class)).isZero();
        jdbc.execute("DROP ALL OBJECTS");
    }
}
