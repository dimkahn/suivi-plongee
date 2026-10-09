package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;

/**
 * Schémas des exercices du N2 PA20 | PE40 (V59), rangés dans
 * {@code db/schemas/n2/} et dessinés par l'outil de test
 * {@code fr.club.plongee.outils.SchemasExercicesN2} au style de ceux du N1
 * (élève en bleu, moniteur ou équipier en gris). Un schéma pour les
 * exercices où la position dans l'eau compte, pas pour tous.
 *
 * <p>Ensuite, les schémas se remplacent depuis /admin/exercices : ne pas
 * retoucher ce fichier ni les images une fois appliqué.
 */
public class V60__schemas_exercices_n2 extends BaseJavaMigration {

    /** Numéros des exercices illustrés ; l'image est {@code <numéro>.png}. */
    static final List<String> SCHEMAS = List.of(
            "1.3", "1.5", "1.6", "2.1", "2.3", "2.4", "2.9", "3.1", "3.4", "3.6",
            "4.2", "4.8", "5.3", "5.5", "5.8", "6.5", "6.8", "7.2", "7.4", "7.7",
            "8.2", "8.6", "8.7", "9.2", "9.4", "10.3", "10.5", "10.7", "11.1", "11.3", "11.7");

    @Override
    public void migrate(Context context) throws Exception {
        Connection connexion = context.getConnection();
        try (PreparedStatement chercher = connexion.prepareStatement("""
                     SELECT e.id FROM exercice_competence e
                       JOIN bloc_competence b ON b.id = e.bloc_id
                       JOIN referentiel r ON r.id = b.referentiel_id
                      WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND e.numero = ?""");
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
        try (InputStream flux = V60__schemas_exercices_n2.class.getResourceAsStream("/db/schemas/n2/" + fichier)) {
            if (flux == null) throw new IllegalStateException("Schéma absent : " + fichier);
            return flux.readAllBytes();
        }
    }
}
