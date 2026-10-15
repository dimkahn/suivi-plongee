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
 * Répétition de la mise en production de V83 (retrait du mail du loueur)
 * sur une base qui a déjà appliqué V82 et dont une voiture porte un mail :
 * Flyway accepte la base (V82 inchangée), retire la colonne, et les
 * voitures et leurs passagers restent tels quels.
 */
class MigrationLocationRetireeTest {

    @Test
    @DisplayName("Une base déjà en V82 passe en V83 sans perdre ses voitures")
    void uneBaseDejaEnV82PasseEnV83() {
        JdbcDataSource base = new JdbcDataSource();
        base.setURL("jdbc:h2:mem:repetition-v83;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("82").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(base);

        // Ce qu'un organisateur a pu saisir pendant que V82 était en production.
        jdbc.update("INSERT INTO sortie (nom, lieu, date_debut, date_fin) VALUES ('Ajaccio', 'Corse', DATE '2027-06-10', DATE '2027-06-13')");
        long sortie = jdbc.queryForObject("SELECT id FROM sortie", Long.class);
        jdbc.update("INSERT INTO sejour_participant (sortie_id, nom, prenom, plongeur) VALUES (?, 'Durand', 'Léo', FALSE)", sortie);
        long leo = jdbc.queryForObject("SELECT id FROM sejour_participant", Long.class);
        jdbc.update("""
                INSERT INTO sejour_voiture (sortie_id, nom, places, conducteur_id, trajet, remarques, location_html)
                VALUES (?, 'Location Hertz', 5, ?, 'Aéroport - gîte', 'Plein à rendre', '<p>Réservation H123</p>')""",
                sortie, leo);
        long voiture = jdbc.queryForObject("SELECT id FROM sejour_voiture", Long.class);
        jdbc.update("INSERT INTO sejour_voiture_passager (voiture_id, participant_id) VALUES (?, ?)", voiture, leo);

        // La mise en production : validation de Flyway comprise (V82 doit être restée identique).
        Flyway.configure().dataSource(base).locations("classpath:db/migration").load().migrate();

        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE LOWER(table_name) = 'sejour_voiture' AND LOWER(column_name) = 'location_html'",
                Integer.class)).isZero();
        List<Map<String, Object>> voitures = jdbc.queryForList("SELECT nom, places, conducteur_id, trajet, remarques FROM sejour_voiture");
        assertThat(voitures).hasSize(1);
        assertThat(voitures.getFirst()).containsEntry("NOM", "Location Hertz").containsEntry("PLACES", 5)
                .containsEntry("CONDUCTEUR_ID", leo).containsEntry("TRAJET", "Aéroport - gîte")
                .containsEntry("REMARQUES", "Plein à rendre");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sejour_voiture_passager", Integer.class)).isEqualTo(1);
        jdbc.execute("DROP ALL OBJECTS");
    }
}
