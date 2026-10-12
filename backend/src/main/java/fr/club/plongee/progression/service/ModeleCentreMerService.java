package fr.club.plongee.progression.service;

import fr.club.plongee.commun.RegleMetierException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.List;

/**
 * Modèle « centre de plongée en mer » : une base d'exercices N1 écrite pour
 * la mer et trois progressions découpées par plongées (N1, N2, N3), dans
 * {@code modeles/centre-mer.sql}. Pas une migration : seule une installation
 * qui forme en stage court l'installe, sur demande d'un admin. Tout ou rien
 * (une transaction), une seule fois.
 */
@Service
public class ModeleCentreMerService {

    static final String SCRIPT = "modeles/centre-mer.sql";

    /** Noms donnés par le script : leur présence dit que le modèle est installé. */
    static final List<String> PROGRESSIONS = List.of(
            "N1 – centre de plongée en mer (6 plongées)",
            "N2 – centre de plongée en mer (8 plongées)",
            "N3 – centre de plongée en mer (10 plongées)");

    private static final String BLOCS_N1 = """
            SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
             WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'""";

    public record EtatModele(boolean installe) {}

    public record ResultatInstallation(int progressions, int exercicesMer, int exercicesDesactives) {}

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    public ModeleCentreMerService(DataSource dataSource, JdbcTemplate jdbc) {
        this.dataSource = dataSource;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public EtatModele etat() {
        return new EtatModele(progressionsInstallees() > 0);
    }

    /**
     * {@code desactiverExercicesPiscineN1} : les exercices N1 de la base du club
     * (V51, pensés pour la piscine) sont désactivés, pour que la fiche de suivi
     * ne propose que ceux de la mer. Réactivables depuis /admin/exercices.
     */
    @Transactional
    public ResultatInstallation installer(boolean desactiverExercicesPiscineN1) {
        if (progressionsInstallees() > 0) {
            throw new RegleMetierException("Le modèle « centre de plongée en mer » est déjà installé : "
                    + "ses progressions figurent dans la liste, modifiez-les depuis cet écran.");
        }
        // La connexion de la transaction en cours : le script et ce qui suit réussissent ou échouent ensemble.
        Connection connexion = DataSourceUtils.getConnection(dataSource);
        try {
            ScriptUtils.executeSqlScript(connexion,
                    new EncodedResource(new ClassPathResource(SCRIPT), StandardCharsets.UTF_8));
        } finally {
            DataSourceUtils.releaseConnection(connexion, dataSource);
        }
        int progressions = progressionsInstallees();
        if (progressions == 0) {
            throw new RegleMetierException("Le modèle n'a pas pu être installé : cette installation n'a aucune "
                    + "des versions du MFT qu'il utilise (N1 PE20, N2 PA20 | PE40, N3 PA40 | PE60).");
        }
        Integer exercicesMer = jdbc.queryForObject("SELECT COUNT(*) FROM exercice_competence"
                + " WHERE numero LIKE 'M%' AND bloc_id IN (" + BLOCS_N1 + ")", Integer.class);
        int desactives = desactiverExercicesPiscineN1
                ? jdbc.update("UPDATE exercice_competence SET actif = FALSE"
                        + " WHERE actif = TRUE AND numero NOT LIKE 'M%' AND bloc_id IN (" + BLOCS_N1 + ")")
                : 0;
        return new ResultatInstallation(progressions, exercicesMer == null ? 0 : exercicesMer, desactives);
    }

    private int progressionsInstallees() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM progression_type WHERE nom IN (?, ?, ?)",
                Integer.class, PROGRESSIONS.toArray());
        return n == null ? 0 : n;
    }
}
