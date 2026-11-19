package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Journal du matériel : le type SIGNALEMENT (« Problème signalé »), un
 * problème constaté par un moniteur pendant une séance, qui bloque les prêts
 * jusqu'à une réparation (demande du club, 2026-11-19).
 *
 * <p>La contrainte sur {@code intervention_equipement.type} a été déclarée
 * sans nom dans V29 : H2 et PostgreSQL lui en ont donné un différent. Migration
 * Java pour la retrouver par son texte dans {@code information_schema}, la
 * supprimer, puis la recréer sous un nom fixe, {@code ck_intervention_type}.
 */
public class V99_17__journal_materiel_probleme_signale extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connexion = context.getConnection();
        List<String> anciennes = new ArrayList<>();
        try (Statement st = connexion.createStatement();
             ResultSet rs = st.executeQuery("""
                     SELECT tc.constraint_name
                       FROM information_schema.table_constraints tc
                       JOIN information_schema.check_constraints cc
                         ON cc.constraint_schema = tc.constraint_schema
                        AND cc.constraint_name = tc.constraint_name
                      WHERE UPPER(tc.table_name) = 'INTERVENTION_EQUIPEMENT'
                        AND tc.constraint_type = 'CHECK'
                        AND cc.check_clause LIKE '%INSPECTION_VISUELLE%'
                     """)) {
            while (rs.next()) anciennes.add(rs.getString(1));
        }
        if (anciennes.isEmpty()) {
            throw new IllegalStateException("Contrainte sur intervention_equipement.type introuvable.");
        }
        try (Statement st = connexion.createStatement()) {
            for (String nom : anciennes) {
                st.execute("ALTER TABLE intervention_equipement DROP CONSTRAINT \"" + nom.replace("\"", "") + "\"");
            }
            st.execute("""
                    ALTER TABLE intervention_equipement ADD CONSTRAINT ck_intervention_type
                        CHECK (type IN ('INSPECTION_VISUELLE', 'REQUALIFICATION', 'REVISION', 'REPARATION',
                                        'REMPLACEMENT_PIECE', 'CONTROLE', 'DESINFECTION', 'INCIDENT', 'SIGNALEMENT'))
                    """);
        }
    }
}
