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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un plongeur d'un groupe de séjour porte trois niveaux distincts : son
 * niveau de plongeur, son niveau d'encadrement et le niveau qu'il prépare.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class NiveauxMembreGroupePlongeursTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps) throws Exception {
        var requete = "POST".equals(methode) ? post(url) : "PUT".equals(methode) ? put(url) : get(url);
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    private long saisonOuverte(String jeton) throws Exception {
        for (JsonNode s : envoyer("GET", "/api/saisons", jeton, null)) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new AssertionError("Pas de saison ouverte");
    }

    @Test
    @DisplayName("Un plongeur du groupe garde son niveau de plongeur, son niveau d'encadrement et son niveau préparé")
    void troisNiveauxGardes() throws Exception {
        String dt = jeton("e3@club.fr");
        long saison = saisonOuverte(dt);
        JsonNode g = envoyer("POST", "/api/groupes-plongeurs", dt, """
                {"nom":"Séjour trois niveaux","saisonId":%d,"membres":[{"nom":"Morel","prenom":"Béa",
                 "aptitude":"N3","niveauEncadrement":"E1","qualificationPreparee":"N4"}]}""".formatted(saison));
        JsonNode membre = g.get("membres").get(0);
        assertThat(membre.get("aptitude").asText()).isEqualTo("N3");
        assertThat(membre.get("niveauEncadrement").asText()).isEqualTo("E1");
        assertThat(membre.get("qualificationPreparee").asText()).isEqualTo("N4");

        JsonNode modifie = envoyer("PUT", "/api/groupes-plongeurs/" + g.get("id").asLong(), dt, """
                {"nom":"Séjour trois niveaux","saisonId":%d,"membres":[{"id":%d,"nom":"Morel","prenom":"Béa",
                 "aptitude":"N4","niveauEncadrement":"E2","qualificationPreparee":"E3"}]}"""
                .formatted(saison, membre.get("id").asLong()));
        assertThat(modifie.get("membres").get(0).get("niveauEncadrement").asText()).isEqualTo("E2");
    }
}
