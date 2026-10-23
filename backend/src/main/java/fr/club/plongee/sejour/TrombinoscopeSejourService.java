package fr.club.plongee.sejour;

import fr.club.plongee.formation.service.SortieService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Le trombinoscope d'un séjour : chaque participant avec son groupe de
 * plongeurs, pour reconnaître les visages d'un groupe. Lu par les
 * encadrants seulement (le contrôleur le vérifie). La photo vient du
 * dossier élève, sinon du compte d'encadrant, et jamais sans le droit à
 * l'image de ce dossier ou de ce compte : retirer le consentement supprime
 * la photo, elle disparaît donc aussi d'ici.
 */
@Service
@Transactional(readOnly = true)
public class TrombinoscopeSejourService {

    /**
     * {@code groupe} : le nom du groupe de plongeurs du participant, null
     * hors groupe ; {@code aptitude} : son niveau dans ce groupe.
     */
    public record LigneTrombinoscopeSejour(Long participantId, String nom, String prenom, boolean plongeur,
                                           String groupe, String aptitude, boolean aPhoto) {}

    /** Le contenu d'une photo et son type (image/jpeg ou image/png). */
    public record Photo(byte[] contenu, String type) {}

    /**
     * La photo d'un participant, si son dossier ou son compte a le droit à
     * l'image : celle du dossier élève (lié directement ou par son compte),
     * sinon, sans dossier élève, celle du compte d'encadrant. Un dossier
     * élève sans droit à l'image l'emporte donc sur le compte (un moniteur
     * stagiaire mineur, par exemple).
     */
    private static final String PHOTO = """
            CASE WHEN EXISTS (SELECT 1 FROM eleve e WHERE %2$s)
              THEN (SELECT pe.%1$s FROM photo_eleve pe JOIN eleve e ON e.id = pe.eleve_id
                     WHERE e.autorisation_image AND %2$s FETCH FIRST 1 ROWS ONLY)
              ELSE (SELECT pu.%1$s FROM photo_utilisateur pu JOIN utilisateur u ON u.id = pu.utilisateur_id
                     WHERE u.autorisation_image AND u.id = p.utilisateur_id)
            END""";

    /** Le dossier élève du participant : lié directement, sinon par son compte. */
    private static final String DOSSIER = "(e.id = p.eleve_id OR (p.eleve_id IS NULL AND e.utilisateur_id = p.utilisateur_id))";

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;

    public TrombinoscopeSejourService(NamedParameterJdbcTemplate jdbc, SortieService sorties) {
        this.jdbc = jdbc;
        this.sorties = sorties;
    }

    /** Les participants, rangés par nom puis prénom ; le groupe sert de filtre à l'écran. */
    public List<LigneTrombinoscopeSejour> lister(Long sortieId) {
        sorties.sortie(sortieId);
        return jdbc.query("""
                SELECT p.id, p.nom, p.prenom, p.plongeur, g.nom AS groupe, m.aptitude,
                       %s AS type_photo
                  FROM sejour_participant p
                  LEFT JOIN membre_groupe_plongeurs m ON m.id = p.membre_groupe_id
                  LEFT JOIN groupe_plongeurs g ON g.id = m.groupe_id
                 WHERE p.sortie_id = :sortie
                 ORDER BY LOWER(p.nom), LOWER(p.prenom), p.id""".formatted(PHOTO.formatted("type_contenu", DOSSIER)),
                new MapSqlParameterSource("sortie", sortieId),
                (rs, i) -> new LigneTrombinoscopeSejour(rs.getLong("id"), rs.getString("nom"), rs.getString("prenom"),
                        rs.getBoolean("plongeur"), rs.getString("groupe"), rs.getString("aptitude"),
                        rs.getString("type_photo") != null));
    }

    /** Vide si le participant n'est pas du séjour, n'a pas de photo ou pas le droit à l'image. */
    public Optional<Photo> photo(Long sortieId, Long participantId) {
        return jdbc.query("""
                SELECT %s AS contenu, %s AS type_photo
                  FROM sejour_participant p
                 WHERE p.id = :participant AND p.sortie_id = :sortie"""
                        .formatted(PHOTO.formatted("contenu", DOSSIER), PHOTO.formatted("type_contenu", DOSSIER)),
                new MapSqlParameterSource("sortie", sortieId).addValue("participant", participantId),
                (rs, i) -> rs.getString("type_photo") == null ? null
                        : new Photo(rs.getBytes("contenu"), rs.getString("type_photo")))
                .stream().filter(Objects::nonNull).findFirst();
    }
}
