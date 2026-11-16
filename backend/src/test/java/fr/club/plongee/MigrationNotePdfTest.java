package fr.club.plongee;

import org.flywaydb.core.Flyway;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Répétition de la mise en production de V99_16 (justificatif en PDF) sur
 * une base en V99_15 dont une dépense a déjà sa photo : la photo garde
 * son type, un PDF est désormais accepté, un autre type toujours refusé.
 */
class MigrationNotePdfTest {

    @Test
    @DisplayName("Une base déjà en V99_15 passe en V99_16 sans perdre les photos des notes")
    void uneBaseEnV99_15PasseEnV99_16() throws Exception {
        JdbcDataSource h2 = new JdbcDataSource();
        h2.setURL("jdbc:h2:mem:repetition-v99-16;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        // Une seule connexion : une contrainte CHECK posée par la session de Flyway
        // ne s'évalue plus une fois cette connexion fermée (H2 2.4 : « base fermée »).
        SingleConnectionDataSource base = new SingleConnectionDataSource(h2.getConnection(), true);
        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("99.15").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(base);

        jdbc.update("INSERT INTO sortie (nom, lieu, date_debut, date_fin) VALUES ('Ajaccio', 'Corse', DATE '2027-06-10', DATE '2027-06-13')");
        long sortie = jdbc.queryForObject("SELECT id FROM sortie", Long.class);
        jdbc.update("""
                INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes)
                VALUES (?, 'Gîte', 'HEBERGEMENT', 30000)""", sortie);
        long depense = jdbc.queryForObject("SELECT id FROM sejour_depense", Long.class);
        jdbc.update("INSERT INTO sejour_depense_photo (depense_id, contenu, type_contenu) VALUES (?, ?, ?)",
                depense, new byte[] {1, 2, 3}, "image/png");

        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("99.16").load().migrate();

        assertThat(jdbc.queryForObject("SELECT type_contenu FROM sejour_depense_photo", String.class))
                .isEqualTo("image/png");
        jdbc.update("INSERT INTO sejour_depense_photo (depense_id, contenu, type_contenu) VALUES (?, ?, ?)",
                depense, new byte[] {4}, "application/pdf");
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO sejour_depense_photo (depense_id, contenu, type_contenu) VALUES (?, ?, ?)",
                depense, new byte[] {5}, "text/html")).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.execute("DROP ALL OBJECTS");
    }
}
