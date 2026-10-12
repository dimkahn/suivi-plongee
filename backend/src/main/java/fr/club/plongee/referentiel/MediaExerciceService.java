package fr.club.plongee.referentiel;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Photos et vidéos d'un exercice de la base (V64). Les photos sont en base,
 * dans une table à part comme les schémas ; les vidéos ne sont que des liens
 * (chaîne du club, fichier publié sous /medias/), jamais des fichiers.
 */
@Service
public class MediaExerciceService {

    public static final int PHOTOS_MAX = 6;
    public static final int VIDEOS_MAX = 5;

    public record PhotoVue(Long id, String legende) {}

    public record VideoVue(Long id, String adresse, String legende) {}

    public record Photo(String typeContenu, byte[] contenu) {}

    /** Nombre de photos et de vidéos d'un exercice. */
    public record Compte(int photos, int videos) {
        public static final Compte AUCUN = new Compte(0, 0);
    }

    private final JdbcTemplate jdbc;
    private final ExerciceCompetenceRepository exercices;

    public MediaExerciceService(JdbcTemplate jdbc, ExerciceCompetenceRepository exercices) {
        this.jdbc = jdbc;
        this.exercices = exercices;
    }

    @Transactional(readOnly = true)
    public List<PhotoVue> photos(Long exerciceId) {
        return jdbc.query("SELECT id, legende FROM photo_exercice WHERE exercice_id = ? ORDER BY ordre, id",
                (rs, i) -> new PhotoVue(rs.getLong(1), rs.getString(2)), exerciceId);
    }

    @Transactional(readOnly = true)
    public List<VideoVue> videos(Long exerciceId) {
        return jdbc.query("SELECT id, adresse, legende FROM video_exercice WHERE exercice_id = ? ORDER BY ordre, id",
                (rs, i) -> new VideoVue(rs.getLong(1), rs.getString(2), rs.getString(3)), exerciceId);
    }

    /** Photos et vidéos des exercices d'une version du MFT ; absents = aucun. */
    @Transactional(readOnly = true)
    public Map<Long, Compte> comptes(Long referentielId) {
        Map<Long, Compte> comptes = new HashMap<>();
        String requete = """
                SELECT m.exercice_id, COUNT(*) FROM %s m
                  JOIN exercice_competence e ON e.id = m.exercice_id
                  JOIN bloc_competence b ON b.id = e.bloc_id
                 WHERE b.referentiel_id = ? GROUP BY m.exercice_id""";
        jdbc.query(requete.formatted("photo_exercice"), rs -> {
            comptes.put(rs.getLong(1), new Compte(rs.getInt(2), 0));
        }, referentielId);
        jdbc.query(requete.formatted("video_exercice"), rs -> {
            Compte avant = comptes.getOrDefault(rs.getLong(1), Compte.AUCUN);
            comptes.put(rs.getLong(1), new Compte(avant.photos(), rs.getInt(2)));
        }, referentielId);
        return comptes;
    }

    @Transactional(readOnly = true)
    public Optional<Photo> lirePhoto(Long exerciceId, Long photoId) {
        return jdbc.query("SELECT type_contenu, contenu FROM photo_exercice WHERE id = ? AND exercice_id = ?",
                (rs, i) -> new Photo(rs.getString(1), rs.getBytes(2)), photoId, exerciceId).stream().findFirst();
    }

