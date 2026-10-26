package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * L'organisateur montre sur son téléphone un QR code, valable une minute,
 * qui connecte le participant choisi à son séjour : celui-ci le scanne avec
 * son téléphone et entre sans e-mail ni code, connecté jusqu'à un mois après
 * la fin du séjour.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ConnexionQrCodeSejourTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** {@code jeton} : « Bearer … » pour un compte, sinon le jeton du séjour (en-tête X-Jeton-Sejour), ou null. */
    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
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

    /** Un séjour de trois jours dans {@code dans} jours, créé par {@code dt}. */
    private long sejour(String dt, String nom, LocalDate debut) throws Exception {
        return envoyer("POST", "/api/sorties", dt, """
                {"nom":"%s","dateDebut":"%s","dateFin":"%s"}""".formatted(nom, debut, debut.plusDays(2)), 201)
                .get("id").asLong();
    }

    private long invite(String dt, long sortie, String prenom) throws Exception {
        JsonNode s = envoyer("POST", "/api/sejours/" + sortie + "/participants", dt, """
                {"nom":"Qrcode","prenom":"%s","plongeur":false}""".formatted(prenom), 200);
        for (JsonNode p : s.get("participants")) {
            if (p.get("prenom").asText().equals(prenom)) return p.get("id").asLong();
        }
        throw new AssertionError("participant introuvable");
    }

    private JsonNode qrCode(String dt, long sortie, long participant, int attendu) throws Exception {
        return envoyer("POST", "/api/sejours/" + sortie + "/participants/" + participant + "/qr-code", dt, null, attendu);
    }

    /** L'adresse du QR code : /sejour/{code}#qr={ticket}, le ticket dans le fragment, jamais envoyé au serveur web. */
    private static String[] codeEtTicket(JsonNode qr) {
        Matcher m = Pattern.compile("/sejour/([A-Za-z0-9_-]+)#qr=([A-Za-z0-9_-]+)$").matcher(qr.get("adresse").asText());
        assertThat(m.find()).as(qr.get("adresse").asText()).isTrue();
        return new String[] {m.group(1), m.group(2)};
    }

    private JsonNode scanner(String code, String ticket, int attendu) throws Exception {
        return envoyer("POST", "/api/public/sejour/" + code + "/connexion-qr-code", null,
                "{\"ticket\":\"%s\"}".formatted(ticket), attendu);
    }

    @Test
    @DisplayName("Le QR code de l'organisateur, valable une minute, connecte le participant choisi jusqu'à un mois après le séjour")
    void connecteLeParticipantChoisi() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(PARIS).plusDays(200);
        long sortie = sejour(dt, "Séjour du QR code", debut);
        long nina = invite(dt, sortie, "Nina");
        invite(dt, sortie, "Paul");

        JsonNode qr = qrCode(dt, sortie, nina, 200);
        LocalDateTime expire = LocalDateTime.parse(qr.get("expireLe").asText());
        assertThat(Duration.between(LocalDateTime.now(PARIS), expire)).isBetween(Duration.ofSeconds(50), Duration.ofSeconds(61));
        assertThat(qr.get("modules").size()).isGreaterThan(20);
        String[] ct = codeEtTicket(qr);

        JsonNode connexion = scanner(ct[0], ct[1], 200);
        assertThat(connexion.get("participantId").asLong()).isEqualTo(nina);
        assertThat(LocalDateTime.parse(connexion.get("expireLe").asText()))
                .isEqualTo(debut.plusDays(2).plusMonths(1).atTime(23, 59));
        JsonNode moi = envoyer("GET", "/api/public/sejour/" + ct[0] + "/moi", connexion.get("jeton").asText(), null, 200);
        assertThat(moi.get("moi").get("prenom").asText()).isEqualTo("Nina");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un QR code de connexion ne sert qu'une fois")
    void uneSeuleFois() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code unique", LocalDate.now(PARIS).plusDays(210));
        String[] ct = codeEtTicket(qrCode(dt, sortie, invite(dt, sortie, "Iris"), 200));

        scanner(ct[0], ct[1], 200);
        assertThat(scanner(ct[0], ct[1], 422).get("detail").asText()).contains("demandez-en un nouveau");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un nouveau QR code déconnecte les appareils du participant (un QR code scanné par un autre)")
    void nouveauQrCodeDeconnecte() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code volé", LocalDate.now(PARIS).plusDays(215));
        long zoe = invite(dt, sortie, "Zoé");
        String[] ct = codeEtTicket(qrCode(dt, sortie, zoe, 200));
        String jetonVole = scanner(ct[0], ct[1], 200).get("jeton").asText();

        String[] nouveau = codeEtTicket(qrCode(dt, sortie, zoe, 200));
        envoyer("GET", "/api/public/sejour/" + ct[0] + "/moi", jetonVole, null, 403);
        String jetonZoe = scanner(nouveau[0], nouveau[1], 200).get("jeton").asText();
        envoyer("GET", "/api/public/sejour/" + ct[0] + "/moi", jetonZoe, null, 200);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Les QR codes périmés jamais scannés ne restent pas en base")
    void ticketsPerimesEffaces() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code oublié", LocalDate.now(PARIS).plusDays(225));
        qrCode(dt, sortie, invite(dt, sortie, "Noé"), 200);
        jdbc.update("UPDATE sejour_ticket_qr SET expire_le = ? WHERE participant_id IN "
                + "(SELECT id FROM sejour_participant WHERE sortie_id = ?)", LocalDateTime.now(PARIS).minusSeconds(1), sortie);

        qrCode(dt, sortie, invite(dt, sortie, "Lou"), 200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sejour_ticket_qr WHERE expire_le < ?", Integer.class,
                LocalDateTime.now(PARIS))).isZero();

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un QR code de connexion n'est plus accepté après une minute")
    void perimeApresUneMinute() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code périmé", LocalDate.now(PARIS).plusDays(220));
        String[] ct = codeEtTicket(qrCode(dt, sortie, invite(dt, sortie, "Hugo"), 200));
        jdbc.update("UPDATE sejour_ticket_qr SET expire_le = ? WHERE participant_id IN "
                + "(SELECT id FROM sejour_participant WHERE sortie_id = ?)", LocalDateTime.now(PARIS).minusSeconds(1), sortie);

        assertThat(scanner(ct[0], ct[1], 422).get("detail").asText()).contains("expiré");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un QR code de connexion n'ouvre pas un autre séjour que le sien")
    void pasUnAutreSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code A", LocalDate.now(PARIS).plusDays(230));
        long autre = sejour(dt, "Séjour du QR code B", LocalDate.now(PARIS).plusDays(240));
        String ticket = codeEtTicket(qrCode(dt, sortie, invite(dt, sortie, "Léa"), 200))[1];
        String codeAutre = codeEtTicket(qrCode(dt, autre, invite(dt, autre, "Tom"), 200))[0];

        scanner(codeAutre, ticket, 422);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
        envoyer("DELETE", "/api/sorties/" + autre, dt, null, 204);
    }

    @Test
    @DisplayName("Seuls le créateur et les organisateurs du séjour fabriquent un QR code de connexion")
    void reserveAuxOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code réservé", LocalDate.now(PARIS).plusDays(250));
        long ines = invite(dt, sortie, "Inès");

        qrCode(jeton("e2@club.fr"), sortie, ines, 403);
        qrCode(jeton("presidente@club.fr"), sortie, ines, 403);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Pas de QR code de connexion pour un encadrant : il entre avec son compte")
    void pasPourUnEncadrant() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code encadrant", LocalDate.now(PARIS).plusDays(260));
        long flora = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
        }
        JsonNode s = envoyer("POST", "/api/sejours/" + sortie + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora), 200);
        long participant = s.get("participants").get(0).get("id").asLong();

        assertThat(qrCode(dt, sortie, participant, 422).get("detail").asText()).contains("son compte");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Pas de QR code de connexion plus d'un mois après la fin du séjour")
    void pasApresUnMois() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = sejour(dt, "Séjour du QR code fini", LocalDate.now(PARIS).minusMonths(2));
        long eva = invite(dt, sortie, "Eva");

        assertThat(qrCode(dt, sortie, eva, 422).get("detail").asText()).contains("plus d'un mois");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
