package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;

/**
 * Schémas des exercices du N1 PE20 que le document du club n'illustrait pas
 * (V53 en a chargé 29) : les compétences 9 et 10 entières et les autres
 * exercices sans schéma. Rangés dans {@code db/schemas/n1/} et dessinés par
 * l'outil de test {@code fr.club.plongee.outils.SchemasExercicesN1}, au style
 * de ceux du N2 et du N3. Un exercice qui a déjà un schéma (déposé depuis
 * l'écran d'admin) le garde.
 *
 * <p>Ensuite, les schémas se remplacent depuis /admin/exercices : ne pas
 * retoucher ce fichier ni les images une fois appliqué.
 */
public class V66__schemas_exercices_n1_complements extends BaseJavaMigration {

    /** Numéros des exercices illustrés ; l'image est {@code <numéro>.png}. */
    static final List<String> SCHEMAS = List.of(
            "1.3", "1.6", "1.7", "1.8", "1.9",
            "2.1", "2.4", "2.7", "2.8", "2.9",
            "3.1", "3.4", "3.5", "3.6", "3.8", "3.9",
            "4.1", "4.4", "4.7", "4.8", "4.9",
            "5.7", "5.8", "5.9",
            "6.1", "6.4", "6.7", "6.8", "6.9",
            "7.1", "7.3", "7.4", "7.6", "7.7", "7.8", "7.9",
            "8.2", "8.3", "8.5", "8.7", "8.8", "8.9",
            "9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9",
            "10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9");

    @Override
    public void migrate(Context context) throws Exception {
        Connection connexion = context.getConnection();
        try (PreparedStatement chercher = connexion.prepareStatement("""
                     SELECT e.id FROM exercice_competence e
                       JOIN bloc_competence b ON b.id = e.bloc_id
                       JOIN referentiel r ON r.id = b.referentiel_id
                      WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND e.numero = ?
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
        try (InputStream flux = V66__schemas_exercices_n1_complements.class
                .getResourceAsStream("/db/schemas/n1/" + fichier)) {
            if (flux == null) throw new IllegalStateException("Schéma absent : " + fichier);
            return flux.readAllBytes();
        }
    }
}
