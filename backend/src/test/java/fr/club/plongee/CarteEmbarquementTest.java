package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La carte d'embarquement d'un voyage du séjour (demande du club, 2026) :
 * un PDF ou une photo, ajoutée par le voyageur (dans l'appli ou par le
 * lien) ou par un organisateur. Comme le numéro de dossier, seuls le
 * voyageur et les organisateurs la lisent.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(FraisParticipantsTest.BoiteAuxLettres.class)
class CarteEmbarquementTest {

    private static final byte[] PDF = "%PDF-1.4\n%fausse carte\n".getBytes(StandardCharsets.US_ASCII);
    /** Une image PNG minimale : la signature suffit au contrôle du serveur. */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    private static final LocalDate AUJOURDHUI = LocalDate.now(ZoneId.of("Europe/Paris"));

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** {@code jeton} : « Bearer … » pour un compte, sinon le jeton du lien (en-tête X-Jeton-Sejour), ou null. */
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

    private JsonNode deposer(String url, String jeton, String nom, String type, byte[] contenu, int attendu)
            throws Exception {
        MockMultipartHttpServletRequestBuilder requete = multipart(url)
                .file(new MockMultipartFile("fichier", nom, type, contenu));
        requete.header(jeton.startsWith("Bearer ") ? "Authorization" : "X-Jeton-Sejour", jeton);
        String reponse = mvc.perform(requete).andExpect(status().is(attendu))
                .andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private JsonNode participant(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p;
        throw new AssertionError(prenom + " absent du séjour");
    }

    private long eleveCamille(String jeton) throws Exception {
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", jeton, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) return p.get("eleveId").asLong();
        }
        throw new AssertionError("Camille introuvable");
    }

