package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le mode participant (demande du club, 2026) : un organisateur, ou tout
 * encadrant, voit le séjour comme le voit un participant, filtré par le
 * serveur comme le carnet.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ModeParticipantSejourTest {

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
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    private JsonNode participant(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p;
        throw new AssertionError(prenom + " absent du séjour");
    }

    @Test
    @DisplayName("En mode participant, l'organisateur voit le carnet d'un participant : ni modification, ni coordonnées des autres")
    void organisateurEnModeParticipant() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(370);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour Lanzarote","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(6)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Durand","prenom":"Léo","plongeur":true,"telephone":"06 11 22 33 44","regimes":["HALAL"],
                 "arrivee":{"date":"%s","heure":"11:00","transport":"AVION","numero":"VY1234","dossier":"LEO123"}}"""
                .formatted(debut), 200);

        assertThat(envoyer("GET", base, dt, null, 200).get("gere").asBoolean()).isTrue();

        JsonNode vu = envoyer("GET", base + "?commeParticipant=true", dt, null, 200);
        assertThat(vu.get("gere").asBoolean()).isFalse();
        assertThat(vu.get("encadrant").asBoolean()).isFalse();
        assertThat(vu.get("peutDesigner").asBoolean()).isFalse();
        JsonNode leo = participant(vu, "Léo");
        assertThat(leo.get("telephone").isNull()).isTrue();
        assertThat(leo.get("regimes")).isEmpty();
        assertThat(leo.get("arrivee").get("numero").asText()).isEqualTo("VY1234");
        assertThat(leo.get("arrivee").get("dossier").isNull()).isTrue();
        assertThat(vu.get("frais").get("droits").get("peutAjouter").asBoolean()).isFalse();
    }
}