    /**
     * Ajoute une photo à la suite. {@code accordPersonnes} : celui qui dépose
     * confirme qu'aucune personne n'est reconnaissable, ou qu'elles ont donné
     * leur accord (le club suit des mineurs).
     */
    @Transactional
    public PhotoVue ajouterPhoto(Long exerciceId, String type, byte[] contenu, String legende, boolean accordPersonnes) {
        verifierExercice(exerciceId);
        if (!accordPersonnes) {
            throw new RegleMetierException("Confirmez que personne n'est reconnaissable sur la photo, ou que les "
                    + "personnes reconnaissables ont donné leur accord (droit à l'image).");
        }
        SchemaExerciceService.verifierImage(contenu, type, "La photo");
        Integer nombre = jdbc.queryForObject("SELECT COUNT(*) FROM photo_exercice WHERE exercice_id = ?",
                Integer.class, exerciceId);
        if (nombre != null && nombre >= PHOTOS_MAX) {
            throw new RegleMetierException("Un exercice a au plus " + PHOTOS_MAX
                    + " photos : retirez-en une avant d'en ajouter.");
        }
        String texte = legende(legende);
        jdbc.update("INSERT INTO photo_exercice (exercice_id, contenu, type_contenu, legende, ordre) VALUES (?, ?, ?, ?, ?)",
                exerciceId, contenu, type, texte, nombre == null ? 0 : nombre);
        Long id = jdbc.queryForObject("SELECT MAX(id) FROM photo_exercice WHERE exercice_id = ?", Long.class, exerciceId);
        return new PhotoVue(id, texte);
    }

    @Transactional
    public void supprimerPhoto(Long exerciceId, Long photoId) {
        if (jdbc.update("DELETE FROM photo_exercice WHERE id = ? AND exercice_id = ?", photoId, exerciceId) == 0) {
            throw new RessourceIntrouvableException("Photo introuvable");
        }
    }

    @Transactional
    public VideoVue ajouterVideo(Long exerciceId, String adresse, String legende) {
        verifierExercice(exerciceId);
        String lien = verifierAdresse(adresse);
        Integer nombre = jdbc.queryForObject("SELECT COUNT(*) FROM video_exercice WHERE exercice_id = ?",
                Integer.class, exerciceId);
        if (nombre != null && nombre >= VIDEOS_MAX) {
            throw new RegleMetierException("Un exercice a au plus " + VIDEOS_MAX
                    + " vidéos : retirez-en une avant d'en ajouter.");
        }
        String texte = legende(legende);
        jdbc.update("INSERT INTO video_exercice (exercice_id, adresse, legende, ordre) VALUES (?, ?, ?, ?)",
                exerciceId, lien, texte, nombre == null ? 0 : nombre);
        Long id = jdbc.queryForObject("SELECT MAX(id) FROM video_exercice WHERE exercice_id = ?", Long.class, exerciceId);
        return new VideoVue(id, lien, texte);
    }

    @Transactional
    public void supprimerVideo(Long exerciceId, Long videoId) {
        if (jdbc.update("DELETE FROM video_exercice WHERE id = ? AND exercice_id = ?", videoId, exerciceId) == 0) {
            throw new RessourceIntrouvableException("Vidéo introuvable");
        }
    }

    private void verifierExercice(Long exerciceId) {
        if (!exercices.existsById(exerciceId)) throw new RessourceIntrouvableException("Exercice introuvable");
    }

    private static String legende(String legende) {
        if (legende == null || legende.isBlank()) return null;
        String texte = legende.trim();
        if (texte.length() > 200) throw new RegleMetierException("La légende fait au plus 200 caractères.");
        return texte;
    }

    /**
     * Une adresse https (chaîne du club, plateforme de vidéos) ou une vidéo
     * publiée par le club sous /medias/ ; rien d'autre n'est ouvert depuis
     * l'appli.
     */
    static String verifierAdresse(String adresse) {
        String lien = adresse == null ? "" : adresse.trim();
        if (lien.isEmpty()) throw new RegleMetierException("Indiquez l'adresse de la vidéo.");
        if (lien.length() > 500) throw new RegleMetierException("L'adresse de la vidéo fait au plus 500 caractères.");
        boolean valide;
        if (lien.startsWith("/medias/")) {
            valide = !lien.contains("..") && !lien.contains("//");
        } else {
            try {
                URI uri = new URI(lien);
                valide = "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
            } catch (Exception e) {
                valide = false;
            }
        }
        if (!valide) {
            throw new RegleMetierException("L'adresse de la vidéo doit commencer par « https:// » "
                    + "(ou « /medias/ » pour une vidéo publiée par le club).");
        }
        return lien;
    }
}
