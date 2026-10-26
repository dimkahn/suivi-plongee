package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.notification.push.AbonnementPush;
import fr.club.plongee.notification.push.ClesVapid;
import fr.club.plongee.notification.push.EnvoiPush;
import fr.club.plongee.notification.service.ServiceNotification;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.time.LocalDate;
import java.util.*;

/**
 * Les notifications du séjour sur le téléphone (Web Push). Chaque
 * participant les active sur son téléphone : par la page du lien (jeton du
 * séjour), ou dans l'appli s'il a un compte (moniteur). L'organisateur
 * prévient alors tout le monde qu'il y a du nouveau, avec un court message
 * s'il le veut : la notification dit d'ouvrir l'appli, et l'ouvre sur le
 * séjour quand on la touche. Ceux qui ne les ont pas activées reçoivent un
 * e-mail, si l'organisateur le demande.
 * <p>
 * Seules sont acceptées les adresses des services de notification des
 * navigateurs (Google, Apple, Mozilla, Microsoft) : le serveur n'envoie
 * rien ailleurs. Un abonnement que le service dit expiré est oublié, comme
 * ceux d'un séjour fini depuis plus de 60 jours.
 */
@Service
public class NotificationsSejourService {

    /** Les services de notification des navigateurs : rien d'autre ne reçoit de requête du serveur. */
    private static final List<String> SERVICES_CONNUS = List.of(
            "fcm.googleapis.com", "android.googleapis.com", "push.apple.com", "push.services.mozilla.com",
            "notify.windows.com");
    static final int LONGUEUR_MAX_MESSAGE = 300;
    static final int JOURS_APRES_LE_SEJOUR = 60;
    static final int TELEPHONES_MAX = 5;

    public record EtatNotificationsVue(List<String> avecNotification, List<String> sansNotification) {}

    /** {@code sansMoyen} : ni notification activée, ni e-mail envoyé. */
    public record BilanNotification(List<String> notifies, List<String> parEmail, List<String> sansMoyen,
                                    List<String> echecs) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final AccesSejourService acces;
    private final EnvoiPush envoi;
    private final ServiceNotification courriels;
    private final IdentiteStructureService identite;
    private final ObjectMapper json;
    private final String urlFrontend;

    public NotificationsSejourService(NamedParameterJdbcTemplate jdbc, AccesSejourService acces, EnvoiPush envoi,
                                      ServiceNotification courriels, IdentiteStructureService identite,
                                      ObjectMapper json, @Value("${app.frontend-url}") String urlFrontend) {
        this.jdbc = jdbc;
        this.acces = acces;
        this.envoi = envoi;
        this.courriels = courriels;
        this.identite = identite;
        this.json = json;
        this.urlFrontend = urlFrontend;
    }

    // ------------------------------------------------------------------
    //  Côté participant
    // ------------------------------------------------------------------

    /** Le téléphone de ce participant reçoit désormais les notifications du séjour (une fois par téléphone). */
    @Transactional
    public void abonner(Long participantId, AbonnementPush a, boolean depuisAppli) {
        verifier(a);
        var p = new MapSqlParameterSource("p", participantId).addValue("endpoint", a.endpoint().trim());
        jdbc.update("DELETE FROM sejour_abonnement_push WHERE participant_id = :p AND endpoint = :endpoint", p);
        jdbc.update("""
                INSERT INTO sejour_abonnement_push (participant_id, endpoint, p256dh, auth, depuis_appli)
                VALUES (:p, :endpoint, :p256dh, :auth, :appli)""",
                p.addValue("p256dh", a.p256dh().trim()).addValue("auth", a.auth().trim()).addValue("appli", depuisAppli));
        // Au plus 5 téléphones : au-delà, le plus ancien laisse sa place (un envoi ne s'allonge pas sans fin).
        List<Long> ids = jdbc.queryForList("SELECT id FROM sejour_abonnement_push WHERE participant_id = :p ORDER BY id DESC",
                p, Long.class);
        if (ids.size() > TELEPHONES_MAX) {
            jdbc.update("DELETE FROM sejour_abonnement_push WHERE id IN (:ids)",
                    new MapSqlParameterSource("ids", ids.subList(TELEPHONES_MAX, ids.size())));
        }
    }

