package fr.club.plongee;

import fr.club.plongee.notification.push.AbonnementPush;
import fr.club.plongee.notification.push.ClesVapid;
import fr.club.plongee.notification.push.EnvoiPush;
import fr.club.plongee.notification.service.ServiceNotification;
import fr.club.plongee.sejour.PurgeAbonnementsPush;
import org.springframework.jdbc.core.JdbcTemplate;
import fr.club.plongee.securite.domain.Utilisateur;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Les notifications du séjour sur le téléphone : chaque participant les
 * active sur son téléphone (page du lien, ou séjour dans l'appli pour un
 * moniteur) ; l'organisateur prévient tout le monde qu'il y a du nouveau,
 * et ceux qui ne les ont pas activées par e-mail s'il le demande. Le service
 * de notification (Google, Apple, Mozilla) est remplacé par une boîte de test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(NotificationsSejourTest.FauxServices.class)
class NotificationsSejourTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    record Pousse(String endpoint, String json) {}

    record Courriel(String adresse, String sujet, String corps) {}

    static final List<Pousse> POUSSES = new ArrayList<>();
    static final List<Courriel> COURRIELS = new ArrayList<>();

    @TestConfiguration
    static class FauxServices {
        @Bean @Primary
        EnvoiPush envoiPushDeTest() {
            return (abonnement, json) -> {
                synchronized (POUSSES) { POUSSES.add(new Pousse(abonnement.endpoint(), json)); }
                return abonnement.endpoint().contains("expire") ? EnvoiPush.Resultat.EXPIRE : EnvoiPush.Resultat.ENVOYE;
            };
        }

        @Bean @Primary
        ServiceNotification notificationDeTest() {
            return new ServiceNotification() {
                @Override public void envoyerLienReinitialisation(Utilisateur u, String jeton) {}
                @Override public void envoyerLienInvitation(Utilisateur u, String jeton) {}
                @Override public boolean envoyerCourriel(String adresse, String sujet, String corps) {
                    synchronized (COURRIELS) { COURRIELS.add(new Courriel(adresse, sujet, corps)); }
                    return true;
                }
            };
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired PurgeAbonnementsPush purge;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        if (jeton != null) {
            requete = jeton.startsWith("Bearer ") ? requete.header("Authorization", jeton)
                    : requete.header("X-Jeton-Sejour", jeton);
        }
        String reponse = mvc.perform(requete.contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long sejour(String dt, String nom, int dans) throws Exception {
        LocalDate debut = LocalDate.now(PARIS).plusDays(dans);
        return envoyer("POST", "/api/sorties", dt, """
                {"nom":"%s","dateDebut":"%s","dateFin":"%s"}""".formatted(nom, debut, debut.plusDays(2)), 201)
                .get("id").asLong();
    }

    private long invite(String dt, long sortie, String prenom, String email) throws Exception {
        JsonNode s = envoyer("POST", "/api/sejours/" + sortie + "/participants", dt, """
                {"nom":"Notif","prenom":"%s","plongeur":false%s}""".formatted(prenom,
                email == null ? "" : ",\"email\":\"" + email + "\""), 200);
        for (JsonNode p : s.get("participants")) {
            if (p.get("prenom").asText().equals(prenom)) return p.get("id").asLong();
        }
        throw new AssertionError("participant introuvable");
    }

    /** Le participant entré par le QR code : l'adresse du séjour et son jeton. */
    private String[] entrer(String dt, long sortie, long participant) throws Exception {
        String adresse = envoyer("POST", "/api/sejours/" + sortie + "/participants/" + participant + "/qr-code", dt,
                null, 200).get("adresse").asText();
        Matcher m = Pattern.compile("/sejour/([A-Za-z0-9_-]+)#qr=([A-Za-z0-9_-]+)$").matcher(adresse);
        assertThat(m.find()).isTrue();
        String jeton = envoyer("POST", "/api/public/sejour/" + m.group(1) + "/connexion-qr-code", null,
                "{\"ticket\":\"%s\"}".formatted(m.group(2)), 200).get("jeton").asText();
        return new String[] {m.group(1), jeton};
    }

    private static String abonnement(String endpoint) {
        String auth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);
        return "{\"endpoint\":\"%s\",\"p256dh\":\"%s\",\"auth\":\"%s\"}".formatted(endpoint, ClesVapid.generer().publique(), auth);
    }

    private List<Pousse> poussesVers(String endpoint) {
        synchronized (POUSSES) {
            return POUSSES.stream().filter(p -> p.endpoint().equals(endpoint)).toList();
        }
    }

    @Test
    @DisplayName("La clé publique des notifications est donnée sans connexion")
    void clePublique() throws Exception {
        String cle = envoyer("GET", "/api/public/notifications/cle", null, null, 200).get("clePublique").asText();
        assertThat(Base64.getUrlDecoder().decode(cle)).hasSize(65);
    }

    @Test
    @DisplayName("Un participant entré par le lien active les notifications et reçoit celle de l'organisateur")
    void participantNotifie() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour des notifications", 200);
        String[] entree = entrer(dt, sortie, invite(dt, sortie, "Nina", null));
        String endpoint = "https://fcm.googleapis.com/fcm/send/nina-" + sortie;

        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1], abonnement(endpoint), 204);
        JsonNode bilan = envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt,
                "{\"message\":\"Le rendez-vous de samedi change\",\"emailSinon\":false}", 200);

        assertThat(bilan.get("notifies").toString()).contains("Nina Notif");
        List<Pousse> recues = poussesVers(endpoint);
        assertThat(recues).hasSize(1);
        JsonNode n = json.readTree(recues.getFirst().json()).get("notification");
        assertThat(n.get("title").asText()).contains("Séjour des notifications");
        assertThat(n.get("body").asText()).contains("Le rendez-vous de samedi change").contains("Ouvrez l'appli");
        assertThat(n.get("data").get("onActionClick").get("default").get("url").asText())
                .isEqualTo("/sejour/" + entree[0]);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un participant qui désactive les notifications n'en reçoit plus")
    void desactiver() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour des notifications coupées", 205);
        String[] entree = entrer(dt, sortie, invite(dt, sortie, "Paul", null));
        String endpoint = "https://updates.push.services.mozilla.com/wpush/v2/paul-" + sortie;
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1], abonnement(endpoint), 204);

        envoyer("DELETE", "/api/public/sejour/" + entree[0] + "/notifications", entree[1],
                "{\"endpoint\":\"%s\"}".formatted(endpoint), 204);
        JsonNode bilan = envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);

        assertThat(poussesVers(endpoint)).isEmpty();
        assertThat(bilan.get("sansMoyen").toString()).contains("Paul Notif");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Après « Se déconnecter », le téléphone ne reçoit plus les notifications du séjour")
    void deconnexionCoupe() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour de la déconnexion", 206);
        String[] entree = entrer(dt, sortie, invite(dt, sortie, "Rose", null));
        String endpoint = "https://fcm.googleapis.com/fcm/send/rose-" + sortie;
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1], abonnement(endpoint), 204);

        envoyer("POST", "/api/public/sejour/" + entree[0] + "/deconnexion", entree[1], null, 204);
        envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);

        assertThat(poussesVers(endpoint)).isEmpty();
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un nouveau QR code coupe aussi les notifications des téléphones déconnectés")
    void nouveauQrCodeCoupe() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code et des notifications", 207);
        long sam = invite(dt, sortie, "Sam", null);
        String[] entree = entrer(dt, sortie, sam);
        String endpoint = "https://fcm.googleapis.com/fcm/send/sam-" + sortie;
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1], abonnement(endpoint), 204);

        envoyer("POST", "/api/sejours/" + sortie + "/participants/" + sam + "/qr-code", dt, null, 200);
        envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);

        assertThat(poussesVers(endpoint)).isEmpty();
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un participant garde au plus 5 téléphones abonnés : le plus ancien laisse sa place")
    void cinqTelephonesAuPlus() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour des cinq téléphones", 208);
        String[] entree = entrer(dt, sortie, invite(dt, sortie, "Max", null));
        for (int i = 1; i <= 6; i++) {
            envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1],
                    abonnement("https://fcm.googleapis.com/fcm/send/max" + i + "-" + sortie), 204);
        }

        envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);

        assertThat(poussesVers("https://fcm.googleapis.com/fcm/send/max1-" + sortie)).isEmpty();
        assertThat(poussesVers("https://fcm.googleapis.com/fcm/send/max6-" + sortie)).hasSize(1);
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Chaque jour, les abonnements d'un séjour fini depuis plus de 60 jours sont effacés")
    void purgeQuotidienne() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(PARIS).minusDays(70);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour fini depuis longtemps","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        long participant = invite(dt, sortie, "Ugo", null);
        jdbc.update("INSERT INTO sejour_abonnement_push (participant_id, endpoint, p256dh, auth) VALUES (?, ?, 'p', 'a')",
                participant, "https://fcm.googleapis.com/fcm/send/ugo-" + sortie);

        purge.declencher();

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sejour_abonnement_push WHERE participant_id = ?",
                Integer.class, participant)).isZero();
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Sans notifications activées, le participant est prévenu par e-mail si l'organisateur le demande")
    void parEmailSinon() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour prévenu par e-mail", 210);
        invite(dt, sortie, "Iris", "iris.notif@exemple.fr");
        invite(dt, sortie, "Hugo", null);

        JsonNode bilan = envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt,
                "{\"message\":\"Programme du dimanche ajouté\",\"emailSinon\":true}", 200);

        assertThat(bilan.get("parEmail").toString()).contains("Iris Notif");
        assertThat(bilan.get("sansMoyen").toString()).contains("Hugo Notif");
        Courriel c;
        synchronized (COURRIELS) {
            c = COURRIELS.stream().filter(x -> x.adresse().equals("iris.notif@exemple.fr")).toList().getLast();
        }
        assertThat(c.sujet()).contains("Séjour prévenu par e-mail");
        assertThat(c.corps()).contains("Programme du dimanche ajouté").contains("/sejour/");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un moniteur participant active les notifications dans l'appli ; elles ouvrent le séjour de l'appli")
    void moniteurDansLAppli() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour des notifications moniteur", 215);
        long flora = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
        }
        envoyer("POST", "/api/sejours/" + sortie + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora), 200);
        String endpoint = "https://web.push.apple.com/flora-" + sortie;

        envoyer("PUT", "/api/sejours/" + sortie + "/notifications/abonnement", jeton("e2@club.fr"), abonnement(endpoint), 204);
        envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);

        JsonNode n = json.readTree(poussesVers(endpoint).getFirst().json()).get("notification");
        assertThat(n.get("data").get("onActionClick").get("default").get("url").asText()).isEqualTo("/sejours/" + sortie);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un abonnement que le service de notification dit expiré est oublié")
    void abonnementExpireOublie() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour de l'abonnement expiré", 220);
        String[] entree = entrer(dt, sortie, invite(dt, sortie, "Léa", null));
        String endpoint = "https://fcm.googleapis.com/fcm/send/expire-" + sortie;
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1], abonnement(endpoint), 204);

        envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);
        JsonNode bilan = envoyer("POST", "/api/sejours/" + sortie + "/notifications", dt, "{\"emailSinon\":false}", 200);

        assertThat(poussesVers(endpoint)).hasSize(1);
        assertThat(bilan.get("sansMoyen").toString()).contains("Léa Notif");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Seule l'adresse d'un service de notification connu est acceptée")
    void serviceInconnuRefuse() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour de l'adresse inconnue", 225);
        String[] entree = entrer(dt, sortie, invite(dt, sortie, "Tom", null));

        JsonNode refus = envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1],
                abonnement("https://exemple.fr/espion"), 422);
        assertThat(refus.get("detail").asText()).contains("notification");
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1],
                abonnement("https://fcm.googleapis.com:8443/fcm/send/autre-port"), 422);
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", null,
                abonnement("https://fcm.googleapis.com/fcm/send/sans-jeton"), 403);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("L'organisateur sait, participant par participant, qui a activé les notifications")
    void etatParParticipant() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour des notifications par participant", 235);
        long ines = invite(dt, sortie, "Inès", null);
        long jules = invite(dt, sortie, "Jules", null);
        String[] entree = entrer(dt, sortie, ines);
        envoyer("PUT", "/api/public/sejour/" + entree[0] + "/notifications", entree[1],
                abonnement("https://fcm.googleapis.com/fcm/send/ines-" + sortie), 204);

        JsonNode ids = envoyer("GET", "/api/sejours/" + sortie + "/notifications", dt, null, 200)
                .get("participantIdsAvecNotification");

        assertThat(ids).hasSize(1);
        assertThat(ids.get(0).asLong()).isEqualTo(ines);
        assertThat(ids.toString()).doesNotContain(String.valueOf(jules));
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Seuls le créateur et les organisateurs du séjour envoient une notification")
    void reserveAuxOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour des notifications réservées", 230);
        invite(dt, sortie, "Eva", null);

        envoyer("POST", "/api/sejours/" + sortie + "/notifications", jeton("e2@club.fr"), "{\"emailSinon\":false}", 403);
        envoyer("GET", "/api/sejours/" + sortie + "/notifications", jeton("presidente@club.fr"), null, 403);
        JsonNode etat = envoyer("GET", "/api/sejours/" + sortie + "/notifications", dt, null, 200);
        assertThat(etat.get("sansNotification").toString()).contains("Eva Notif");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
