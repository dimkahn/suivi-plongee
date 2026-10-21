package fr.club.plongee;

import fr.club.plongee.sejour.AttestationsAssuranceService;
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
 * L'attestation d'assurance d'un participant au séjour (demande du club,
 * 2026) : un PDF ou une photo, ajoutée par lui (dans l'appli ou par le
 * lien) ou par un organisateur. Comme la carte d'embarquement, seuls le
 * participant et les organisateurs la lisent.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(FraisParticipantsTest.BoiteAuxLettres.class)
class AttestationAssuranceTest {

    private static final byte[] PDF = "%PDF-1.4\n%fausse attestation\n".getBytes(StandardCharsets.US_ASCII);
    /** Une image PNG minimale : la signature suffit au contrôle du serveur. */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    private static final LocalDate AUJOURDHUI = LocalDate.now(ZoneId.of("Europe/Paris"));

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AttestationsAssuranceService attestations;

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

    /** Un séjour du DT (e3) avec Camille (compte élève) et Léo (sans compte). */
    private String sejour(String dt, int dans) throws Exception {
        LocalDate debut = AUJOURDHUI.plusDays(dans);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour Marie-Galante","lieu":"Grand-Bourg","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(8)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(eleveCamille(dt)), 200);
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Durand","prenom":"Léo","plongeur":false,"email":"leo.assurance@exemple.fr"}""", 200);
        return base;
    }

    private static String attestation(String base, long participantId) {
        return base + "/participants/" + participantId + "/attestation-assurance";
    }

    @Test
    @DisplayName("Le participant ajoute son attestation d'assurance, la retrouve, la remplace et la retire")
    void participantAjouteSonAttestation() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr");
        String base = sejour(dt, 300);
        long moi = participant(envoyer("GET", base, camille, null, 200), "Camille").get("id").asLong();
        String url = attestation(base, moi);

        JsonNode s = deposer(url, camille, "assurance.pdf", "application/pdf", PDF, 200);
        assertThat(participant(s, "Camille").get("attestationAssurance").asText()).isEqualTo("application/pdf");
        mvc.perform(get(url).header("Authorization", camille))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Security-Policy", "sandbox"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(PDF));

        // Une photo la remplace : une attestation par participant.
        s = deposer(url, camille, "assurance.png", "image/png", PNG, 200);
        assertThat(participant(s, "Camille").get("attestationAssurance").asText()).isEqualTo("image/png");
        mvc.perform(get(url).header("Authorization", camille))
                .andExpect(status().isOk()).andExpect(content().bytes(PNG));

        s = envoyer("DELETE", url, camille, null, 200);
        assertThat(participant(s, "Camille").get("attestationAssurance").isNull()).isTrue();
        envoyer("GET", url, camille, null, 404);
    }

    @Test
    @DisplayName("Seuls le participant et les organisateurs lisent l'attestation d'assurance")
    void lueParLeParticipantEtLesOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr"), e1 = jeton("e1@club.fr");
        String base = sejour(dt, 310);
        JsonNode s = envoyer("GET", base, dt, null, 200);
        String deCamille = attestation(base, participant(s, "Camille").get("id").asLong());
        String deLeo = attestation(base, participant(s, "Léo").get("id").asLong());

        // L'organisateur ajoute celle de Léo, Camille la sienne.
        deposer(deLeo, dt, "leo.pdf", "application/pdf", PDF, 200);
        deposer(deCamille, camille, "camille.pdf", "application/pdf", PDF, 200);
        s = envoyer("GET", base, dt, null, 200);
        assertThat(participant(s, "Camille").get("attestationAssurance").asText()).isEqualTo("application/pdf");
        mvc.perform(get(deCamille).header("Authorization", dt)).andExpect(status().isOk());

        // Camille ne voit ni ne touche celle de Léo.
        JsonNode carnet = envoyer("GET", base, camille, null, 200);
        assertThat(participant(carnet, "Léo").get("attestationAssurance").isNull()).isTrue();
        envoyer("GET", deLeo, camille, null, 403);
        deposer(deLeo, camille, "autre.pdf", "application/pdf", PDF, 403);
        envoyer("DELETE", deLeo, camille, null, 403);

        // Un moniteur qui n'organise pas ne sait même pas qu'elle existe.
        JsonNode vuParE1 = envoyer("GET", base, e1, null, 200);
        assertThat(participant(vuParE1, "Camille").get("attestationAssurance").isNull()).isTrue();
        envoyer("GET", deCamille, e1, null, 403);
        deposer(deCamille, e1, "autre.pdf", "application/pdf", PDF, 403);

        // L'organisateur qui regarde « comme un participant » ne la voit pas non plus.
        JsonNode commeParticipant = envoyer("GET", base + "?commeParticipant=true", dt, null, 200);
        assertThat(participant(commeParticipant, "Camille").get("attestationAssurance").isNull()).isTrue();
        assertThat(participant(commeParticipant, "Léo").get("attestationAssurance").isNull()).isTrue();

        // Être ADMIN ne suffit pas : seule l'organisation du séjour compte.
        String admin = jeton("presidente@club.fr");
        envoyer("GET", deCamille, admin, null, 403);
        envoyer("DELETE", deCamille, admin, null, 403);

        // L'organisateur retire celle de Léo.
        s = envoyer("DELETE", deLeo, dt, null, 200);
        assertThat(participant(s, "Léo").get("attestationAssurance").isNull()).isTrue();
    }

    @Test
    @DisplayName("L'organisateur écrit le conseil d'assurance du séjour, lu par les participants ; un autre moniteur ne le change pas")
    void conseilAssuranceDuSejour() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr"), e1 = jeton("e1@club.fr");
        String base = sejour(dt, 370);
        assertThat(envoyer("GET", base, camille, null, 200).get("conseilAssurance").isNull()).isTrue();

        String conseil = "Une assurance complémentaire (Loisir 1 minimum) est fortement recommandée.";
        JsonNode s = envoyer("PUT", base + "/conseil-assurance", dt,
                json.writeValueAsString(java.util.Map.of("conseilAssurance", conseil)), 200);
        assertThat(s.get("conseilAssurance").asText()).isEqualTo(conseil);
        assertThat(envoyer("GET", base, camille, null, 200).get("conseilAssurance").asText()).isEqualTo(conseil);

        envoyer("PUT", base + "/conseil-assurance", e1, "{\"conseilAssurance\":\"autre\"}", 403);
        envoyer("PUT", base + "/conseil-assurance", camille, "{\"conseilAssurance\":\"autre\"}", 403);

        // Vidé : plus d'encart.
        s = envoyer("PUT", base + "/conseil-assurance", dt, "{\"conseilAssurance\":\"  \"}", 200);
        assertThat(s.get("conseilAssurance").isNull()).isTrue();
    }

    @Test
    @DisplayName("Une attestation d'assurance qui n'est ni un PDF ni une photo est refusée")
    void niPdfNiPhoto() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 320);
        String url = attestation(base, participant(envoyer("GET", base, dt, null, 200), "Léo").get("id").asLong());

        JsonNode refus = deposer(url, dt, "assurance.txt", "text/plain", "bonjour".getBytes(StandardCharsets.UTF_8), 422);
        assertThat(refus.get("detail").asText())
                .isEqualTo("L'attestation d'assurance doit être un PDF ou une photo (JPEG, PNG).");
        // Annoncée PDF, mais ce n'en est pas un.
        refus = deposer(url, dt, "assurance.pdf", "application/pdf", PNG, 422);
        assertThat(refus.get("detail").asText())
                .isEqualTo("L'attestation d'assurance doit être un PDF ou une photo (JPEG, PNG).");
    }

    @Test
    @DisplayName("Les attestations d'assurance sont effacées le lendemain de la fin du séjour, ou du retour s'il est plus tard")
    void effaceesApresLeSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 360);
        LocalDate fin = AUJOURDHUI.plusDays(360 + 8);
        JsonNode s = envoyer("GET", base, dt, null, 200);
        long camille = participant(s, "Camille").get("id").asLong(), leo = participant(s, "Léo").get("id").asLong();
        // Léo rentre deux jours après la fin du séjour.
        envoyer("PUT", base + "/trajets", dt, """
                {"sens":"DEPART","trajet":{"date":"%s","heure":"09:00","transport":"AVION","numero":"TX541"},
                 "participantIds":[%d]}""".formatted(fin.plusDays(2), leo), 200);
        deposer(attestation(base, camille), dt, "c.pdf", "application/pdf", PDF, 200);
        deposer(attestation(base, leo), dt, "l.pdf", "application/pdf", PDF, 200);

        attestations.effacerApresLeSejour(fin);
        s = envoyer("GET", base, dt, null, 200);
        assertThat(participant(s, "Camille").get("attestationAssurance").asText()).isEqualTo("application/pdf");

        attestations.effacerApresLeSejour(fin.plusDays(1));
        s = envoyer("GET", base, dt, null, 200);
        assertThat(participant(s, "Camille").get("attestationAssurance").isNull()).isTrue();
        assertThat(participant(s, "Léo").get("attestationAssurance").asText()).isEqualTo("application/pdf");

        attestations.effacerApresLeSejour(fin.plusDays(3));
        s = envoyer("GET", base, dt, null, 200);
        assertThat(participant(s, "Léo").get("attestationAssurance").isNull()).isTrue();
    }

    @Test
    @DisplayName("Un participant entré par le lien ajoute son attestation d'assurance et la retrouve")
    void participantParLeLien() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 340);
        envoyer("POST", base + "/invitations", dt, null, 200);
        String code = extraire(dernierPour("leo.assurance@exemple.fr"), "/sejour/([A-Za-z0-9_-]+)");
        String pub = "/api/public/sejour/" + code;
        envoyer("POST", pub + "/code", null, "{\"email\":\"leo.assurance@exemple.fr\"}", 204);
        String chiffres = extraire(dernierPour("leo.assurance@exemple.fr"), "(\\d{6})");
        String leo = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"leo.assurance@exemple.fr\",\"code\":\"%s\"}".formatted(chiffres), 200).get("jeton").asText();

        // Camille a joint la sienne : Léo ne le voit pas dans son carnet.
        long pCamille = participant(envoyer("GET", base, dt, null, 200), "Camille").get("id").asLong();
        deposer(attestation(base, pCamille), dt, "camille.pdf", "application/pdf", PDF, 200);

        JsonNode carnet = deposer(pub + "/attestation-assurance", leo, "leo.pdf", "application/pdf", PDF, 200);
        assertThat(participant(carnet, "Léo").get("attestationAssurance").asText()).isEqualTo("application/pdf");
        assertThat(participant(carnet, "Camille").get("attestationAssurance").isNull()).isTrue();
        carnet = envoyer("GET", pub + "/carnet", leo, null, 200);
        assertThat(participant(carnet, "Camille").get("attestationAssurance").isNull()).isTrue();
        mvc.perform(get(pub + "/attestation-assurance").header("X-Jeton-Sejour", leo))
                .andExpect(status().isOk()).andExpect(content().bytes(PDF));
        // L'organisateur la lit aussi.
        mvc.perform(get(attestation(base, participant(carnet, "Léo").get("id").asLong())).header("Authorization", dt))
                .andExpect(status().isOk());

        carnet = envoyer("DELETE", pub + "/attestation-assurance", leo, null, 200);
        assertThat(participant(carnet, "Léo").get("attestationAssurance").isNull()).isTrue();
        // Sans jeton : refusé.
        envoyer("GET", pub + "/attestation-assurance", null, null, 403);
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