    @Transactional
    public void desabonner(Long participantId, String endpoint) {
        if (endpoint == null) return;
        jdbc.update("DELETE FROM sejour_abonnement_push WHERE participant_id = :p AND endpoint = :endpoint",
                new MapSqlParameterSource("p", participantId).addValue("endpoint", endpoint.trim()));
    }

    // ------------------------------------------------------------------
    //  Côté organisateur
    // ------------------------------------------------------------------

    /** Qui recevra une notification, et qui ne l'a pas activée. */
    @Transactional(readOnly = true)
    public EtatNotificationsVue etat(Long sortieId) {
        List<String> avec = new ArrayList<>(), sans = new ArrayList<>();
        for (Destinataire d : destinataires(sortieId)) {
            (d.abonnements().isEmpty() ? sans : avec).add(d.nom());
        }
        return new EtatNotificationsVue(avec, sans);
    }

    /** Prévient chaque participant qu'il y a du nouveau : notification, sinon e-mail si {@code emailSinon}. */
    @Transactional
    public BilanNotification prevenir(Long sortieId, String message, boolean emailSinon) {
        String texte = message == null ? "" : message.trim();
        if (texte.length() > LONGUEUR_MAX_MESSAGE) {
            throw new RegleMetierException("Le message est trop long (" + LONGUEUR_MAX_MESSAGE + " caractères au plus).");
        }
        String code = acces.codeFrais(sortieId);
        AccesSejourService.EnteteVue sejour = acces.entete(code);
        List<String> notifies = new ArrayList<>(), parEmail = new ArrayList<>(), sansMoyen = new ArrayList<>(),
                echecs = new ArrayList<>();
        for (Destinataire d : destinataires(sortieId)) {
            boolean recu = false;
            for (Abonnement a : d.abonnements()) {
                String adresse = a.depuisAppli() ? "/sejours/" + sortieId : "/sejour/" + code;
                EnvoiPush.Resultat r = envoi.envoyer(a.push(), charge(sejour.nom(), texte, adresse));
                if (r == EnvoiPush.Resultat.ENVOYE) recu = true;
                if (r == EnvoiPush.Resultat.EXPIRE) {
                    jdbc.update("DELETE FROM sejour_abonnement_push WHERE id = :id", new MapSqlParameterSource("id", a.id()));
                }
            }
            if (recu) {
                notifies.add(d.nom());
            } else if (emailSinon && !SejourService.blanc(d.email())) {
                String lien = urlFrontend + (d.encadrant() ? "/sejours/" + sortieId : "/sejour/" + code);
                String corps = "Bonjour " + d.prenom() + ",\n\n"
                        + "Il y a de nouvelles informations sur le séjour « " + sejour.nom() + " »"
                        + (texte.isEmpty() ? "." : " :\n\n" + texte) + "\n\n"
                        + "Ouvrez l'appli pour les voir :\n" + lien + "\n\n" + identite.nom() + "\n";
                if (courriels.envoyerCourriel(d.email().trim(), "Nouvelles informations — " + sejour.nom(), corps)) {
                    parEmail.add(d.nom());
                } else {
                    echecs.add(d.nom());
                }
            } else if (!d.abonnements().isEmpty()) {
                echecs.add(d.nom());
            } else {
                sansMoyen.add(d.nom());
            }
        }
        return new BilanNotification(notifies, parEmail, sansMoyen, echecs);
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    private record Abonnement(long id, AbonnementPush push, boolean depuisAppli) {}

    /** {@code nom} : prénom et nom, comme dans les bilans d'envoi. */
    private record Destinataire(long id, String prenom, String nom, String email, boolean encadrant,
                                List<Abonnement> abonnements) {}

    private List<Destinataire> destinataires(Long sortieId) {
        var s = new MapSqlParameterSource("sortie", sortieId);
        Map<Long, List<Abonnement>> parParticipant = new HashMap<>();
        jdbc.query("""
                SELECT a.id, a.participant_id, a.endpoint, a.p256dh, a.auth, a.depuis_appli
                  FROM sejour_abonnement_push a JOIN sejour_participant p ON p.id = a.participant_id
                 WHERE p.sortie_id = :sortie ORDER BY a.id""", s, rs -> {
            parParticipant.computeIfAbsent(rs.getLong(2), k -> new ArrayList<>()).add(new Abonnement(rs.getLong(1),
                    new AbonnementPush(rs.getString(3), rs.getString(4), rs.getString(5)), rs.getBoolean(6)));
        });
        return jdbc.query("""
                SELECT p.id, p.prenom, p.nom, p.email, CASE WHEN %s THEN 1 ELSE 0 END
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie ORDER BY LOWER(p.nom), LOWER(p.prenom)"""
                        .formatted(AccesSejourService.EST_ENCADRANT), s,
                (rs, i) -> new Destinataire(rs.getLong(1), rs.getString(2), rs.getString(2) + " " + rs.getString(3),
                        rs.getString(4), rs.getInt(5) == 1, parParticipant.getOrDefault(rs.getLong(1), List.of())));
    }

    /** Le message pour le service worker d'Angular : titre, texte, et le séjour à ouvrir quand on le touche. */
    private String charge(String nomSejour, String message, String adresse) {
        String corps = (message.isEmpty() ? "Nouvelles informations sur le séjour." : message)
                + " Ouvrez l'appli pour " + (message.isEmpty() ? "les voir." : "voir.");
        Map<String, Object> notification = new LinkedHashMap<>();
        notification.put("title", nomSejour);
        notification.put("body", corps);
        notification.put("icon", "/icones/icone-192.png");
        notification.put("tag", "sejour-" + adresse);
        notification.put("data", Map.of("onActionClick", Map.of("default",
                Map.of("operation", "navigateLastFocusedOrOpen", "url", adresse))));
        return json.writeValueAsString(Map.of("notification", notification));
    }

    private static void verifier(AbonnementPush a) {
        String refus = "Ce téléphone n'a pas donné une adresse de notification reconnue.";
        if (a == null || a.endpoint() == null || a.p256dh() == null || a.auth() == null) throw new RegleMetierException(refus);
        URI u;
        try {
            u = URI.create(a.endpoint().trim());
        } catch (IllegalArgumentException e) {
            throw new RegleMetierException(refus);
        }
        String hote = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
        boolean connu = SERVICES_CONNUS.stream().anyMatch(s -> hote.equals(s) || hote.endsWith("." + s));
        boolean port = u.getPort() == -1 || u.getPort() == 443;
        if (!"https".equals(u.getScheme()) || !connu || !port || a.endpoint().length() > 1000) {
            throw new RegleMetierException(refus);
        }
        try {
            ClesVapid.verifierClePublique(Base64.getUrlDecoder().decode(a.p256dh().trim()));
            if (Base64.getUrlDecoder().decode(a.auth().trim()).length != 16) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new RegleMetierException(refus);
        }
    }

    /** Les abonnements d'un séjour fini depuis plus de 60 jours ne servent plus (chaque nuit, PurgeAbonnementsPush). */
    @Transactional
    public void oublierAnciens(LocalDate aujourdhui) {
        jdbc.update("""
                DELETE FROM sejour_abonnement_push WHERE participant_id IN (
                  SELECT p.id FROM sejour_participant p JOIN sortie so ON so.id = p.sortie_id
                   WHERE COALESCE(so.date_fin, so.date_debut) < :limite)""",
                new MapSqlParameterSource("limite", aujourdhui.minusDays(JOURS_APRES_LE_SEJOUR)));
    }
}
