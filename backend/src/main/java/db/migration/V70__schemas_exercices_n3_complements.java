package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;

/**
 * Schémas des 43 exercices du N3 PA40 | PE60 que V62 n'illustrait pas, pour
 * que chaque exercice ait le sien. Rangés dans {@code db/schemas/n3/} et
 * dessinés par l'outil de test
 * {@code fr.club.plongee.outils.SchemasExercicesN3Complements}. Un exercice
 * qui a déjà un schéma (déposé depuis l'écran d'admin) le garde.
 *
 * <p>Ensuite, les schémas se remplacent depuis /admin/exercices : ne pas
 * retoucher ce fichier ni les images une fois appliqué.
 */
public class V70__schemas_exercices_n3_complements extends BaseJavaMigration {

    /** Numéros des exercices illustrés ; l'image est {@code <numéro>.png}. */
    static final List<String> SCHEMAS = List.of(
            "1.1", "1.2", "1.3", "1.4", "1.5", "1.7", "1.8", "1.9",
            "2.1", "2.2", "2.3", "2.5", "2.8", "2.9",
            "3.1", "3.3", "3.4", "3.6", "3.8",
            "4.2", "4.3", "4.5", "4.9",
            "5.1", "5.2", "5.3", "5.4", "5.6", "5.7", "5.8", "5.9",
            "6.1", "6.2", "6.3", "6.5", "6.6",
            "7.1", "7.2", "7.3", "7.5", "7.6", "7.7", "7.9");

    @Override
    public void migrate(Context context) throws Exception {
        Connection connexion = context.getConnection();
        try (PreparedStatement chercher = connexion.prepareStatement("""
                     SELECT e.id FROM exercice_competence e
                       JOIN bloc_competence b ON b.id = e.bloc_id
                       JOIN referentiel r ON r.id = b.referentiel_id
                      WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND e.numero = ?
                        AND NOT EXISTS (SELECT 1 FROM schema_exercice s WHERE s.exercice_id = e.id)""");
             PreparedStatement inserer = connexion.prepareStatement(
                     "INSERT INTO schema_exercice (exercice_id, contenu, type_contenu) VALUES (?, ?, 'image/png')")) {
            for (String numero : SCHEMAS) {
                chercher.setString(1, numero);
                Long exerciceId = null;
                try (ResultSet ligne = chercher.executeQuery()) {
                    if (ligne.next()) exerciceId = ligne.getLong(1);
                }
                if (exerciceId == null) continue;
                inserer.setLong(1, exerciceId);
                inserer.setBytes(2, image(numero + ".png"));
                inserer.executeUpdate();
            }
        }
    }

    private static byte[] image(String fichier) throws Exception {
        try (InputStream flux = V70__schemas_exercices_n3_complements.class
                .getResourceAsStream("/db/schemas/n3/" + fichier)) {
            if (flux == null) throw new IllegalStateException("Schéma absent : " + fichier);
            return flux.readAllBytes();
        }
    }
}
