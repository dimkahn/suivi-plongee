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
 * Répétition de la mise en production de V79 (participant d'un séjour lié à
 * un plongeur d'un groupe) : une base comme celle du club, migrée jusqu'à
 * V78 sans données de démonstration, remplie d'un séjour, de groupes de
 * plongeurs et de frais, puis migrée. Rien de ce qui était saisi ne doit
 * changer, et aucun participant ne doit se trouver lié tout seul.
 */
class MigrationParticipantLieTest {

    @Test
    @DisplayName("V79 ne change rien aux séjours, groupes et frais déjà saisis")
    void lesDonneesSaisiesSontGardees() {
        JdbcDataSource base = new JdbcDataSource();
        base.setURL("jdbc:h2:mem:repetition-v79;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("78").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(base);

        // Ce que le club a pu saisir avant la mise en production.
        jdbc.update("INSERT INTO saison (libelle, date_debut, date_fin, ouverte) VALUES ('Essai V79', DATE '2026-09-01', DATE '2027-08-31', FALSE)");
        long saison = jdbc.queryForObject("SELECT id FROM saison WHERE libelle = 'Essai V79'", Long.class);
        jdbc.update("INSERT INTO eleve (nom, prenom) VALUES ('Berthier', 'Camille')");
        long eleve = jdbc.queryForObject("SELECT id FROM eleve WHERE nom = 'Berthier'", Long.class);
        jdbc.update("INSERT INTO groupe_plongeurs (nom, saison_id, date_creation) VALUES ('Port-Cros', ?, DATE '2026-10-01')", saison);
        long groupe = jdbc.queryForObject("SELECT id FROM groupe_plongeurs", Long.class);
        jdbc.update("""
                INSERT INTO membre_groupe_plongeurs (groupe_id, eleve_id, nom, prenom, aptitude, email)
                VALUES (?, ?, 'Berthier', 'Camille', 'N1', NULL), (?, NULL, 'Roux', 'Inès', 'N2', 'ines@exemple.fr')""",
                groupe, eleve, groupe);
        jdbc.update("INSERT INTO sortie (nom, lieu, date_debut, date_fin) VALUES ('Port-Cros', 'Var', DATE '2027-06-10', DATE '2027-06-13')");
        long sortie = jdbc.queryForObject("SELECT id FROM sortie", Long.class);
        jdbc.update("INSERT INTO sejour (sortie_id, infos_pratiques) VALUES (?, 'Urgences : 112')", sortie);
        jdbc.update("""
                INSERT INTO sejour_participant (sortie_id, eleve_id, nom, prenom, plongeur, telephone, email, regimes,
                       urgence_nom, urgence_telephone, arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero,
                       arrivee_heure_depart, arrivee_lieu_depart, remarques)
                VALUES (?, ?, 'Berthier', 'Camille', TRUE, '0600000000', 'camille@exemple.fr', 'VEGETARIEN',
                       'Hélène', '0611111111', DATE '2027-06-10', TIME '10:35:00', 'AVION', 'AF1234',
                       TIME '09:10:00', 'Paris-Orly', 'Arrive en avion')""", sortie, eleve);
        jdbc.update("""
                INSERT INTO sejour_participant (sortie_id, nom, prenom, plongeur, email)
                VALUES (?, 'Roux', 'Inès', TRUE, 'ines.sejour@exemple.fr'), (?, 'Durand', 'Léo', FALSE, NULL)""",
                sortie, sortie);
        long camille = jdbc.queryForObject("SELECT id FROM sejour_participant WHERE prenom = 'Camille'", Long.class);
        long ines = jdbc.queryForObject("SELECT id FROM sejour_participant WHERE prenom = 'Inès'", Long.class);
        jdbc.update("""
                INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour)
                VALUES (?, 'Gîte', 'HEBERGEMENT', 9000, ?, DATE '2027-06-10')""", sortie, ines);
        long depense = jdbc.queryForObject("SELECT id FROM sejour_depense", Long.class);
        jdbc.update("INSERT INTO sejour_depense_part (depense_id, participant_id, parts) VALUES (?, ?, 1), (?, ?, 2)",
                depense, ines, depense, camille);
        jdbc.update("INSERT INTO sejour_versement (sortie_id, de_id, a_id, montant_centimes) VALUES (?, ?, ?, 2000)",
                sortie, camille, ines);

        String[] tables = {"saison", "eleve", "groupe_plongeurs", "membre_groupe_plongeurs", "sortie", "sejour",
                "sejour_participant", "sejour_depense", "sejour_depense_part", "sejour_versement"};
        Map<String, List<Map<String, Object>>> avant = new java.util.HashMap<>();
        for (String t : tables) avant.put(t, jdbc.queryForList("SELECT * FROM " + t + " ORDER BY 1"));

        // La mise en production.
        Flyway.configure().dataSource(base).locations("classpath:db/migration").target("79").load().migrate();

        // Tout est là, à l'identique ; les participants n'ont qu'une colonne de plus, vide.
        for (String t : tables) {
            List<Map<String, Object>> apres = jdbc.queryForList("SELECT * FROM " + t + " ORDER BY 1");
            if (t.equals("sejour_participant")) {
                assertThat(apres).allSatisfy(ligne -> assertThat(ligne.get("MEMBRE_GROUPE_ID")).isNull());
                apres.forEach(ligne -> ligne.remove("MEMBRE_GROUPE_ID"));
            }
            assertThat(apres).as("table " + t).isEqualTo(avant.get(t));
        }
        jdbc.execute("DROP ALL OBJECTS");
    }
}
