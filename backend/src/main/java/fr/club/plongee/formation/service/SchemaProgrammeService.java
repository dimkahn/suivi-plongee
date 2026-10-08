package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.referentiel.SchemaExerciceService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Schéma d'un exercice libre du programme d'une séance (table
 * schema_programme). Déposé avant l'enregistrement du programme, qui ne
 * garde que son id : le programme se remplace d'un bloc, le schéma doit
 * donc survivre à la suppression de l'exercice qui le cite. Un schéma
 * que plus aucun exercice ne cite est effacé après un jour.
 */
@Service
public class SchemaProgrammeService {

    /** Délai laissé à un schéma déposé pour être cité par un programme enregistré. */
    private static final int JOURS_AVANT_NETTOYAGE = 1;

    private final JdbcTemplate jdbc;
    private final SeanceRepository seances;

    public SchemaProgrammeService(JdbcTemplate jdbc, SeanceRepository seances) {
        this.jdbc = jdbc;
        this.seances = seances;
    }

    @Transactional(readOnly = true)
    public Optional<SchemaExerciceService.Schema> lire(Long seanceId, Long schemaId) {
        List<SchemaExerciceService.Schema> lignes = jdbc.query(
                "SELECT type_contenu, contenu FROM schema_programme WHERE id = ? AND seance_id = ?",
                (rs, i) -> new SchemaExerciceService.Schema(rs.getString(1), rs.getBytes(2)), schemaId, seanceId);
        return lignes.stream().findFirst();
    }

    /** Enregistre l'image et renvoie son id, à citer dans le programme de la séance. */
    @Transactional
    public long deposer(Long seanceId, String type, byte[] contenu) {
        if (!seances.existsById(seanceId)) throw new RessourceIntrouvableException("Seance introuvable");
        SchemaExerciceService.verifierImage(contenu, type);
        return inserer(seanceId, type, contenu);
    }

    /**
     * Le schéma à citer dans un exercice de la séance : lui-même s'il en
     * vient, sinon une copie (exercices repris d'une autre séance, qui peut
     * disparaître avec ses schémas).
     */
    @Transactional
    public long pourLaSeance(Long schemaId, Long seanceId) {
        List<Long> seance = jdbc.queryForList("SELECT seance_id FROM schema_programme WHERE id = ?",
                Long.class, schemaId);
        if (seance.isEmpty()) throw new RessourceIntrouvableException("Schéma introuvable");
        if (seance.getFirst().equals(seanceId)) return schemaId;
        SchemaExerciceService.Schema s = jdbc.queryForObject(
                "SELECT type_contenu, contenu FROM schema_programme WHERE id = ?",
                (rs, i) -> new SchemaExerciceService.Schema(rs.getString(1), rs.getBytes(2)), schemaId);
        return inserer(seanceId, s.typeContenu(), s.contenu());
    }

    /** Efface les schémas que plus aucun exercice ne cite, déposés depuis plus d'un jour. */
    @Transactional
    public void nettoyer() {
        jdbc.update("""
                DELETE FROM schema_programme s
                 WHERE s.cree_le < ?
                   AND NOT EXISTS (SELECT 1 FROM exercice_seance e WHERE e.schema_id = s.id)""",
                LocalDateTime.now().minusDays(JOURS_AVANT_NETTOYAGE));
    }

    private long inserer(Long seanceId, String type, byte[] contenu) {
        GeneratedKeyHolder cle = new GeneratedKeyHolder();
        jdbc.update(connexion -> {
            PreparedStatement ps = connexion.prepareStatement(
                    "INSERT INTO schema_programme (seance_id, contenu, type_contenu) VALUES (?, ?, ?)",
                    new String[] {"id"});
            ps.setLong(1, seanceId);
            ps.setBytes(2, contenu);
            ps.setString(3, type);
            return ps;
        }, cle);
        return cle.getKey().longValue();
    }
}
