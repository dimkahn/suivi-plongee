package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Passer un cursus à « brevet délivré » met à jour le dernier niveau connu de
 * l'élève. Travaille sur un élève créé pour l'occasion : les données de
 * démonstration servent aux autres tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class CursusDelivreTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jetonAdmin() throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"presidente@club.fr","motDePasse":"plongee2026"}"""))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    @Test
    @DisplayName("Statut passé à DELIVRE depuis l'écran Inscriptions : le dernier niveau de l'élève devient ce niveau")
    void passageManuelADelivre_metAJourLeDernierNiveau() throws Exception {
        String admin = jetonAdmin();
        long eleveId = json.readTree(mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Brevete","prenom":"Futur","dernierNiveau":"N1","autorisationLegale":true}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        long saisonId = json.readTree(mvc.perform(get("/api/saisons").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString()).get(0).get("id").asLong();
        long cursusId = json.readTree(mvc.perform(post("/api/cursus").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N2"}""".formatted(eleveId, saisonId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/cursus/" + cursusId).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"statut":"DELIVRE","moniteurReferentId":null}"""))
                .andExpect(status().isOk());

        JsonNode eleves = json.readTree(mvc.perform(get("/api/eleves").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString());
        JsonNode eleve = null;
        for (JsonNode e : eleves) if (e.get("id").asLong() == eleveId) eleve = e;
        assertThat(eleve).isNotNull();
        assertThat(eleve.get("dernierNiveau").asText()).isEqualTo("N2");
    }
}
