package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Schémas des exercices du N1 PE20 (V51), découpés exercice par exercice
 * dans le document du club « Niveau 1 FFESSM - Exercices par compétence »
 * et rangés dans {@code db/schemas/n1/}. Migration Java parce qu'une image
 * ne s'écrit pas proprement en SQL pour H2 et PostgreSQL à la fois.
 *
 * <p>Le document n'a de schémas que pour les compétences 1 à 8, et pas
 * pour chaque exercice ; 5.3 et 5.4 partagent le même. Ensuite, les
 * schémas se remplacent depuis /admin/exercices : ne pas retoucher ce
 * fichier ni les images une fois appliqué.
 */
public class V53__schemas_exercices_n1 extends BaseJavaMigration {

    /** Numéro de l'exercice → image dans db/schemas/n1/. */
    private static final Map<String, String> SCHEMAS = new LinkedHashMap<>();

    static {
        for (String numero : new String[] {
                "1.1", "1.2", "1.4", "1.5", "2.2", "2.3", "2.5", "2.6", "3.2", "3.3", "3.7",
                "4.2", "4.3", "4.5", "4.6", "5.1", "5.2", "5.3", "5.5", "5.6",
                "6.2", "6.3", "6.5", "6.6", "7.2", "7.5", "8.1", "8.4", "8.6"}) {
            SCHEMAS.put(numero, numero + ".png");
        }
        SCHEMAS.put("5.4", "5.3.png");
    }

    @Override
    public void migrate(Context context) throws Exception {
        Connection connexion = context.getConnection();
        try (PreparedStatement chercher = connexion.prepareStatement("""
                     SELECT e.id FROM exercice_competence e
                       JOIN bloc_competence b ON b.id = e.bloc_id
                       JOIN referentiel r ON r.id = b.referentiel_id
                      WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND e.numero = ?""");
             PreparedStatement inserer = connexion.prepareStatement(
                     "INSERT INTO schema_exercice (exercice_id, contenu, type_contenu) VALUES (?, ?, 'image/png')")) {
            for (Map.Entry<String, String> schema : SCHEMAS.entrySet()) {
                chercher.setString(1, schema.getKey());
                Long exerciceId = null;
                try (ResultSet ligne = chercher.executeQuery()) {
                    if (ligne.next()) exerciceId = ligne.getLong(1);
                }
                if (exerciceId == null) continue;
                inserer.setLong(1, exerciceId);
                inserer.setBytes(2, image(schema.getValue()));
                inserer.executeUpdate();
            }
        }
    }

    private static byte[] image(String fichier) throws Exception {
        try (InputStream flux = V53__schemas_exercices_n1.class.getResourceAsStream("/db/schemas/n1/" + fichier)) {
            if (flux == null) throw new IllegalStateException("Schéma absent : " + fichier);
            return flux.readAllBytes();
        }
    }
}
