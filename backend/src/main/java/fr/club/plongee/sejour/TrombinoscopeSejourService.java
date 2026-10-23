package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.materiel.service.PhotoPretService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Le trombinoscope d'un séjour : chaque participant avec son groupe de
 * plongeurs, pour reconnaître les visages d'un groupe. Lu par les
 * encadrants seulement (le contrôleur le vérifie). La photo vient du
 * dossier élève, sinon du compte d'encadrant, et jamais sans le droit à
 * l'image de ce dossier ou de ce compte : retirer le consentement supprime
 * la photo, elle disparaît donc aussi d'ici. Un invité, sans dossier ni
 * compte, a sa photo propre au séjour (V99_4), déposée par un organisateur
 * avec son accord et effacée après le séjour.
 */
@Service
@Transactional(readOnly = true)
public class TrombinoscopeSejourService {

    /**
     * {@code groupe} : le nom du groupe de plongeurs du participant, null
     * hors groupe ; {@code aptitude} : son niveau dans ce groupe ;
     * {@code invite} : ni dossier élève ni compte, sa photo se dépose dans
     * le séjour.
     */
    public record LigneTrombinoscopeSejour(Long participantId, String nom, String prenom, boolean plongeur,
                                           String groupe, String aptitude, boolean aPhoto, boolean invite) {}

    /** Le contenu d'une photo et son type (image/jpeg ou image/png). */
    public record Photo(byte[] contenu, String type) {}

    /** Le dossier élève du participant : lié directement, sinon par son compte. */
    private static final String DOSSIER = "(e.id = p.eleve_id OR (p.eleve_id IS NULL AND e.utilisateur_id = p.utilisateur_id))";

    /**
     * La photo d'un participant, si son dossier ou son compte a le droit à
     * l'image : celle du dossier élève (lié directement ou par son compte),
     * sinon, sans dossier élève, celle du compte d'encadrant ; sans l'un ni
     * l'autre, celle déposée dans le séjour. Un dossier élève sans droit à
     * l'image l'emporte donc sur le compte (un moniteur stagiaire mineur,
     * par exemple).
     */
    private static final String PHOTO = """
            CASE WHEN EXISTS (SELECT 1 FROM eleve e WHERE %2$s)
              THEN (SELECT pe.%1$s FROM photo_eleve pe JOIN eleve e ON e.id = pe.eleve_id
                     WHERE e.autorisation_image AND %2$s FETCH FIRST 1 ROWS ONLY)
              WHEN p.utilisateur_id IS NOT NULL
              THEN (SELECT pu.%1$s FROM photo_utilisateur pu JOIN utilisateur u ON u.id = pu.utilisateur_id
                     WHERE u.autorisation_image AND u.id = p.utilisateur_id)
              WHEN %3$s
              THEN (SELECT ps.%1$s FROM sejour_participant_photo ps WHERE ps.participant_id = p.id)
            END""";

    /**
     * Ni dossier élève ni compte, ni directement ni par le plongeur du
     * groupe auquel il est lié : un invité.
     */
    private static final String INVITE = "(p.utilisateur_id IS NULL AND NOT EXISTS (SELECT 1 FROM eleve e WHERE "
            + DOSSIER + ") AND NOT EXISTS (SELECT 1 FROM membre_groupe_plongeurs m WHERE m.id = p.membre_groupe_id"
            + " AND (m.eleve_id IS NOT NULL OR m.utilisateur_id IS NOT NULL)))";