    /** Un séjour du DT (e3) avec Camille (compte élève) et Léo (sans compte), chacun en avion à l'aller. */
    private String sejour(String dt, int dans) throws Exception {
        LocalDate debut = AUJOURDHUI.plusDays(dans);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour Guadeloupe","lieu":"Pointe-à-Pitre","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(8)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true,
                 "arrivee":{"date":"%s","heure":"14:40","transport":"AVION","numero":"TX540"}}"""
                .formatted(eleveCamille(dt), debut), 200);
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Durand","prenom":"Léo","plongeur":false,"email":"leo.carte@exemple.fr",
                 "arrivee":{"date":"%s","heure":"14:40","transport":"AVION","numero":"TX540"}}"""
                .formatted(debut), 200);
        return base;
    }

    @Test
    @DisplayName("Le voyageur ajoute sa carte d'embarquement à son vol, la retrouve, la remplace et la retire")
    void voyageurAjouteSaCarte() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr");
        String base = sejour(dt, 300);
        long moi = participant(envoyer("GET", base, camille, null, 200), "Camille").get("id").asLong();
        String carte = base + "/participants/" + moi + "/cartes-embarquement/ARRIVEE";

        JsonNode s = deposer(carte, camille, "carte TX540.pdf", "application/pdf", PDF, 200);
        assertThat(participant(s, "Camille").get("arrivee").get("carteEmbarquement").asText())
                .isEqualTo("application/pdf");
        mvc.perform(get(carte).header("Authorization", camille))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Security-Policy", "sandbox"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(PDF));

        // Une photo la remplace : une carte par voyage.
        s = deposer(carte, camille, "carte.png", "image/png", PNG, 200);
        assertThat(participant(s, "Camille").get("arrivee").get("carteEmbarquement").asText()).isEqualTo("image/png");
        mvc.perform(get(carte).header("Authorization", camille))
                .andExpect(status().isOk()).andExpect(content().bytes(PNG));

        s = envoyer("DELETE", carte, camille, null, 200);
        assertThat(participant(s, "Camille").get("arrivee").get("carteEmbarquement").isNull()).isTrue();
        envoyer("GET", carte, camille, null, 404);
    }

    @Test
    @DisplayName("Seuls le voyageur et les organisateurs lisent la carte d'embarquement")
    void carteLueParLeVoyageurEtLesOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr"), e1 = jeton("e1@club.fr");
        String base = sejour(dt, 310);
        JsonNode s = envoyer("GET", base, dt, null, 200);
        long pCamille = participant(s, "Camille").get("id").asLong(), pLeo = participant(s, "Léo").get("id").asLong();
        String carteCamille = base + "/participants/" + pCamille + "/cartes-embarquement/ARRIVEE";
        String carteLeo = base + "/participants/" + pLeo + "/cartes-embarquement/ARRIVEE";

        // L'organisateur ajoute celle de Léo, Camille la sienne.
        deposer(carteLeo, dt, "leo.pdf", "application/pdf", PDF, 200);
        deposer(carteCamille, camille, "camille.pdf", "application/pdf", PDF, 200);
        s = envoyer("GET", base, dt, null, 200);
        assertThat(participant(s, "Camille").get("arrivee").get("carteEmbarquement").asText()).isEqualTo("application/pdf");
        mvc.perform(get(carteCamille).header("Authorization", dt)).andExpect(status().isOk());

        // Camille ne voit ni ne touche celle de Léo.
        JsonNode carnet = envoyer("GET", base, camille, null, 200);
        assertThat(participant(carnet, "Léo").get("arrivee").get("carteEmbarquement").isNull()).isTrue();
        envoyer("GET", carteLeo, camille, null, 403);
        deposer(carteLeo, camille, "autre.pdf", "application/pdf", PDF, 403);
        envoyer("DELETE", carteLeo, camille, null, 403);

        // Un moniteur qui n'organise pas lit le vol, pas la carte.
        JsonNode vuParE1 = envoyer("GET", base, e1, null, 200);
        assertThat(participant(vuParE1, "Camille").get("arrivee").get("carteEmbarquement").isNull()).isTrue();
        envoyer("GET", carteCamille, e1, null, 403);
        deposer(carteCamille, e1, "autre.pdf", "application/pdf", PDF, 403);

        // Être ADMIN ne suffit pas : seule l'organisation du séjour compte.
        String admin = jeton("presidente@club.fr");
        envoyer("GET", carteCamille, admin, null, 403);
        envoyer("DELETE", carteCamille, admin, null, 403);

        // L'organisateur retire celle de Léo.
        s = envoyer("DELETE", carteLeo, dt, null, 200);
        assertThat(participant(s, "Léo").get("arrivee").get("carteEmbarquement").isNull()).isTrue();
    }

    @Test
    @DisplayName("Une carte d'embarquement qui n'est ni un PDF ni une photo est refusée")
    void niPdfNiPhoto() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 320);
        long leo = participant(envoyer("GET", base, dt, null, 200), "Léo").get("id").asLong();
        String carte = base + "/participants/" + leo + "/cartes-embarquement/ARRIVEE";

        JsonNode refus = deposer(carte, dt, "carte.txt", "text/plain", "bonjour".getBytes(StandardCharsets.UTF_8), 422);
        assertThat(refus.get("detail").asText())
                .isEqualTo("La carte d'embarquement doit être un PDF ou une photo (JPEG, PNG).");
        // Annoncé PDF, mais ce n'en est pas un.
        refus = deposer(carte, dt, "carte.pdf", "application/pdf", PNG, 422);
        assertThat(refus.get("detail").asText())
                .isEqualTo("La carte d'embarquement doit être un PDF ou une photo (JPEG, PNG).");
    }

    @Test
    @DisplayName("Pas de carte d'embarquement pour un voyage qui n'est pas encore renseigné")
    void pasDeCarteSansVoyage() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 330);
        long leo = participant(envoyer("GET", base, dt, null, 200), "Léo").get("id").asLong();

        JsonNode refus = deposer(base + "/participants/" + leo + "/cartes-embarquement/DEPART", dt,
                "carte.pdf", "application/pdf", PDF, 422);
        assertThat(refus.get("detail").asText())
                .isEqualTo("Renseignez d'abord ce voyage, puis ajoutez-y la carte d'embarquement.");
    }

    @Test
    @DisplayName("Effacer un voyage efface sa carte d'embarquement : rien ne reste en base sans être vu")
    void voyageEffaceEmporteLaCarte() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 350);
        long leo = participant(envoyer("GET", base, dt, null, 200), "Léo").get("id").asLong();
        deposer(base + "/participants/" + leo + "/cartes-embarquement/ARRIVEE", dt, "leo.pdf", "application/pdf", PDF, 200);

        envoyer("PUT", base + "/trajets", dt,
                "{\"sens\":\"ARRIVEE\",\"trajet\":null,\"participantIds\":[%d]}".formatted(leo), 200);
        JsonNode s = envoyer("PUT", base + "/trajets", dt, """
                {"sens":"ARRIVEE","trajet":{"date":"%s","heure":"14:40","transport":"AVION","numero":"TX540"},
                 "participantIds":[%d]}""".formatted(AUJOURDHUI.plusDays(350), leo), 200);

        assertThat(participant(s, "Léo").get("arrivee").get("carteEmbarquement").isNull()).isTrue();
    }

    @Test
    @DisplayName("Un participant entré par le lien ajoute sa carte d'embarquement et la retrouve")
    void participantParLeLien() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 340);
        envoyer("POST", base + "/invitations", dt, null, 200);
        String code = extraire(dernierPour("leo.carte@exemple.fr"), "/sejour/([A-Za-z0-9_-]+)");
        String pub = "/api/public/sejour/" + code;
        envoyer("POST", pub + "/code", null, "{\"email\":\"leo.carte@exemple.fr\"}", 204);
        String chiffres = extraire(dernierPour("leo.carte@exemple.fr"), "(\\d{6})");
        String leo = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"leo.carte@exemple.fr\",\"code\":\"%s\"}".formatted(chiffres), 200).get("jeton").asText();

        JsonNode carnet = deposer(pub + "/cartes-embarquement/ARRIVEE", leo, "leo.pdf", "application/pdf", PDF, 200);
        assertThat(participant(carnet, "Léo").get("arrivee").get("carteEmbarquement").asText()).isEqualTo("application/pdf");
        mvc.perform(get(pub + "/cartes-embarquement/ARRIVEE").header("X-Jeton-Sejour", leo))
                .andExpect(status().isOk()).andExpect(content().bytes(PDF));
        // L'organisateur la lit aussi.
        long pLeo = participant(carnet, "Léo").get("id").asLong();
        mvc.perform(get(base + "/participants/" + pLeo + "/cartes-embarquement/ARRIVEE").header("Authorization", dt))
                .andExpect(status().isOk());

        carnet = envoyer("DELETE", pub + "/cartes-embarquement/ARRIVEE", leo, null, 200);
        assertThat(participant(carnet, "Léo").get("arrivee").get("carteEmbarquement").isNull()).isTrue();
        // Sans jeton : refusé.
        envoyer("GET", pub + "/cartes-embarquement/ARRIVEE", null, null, 403);
    }

    private static String dernierPour(String adresse) {
        synchronized (FraisParticipantsTest.COURRIELS) {
            for (int i = FraisParticipantsTest.COURRIELS.size() - 1; i >= 0; i--) {
                var c = FraisParticipantsTest.COURRIELS.get(i);
                if (c.adresse().equals(adresse)) return c.corps();
            }
        }
        throw new AssertionError("Aucun courriel pour " + adresse);
    }

    private static String extraire(String texte, String motif) {
        Matcher m = Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }
}
