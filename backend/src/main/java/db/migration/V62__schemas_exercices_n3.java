package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;

/**
 * Schémas des exercices du N3 PA40 | PE60 (V61), rangés dans
 * {@code db/schemas/n3/} et dessinés par l'outil de test
 * {@code fr.club.plongee.outils.SchemasExercicesN3}, au style de ceux du N1
 * et du N2. Un schéma pour les exercices où la position dans l'eau compte.
 *
 * <p>Ensuite, les schémas se remplacent depuis /admin/exercices : ne pas
 * retoucher ce fichier ni les images une fois appliqué.
 */
public class V62__schemas_exercices_n3 extends BaseJavaMigration {

    /** Numéros des exercices illustrés ; l'image est {@code <numéro>.png}. */
    static final List<String> SCHEMAS = List.of(
            "1.6", "2.4", "2.6", "2.7", "3.2", "3.5", "3.7", "3.9", "4.1", "4.4",
            "4.6", "4.7", "4.8", "5.5", "6.4", "6.7", "6.8", "6.9", "7.4", "7.8");

    @Override
    public void migrate(Context context) throws Exception {
        Connection connexion = context.getConnection();
        try (PreparedStatement chercher = connexion.prepareStatement("""
                     SELECT e.id FROM exercice_competence e
                       JOIN bloc_competence b ON b.id = e.bloc_id
                       JOIN referentiel r ON r.id = b.referentiel_id
                      WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND e.numero = ?""");
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
        try (InputStream flux = V62__schemas_exercices_n3.class.getResourceAsStream("/db/schemas/n3/" + fichier)) {
            if (flux == null) throw new IllegalStateException("Schéma absent : " + fichier);
            return flux.readAllBytes();
        }
    }
}
