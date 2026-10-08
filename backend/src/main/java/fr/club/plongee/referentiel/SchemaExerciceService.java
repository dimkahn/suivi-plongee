package fr.club.plongee.referentiel;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Schéma d'un exercice de la base (table schema_exercice, à part pour ne
 * jamais alourdir les lectures de la base d'exercices). Une image PNG ou
 * JPEG, vérifiée par sa signature puisqu'elle est resservie telle quelle.
 */
@Service
public class SchemaExerciceService {

    public static final int TAILLE_MAX_OCTETS = 2 * 1024 * 1024;
    private static final Set<String> TYPES = Set.of("image/jpeg", "image/png");

    public record Schema(String typeContenu, byte[] contenu) {}

    private final JdbcTemplate jdbc;
    private final ExerciceCompetenceRepository exercices;

    public SchemaExerciceService(JdbcTemplate jdbc, ExerciceCompetenceRepository exercices) {
        this.jdbc = jdbc;
        this.exercices = exercices;
    }

    @Transactional(readOnly = true)
    public Optional<Schema> lire(Long exerciceId) {
        List<Schema> lignes = jdbc.query(
                "SELECT type_contenu, contenu FROM schema_exercice WHERE exercice_id = ?",
                (rs, i) -> new Schema(rs.getString(1), rs.getBytes(2)), exerciceId);
        return lignes.stream().findFirst();
    }

    /** Exercices d'une version du MFT qui ont un schéma. */
    @Transactional(readOnly = true)
    public Set<Long> exercicesAvecSchema(Long referentielId) {
        return new HashSet<>(jdbc.queryForList("""
                SELECT s.exercice_id FROM schema_exercice s
                  JOIN exercice_competence e ON e.id = s.exercice_id
                  JOIN bloc_competence b ON b.id = e.bloc_id
                 WHERE b.referentiel_id = ?""", Long.class, referentielId));
    }

    @Transactional
    public void enregistrer(Long exerciceId, String type, byte[] contenu) {
        if (!exercices.existsById(exerciceId)) throw new RessourceIntrouvableException("Exercice introuvable");
        verifierImage(contenu, type);
        jdbc.update("DELETE FROM schema_exercice WHERE exercice_id = ?", exerciceId);
        jdbc.update("INSERT INTO schema_exercice (exercice_id, contenu, type_contenu) VALUES (?, ?, ?)",
                exerciceId, contenu, type);
    }

    @Transactional
    public void supprimer(Long exerciceId) {
        jdbc.update("DELETE FROM schema_exercice WHERE exercice_id = ?", exerciceId);
    }

    private static void verifierImage(byte[] contenu, String type) {
        if (contenu == null || contenu.length == 0) throw new RegleMetierException("Le fichier est vide.");
        if (contenu.length > TAILLE_MAX_OCTETS) {
            throw new RegleMetierException("Le schéma dépasse la taille maximale de 2 Mo.");
        }
        boolean jpeg = contenu.length > 3 && (contenu[0] & 0xFF) == 0xFF && (contenu[1] & 0xFF) == 0xD8
                && (contenu[2] & 0xFF) == 0xFF;
        boolean png = contenu.length > 8 && (contenu[0] & 0xFF) == 0x89 && contenu[1] == 'P'
                && contenu[2] == 'N' && contenu[3] == 'G';
        if (type == null || !TYPES.contains(type)
                || (type.equals("image/jpeg") && !jpeg) || (type.equals("image/png") && !png)) {
            throw new RegleMetierException("Seules les images JPEG ou PNG sont acceptées.");
        }
    }
}
