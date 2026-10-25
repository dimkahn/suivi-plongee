package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.formation.service.SortieService.SortieVue;
import fr.club.plongee.materiel.service.PhotoPretService;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * La présentation des journées du programme (V99_10), comme un carnet de
 * voyage (demande du club, 2026) : pour un jour, un titre, le trajet, ce
 * qu'on y verra, un conseil, l'hébergement, et quelques photos des lieux.
 * Les rendez-vous du jour restent à part (sejour_evenement). Écrite par les
 * organisateurs (contrôleur), lue par tous ceux qui lisent le séjour.
 * <p>
 * Photos de lieux seulement : l'écran le rappelle, aucune photo de personne
 * (le droit à l'image passe par le trombinoscope).
 */
@Service
public class JourneesSejourService {

    static final int PHOTOS_MAX_PAR_JOURNEE = 4;

    /** {@code photos} : leurs ids, dans l'ordre d'ajout. */
    public record JourneeVue(LocalDate jour, String titre, String trajet, String descriptif, String conseil,
                             String hebergement, List<Long> photos) {}

    public record DemandeJournee(@Size(max = 160) String titre, @Size(max = 300) String trajet,
                                 @Size(max = 4000) String descriptif, @Size(max = 2000) String conseil,
                                 @Size(max = 300) String hebergement) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;

    public JourneesSejourService(NamedParameterJdbcTemplate jdbc, SortieService sorties) {
        this.jdbc = jdbc;
        this.sorties = sorties;
    }

    /** Les journées présentées, dans l'ordre des jours. */
    @Transactional(readOnly = true)
    public List<JourneeVue> journees(Long sortieId) {
        var id = new MapSqlParameterSource("id", sortieId);
        Map<Long, List<Long>> photos = new HashMap<>();
        jdbc.query("""
                SELECT ph.journee_id, ph.id FROM sejour_journee_photo ph
                  JOIN sejour_journee j ON j.id = ph.journee_id
                 WHERE j.sortie_id = :id ORDER BY ph.id""", id,
                rs -> { photos.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        return jdbc.query("SELECT * FROM sejour_journee WHERE sortie_id = :id ORDER BY jour", id,
                (rs, i) -> new JourneeVue(rs.getObject("jour", LocalDate.class), rs.getString("titre"),
                        rs.getString("trajet"), rs.getString("descriptif"), rs.getString("conseil"),
                        rs.getString("hebergement"), photos.getOrDefault(rs.getLong("id"), List.of())));
    }

    /** Crée ou remplace la présentation du jour ; ses photos restent. */
    @Transactional
    public void definir(Long sortieId, LocalDate jour, DemandeJournee d) {
        verifierJour(sortieId, jour);
        var p = new MapSqlParameterSource("sortie", sortieId).addValue("jour", jour)
                .addValue("titre", nettoyer(d.titre())).addValue("trajet", nettoyer(d.trajet()))
                .addValue("descriptif", nettoyer(d.descriptif())).addValue("conseil", nettoyer(d.conseil()))
                .addValue("hebergement", nettoyer(d.hebergement()));
        if (jdbc.update("""
                UPDATE sejour_journee SET titre = :titre, trajet = :trajet, descriptif = :descriptif,
                       conseil = :conseil, hebergement = :hebergement
                 WHERE sortie_id = :sortie AND jour = :jour""", p) == 0) {
            jdbc.update("""
                    INSERT INTO sejour_journee (sortie_id, jour, titre, trajet, descriptif, conseil, hebergement)
                    VALUES (:sortie, :jour, :titre, :trajet, :descriptif, :conseil, :hebergement)""", p);
        }
    }

    /** La présentation du jour et ses photos ; les rendez-vous du jour restent. */
    @Transactional
    public void supprimer(Long sortieId, LocalDate jour) {
        jdbc.update("DELETE FROM sejour_journee WHERE id = :j",
                new MapSqlParameterSource("j", journeeDe(sortieId, jour)));
    }

    /** Une photo pour un jour pas encore présenté crée sa journée, vide. */
    @Transactional
    public void ajouterPhoto(Long sortieId, LocalDate jour, byte[] contenu, String type) {
        PhotoPretService.verifierImage(contenu, type);
        verifierJour(sortieId, jour);
        jdbc.update("""
                INSERT INTO sejour_journee (sortie_id, jour)
                SELECT :sortie, :jour WHERE NOT EXISTS
                       (SELECT 1 FROM sejour_journee WHERE sortie_id = :sortie AND jour = :jour)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("jour", jour));
        long journee = journeeDe(sortieId, jour);
        var j = new MapSqlParameterSource("j", journee);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM sejour_journee_photo WHERE journee_id = :j", j, Integer.class)
                >= PHOTOS_MAX_PAR_JOURNEE) {
            throw new RegleMetierException("Pas plus de " + PHOTOS_MAX_PAR_JOURNEE
                    + " photos par journée : retirez-en une d'abord.");
        }
        jdbc.update("INSERT INTO sejour_journee_photo (journee_id, contenu, type_contenu) VALUES (:j, :contenu, :type)",
                j.addValue("contenu", contenu).addValue("type", type));
    }

    @Transactional
    public void supprimerPhoto(Long sortieId, LocalDate jour, Long photoId) {
        if (jdbc.update("DELETE FROM sejour_journee_photo WHERE id = :p AND journee_id = :j",
                new MapSqlParameterSource("p", photoId).addValue("j", journeeDe(sortieId, jour))) == 0) {
            throw new RessourceIntrouvableException("Photo introuvable");
        }
    }

    @Transactional(readOnly = true)
    public FraisService.ContenuPhoto photo(Long sortieId, LocalDate jour, Long photoId) {
        List<FraisService.ContenuPhoto> photos = jdbc.query("""
                SELECT ph.contenu, ph.type_contenu FROM sejour_journee_photo ph
                  JOIN sejour_journee j ON j.id = ph.journee_id
                 WHERE ph.id = :p AND j.sortie_id = :sortie AND j.jour = :jour""",
                new MapSqlParameterSource("p", photoId).addValue("sortie", sortieId).addValue("jour", jour),
                (rs, i) -> new FraisService.ContenuPhoto(rs.getBytes(1), rs.getString(2)));
        if (photos.isEmpty()) throw new RessourceIntrouvableException("Photo introuvable");
        return photos.getFirst();
    }

    /** Comme un rendez-vous : un jour du séjour, ou un peu avant ou après (voyage). */
    private void verifierJour(Long sortieId, LocalDate jour) {
        SortieVue s = sorties.lire(sortieId);
        if (jour.isBefore(s.dateDebut().minusDays(SejourService.JOURS_AUTOUR_DU_PROGRAMME))
                || jour.isAfter(s.dateFin().plusDays(SejourService.JOURS_AUTOUR_DU_PROGRAMME))) {
            throw new RegleMetierException("Le " + jour.format(Calendrier.DATE_FR)
                    + " est loin des dates de la sortie : vérifiez le jour.");
        }
    }

    private long journeeDe(Long sortieId, LocalDate jour) {
        List<Long> ids = jdbc.queryForList("SELECT id FROM sejour_journee WHERE sortie_id = :sortie AND jour = :jour",
                new MapSqlParameterSource("sortie", sortieId).addValue("jour", jour), Long.class);
        if (ids.isEmpty()) {
            throw new RessourceIntrouvableException("Journée introuvable");
        }
        return ids.getFirst();
    }

    private static String nettoyer(String texte) {
        return texte == null || texte.isBlank() ? null : texte.strip();
    }
}
