package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le justificatif d'une dépense de séjour peut être un PDF (facture reçue
 * par e-mail), pas seulement une photo de la note (demande du club, 2026-11).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class NotePdfTest {

    private static final byte[] PDF = "%PDF-1.4\n%fausse facture\n".getBytes(StandardCharsets.US_ASCII);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = methode.equals("POST") ? post(url) : get(url);
        String reponse = mvc.perform(requete.header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private JsonNode joindre(String url, String jeton, byte[] contenu, String type, int attendu) throws Exception {
        String reponse = mvc.perform(multipart(url).file(new MockMultipartFile("fichier", "facture", type, contenu))
                        .header("Authorization", jeton))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    /** Un séjour du DT (e3) avec Flora (moniteur, compte e2), et une dépense payée par Flora. */
    private record Depense(String base, long id) {}

    private Depense depense(String dt) throws Exception {
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(280);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour facture PDF","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(2)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long flora = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
        }
        JsonNode s = envoyer("POST", base + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora), 200);
        long pFlora = s.get("participants").get(0).get("id").asLong();
        long id = envoyer("POST", base + "/depenses", dt, """
                {"libelle":"Gîte","categorie":"HEBERGEMENT","montantCentimes":30000,"payeurId":%d,
                 "parts":[{"participantId":%d,"parts":1}]}""".formatted(pFlora, pFlora), 200)
                .get("depenseId").asLong();
        return new Depense(base, id);
    }

    @Test
    @DisplayName("Une facture en PDF se joint à une dépense, signalée comme PDF et lue par les participants")
    void factureEnPdf() throws Exception {
        String dt = jeton("e3@club.fr");
        Depense d = depense(dt);

        JsonNode sejour = joindre(d.base() + "/depenses/" + d.id() + "/photos", dt, PDF, "application/pdf", 200);
        JsonNode dep = sejour.get("frais").get("depenses").get(0);
        long piece = dep.get("photos").get(0).asLong();
        assertThat(dep.get("pdfs").toString()).isEqualTo("[" + piece + "]");

        // Servie en PDF, en bac à sable : un PDF ne peut rien exécuter au nom de l'appli.
        mvc.perform(get(d.base() + "/depenses/" + d.id() + "/photos/" + piece)
                        .header("Authorization", jeton("e2@club.fr")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Security-Policy", "sandbox"));
    }

    @Test
    @DisplayName("Un fichier annoncé PDF qui n'en est pas un est refusé avec un message lisible")
    void fauxPdfRefuse() throws Exception {
        String dt = jeton("e3@club.fr");
        Depense d = depense(dt);
        JsonNode refus = joindre(d.base() + "/depenses/" + d.id() + "/photos", dt,
                "bonjour".getBytes(StandardCharsets.US_ASCII), "application/pdf", 422);
        assertThat(refus.get("detail").asText()).contains("PDF ou une photo");
    }
}
