package fr.club.plongee.commun;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Statuts HTTP d'une requête mal adressée : une méthode non prise en charge ou
 * une route inconnue ne sont pas des erreurs du serveur (pas de 500 ni de
 * ligne « Erreur non prevue » au journal).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ErreursHttpTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton() throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"presidente@club.fr\",\"motDePasse\":\"plongee2026\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    @Test
    @DisplayName("Une méthode non prise en charge par une route existante répond 405, pas 500")
    void methodeNonPriseEnCharge() throws Exception {
        mvc.perform(delete("/api/admin/moniteurs").header("Authorization", jeton()))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("Une route inconnue de l'API répond 404, pas 500")
    void routeInconnue() throws Exception {
        mvc.perform(get("/api/admin/route-qui-n-existe-pas").header("Authorization", jeton()))
                .andExpect(status().isNotFound());
    }
}