    /**
     * Supprime la photo de séjour de qui n'est plus un invité (lié depuis à
     * un dossier ou à un compte) : seul son droit à l'image compte alors, et
     * la photo ne doit pas revenir s'il est délié. À lancer après toute
     * liaison (fiche du participant, « Inscrire un groupe », groupe modifié).
     */
    public static final String OUBLIER_PHOTOS_DES_NON_INVITES = """
            DELETE FROM sejour_participant_photo WHERE participant_id IN (
                SELECT p.id FROM sejour_participant p WHERE NOT %s)""".formatted(INVITE);

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
                       %s AS type_photo, CASE WHEN %s THEN TRUE ELSE FALSE END AS invite
                  FROM sejour_participant p
                  LEFT JOIN membre_groupe_plongeurs m ON m.id = p.membre_groupe_id
                  LEFT JOIN groupe_plongeurs g ON g.id = m.groupe_id
                 WHERE p.sortie_id = :sortie
                 ORDER BY LOWER(p.nom), LOWER(p.prenom), p.id""".formatted(PHOTO.formatted("type_contenu", DOSSIER, INVITE), INVITE),
                new MapSqlParameterSource("sortie", sortieId),
                (rs, i) -> new LigneTrombinoscopeSejour(rs.getLong("id"), rs.getString("nom"), rs.getString("prenom"),
                        rs.getBoolean("plongeur"), rs.getString("groupe"), rs.getString("aptitude"),
                        rs.getString("type_photo") != null, rs.getBoolean("invite")));
    }

    /** Vide si le participant n'est pas du séjour, n'a pas de photo ou pas le droit à l'image. */
    public Optional<Photo> photo(Long sortieId, Long participantId) {
        return jdbc.query("""
                SELECT %s AS contenu, %s AS type_photo
                  FROM sejour_participant p
                 WHERE p.id = :participant AND p.sortie_id = :sortie"""
                        .formatted(PHOTO.formatted("contenu", DOSSIER, INVITE), PHOTO.formatted("type_contenu", DOSSIER, INVITE)),
                new MapSqlParameterSource("sortie", sortieId).addValue("participant", participantId),
                (rs, i) -> rs.getString("type_photo") == null ? null
                        : new Photo(rs.getBytes("contenu"), rs.getString("type_photo")))
                .stream().filter(Objects::nonNull).findFirst();
    }

    /**
     * La photo d'un invité, remplacée par la suivante. {@code accord} :
     * l'organisateur confirme celui de la personne (ou de son responsable
     * légal si elle est mineure) ; sans lui, 422. Un participant qui a un
     * dossier élève ou un compte a sa photo là, avec son droit à l'image.
     */
    @Transactional
    public void deposer(Long sortieId, Long participantId, boolean accord, byte[] contenu, String type, Long auteur) {
        invite(sortieId, participantId);
        if (!accord) {
            throw new RegleMetierException("Cochez l'accord de la personne (ou de son responsable légal "
                    + "si elle est mineure) avant d'ajouter sa photo.");
        }
        PhotoPretService.verifierImage(contenu, type);
        var p = new MapSqlParameterSource("p", participantId);
        jdbc.update("DELETE FROM sejour_participant_photo WHERE participant_id = :p", p);
        jdbc.update("""
                INSERT INTO sejour_participant_photo (participant_id, contenu, type_contenu, accord_par_utilisateur_id)
                VALUES (:p, :contenu, :type, :auteur)""",
                p.addValue("contenu", contenu).addValue("type", type).addValue("auteur", auteur));
    }

    /** Retirer la photo, c'est retirer l'accord : rien n'est gardé. */
    @Transactional
    public void retirer(Long sortieId, Long participantId) {
        invite(sortieId, participantId);
        jdbc.update("DELETE FROM sejour_participant_photo WHERE participant_id = :p",
                new MapSqlParameterSource("p", participantId));
    }

    /**
     * Chaque nuit, à 3 h 40 (heure du club) : les photos d'invités des
     * séjours finis, et celles d'invités liés depuis à un dossier par leur
     * groupe de plongeurs (déjà masquées à l'écran).
     */
    @Scheduled(cron = "0 40 3 * * *", zone = "Europe/Paris")
    @Transactional
    public void effacerChaqueNuit() {
        effacerApresLeSejour(Calendrier.aujourdhui());
        jdbc.update(OUBLIER_PHOTOS_DES_NON_INVITES, Map.of());
    }

    /**
     * La photo d'un invité ne sert que pendant le séjour : effacée le
     * lendemain de sa fin, ou du retour de l'invité s'il rentre plus tard,
     * comme les attestations d'assurance. Renvoie le nombre de photos effacées.
     */
    @Transactional
    public int effacerApresLeSejour(LocalDate aujourdhui) {
        return jdbc.update("""
                DELETE FROM sejour_participant_photo WHERE participant_id IN (
                    SELECT p.id FROM sejour_participant p JOIN sortie s ON s.id = p.sortie_id
                     WHERE s.date_fin < :jour
                       AND (p.depart_date IS NULL OR p.depart_date < :jour)
                       AND (p.depart_date_arrivee IS NULL OR p.depart_date_arrivee < :jour))""",
                new MapSqlParameterSource("jour", aujourdhui));
    }

    /** 404 hors du séjour, 422 si le participant a un dossier ou un compte. */
    private void invite(Long sortieId, Long participantId) {
        List<Boolean> lignes = jdbc.query("""
                SELECT CASE WHEN %s THEN TRUE ELSE FALSE END FROM sejour_participant p
                 WHERE p.id = :p AND p.sortie_id = :sortie""".formatted(INVITE),
                new MapSqlParameterSource("p", participantId).addValue("sortie", sortieId),
                (rs, i) -> rs.getBoolean(1));
        if (lignes.isEmpty()) throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        if (!lignes.getFirst()) {
            throw new RegleMetierException("Ce participant a un dossier ou un compte au club : sa photo s'y dépose "
                    + "(menu Trombinoscope ou Mon compte), avec son droit à l'image.");
        }
    }
}
