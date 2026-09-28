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
 * Tailles de gilet stabilisateur et de combinaison d'un élève : saisies
 * dans son dossier, reprises par le directeur technique au moment du prêt.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class TaillesEleveTest {

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

    @Test
    @DisplayName("Les tailles se saisissent dans le dossier et se retrouvent au prêt de matériel")
    void taillesDuDossierAuPret() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode cree = json.readTree(mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Taille","prenom":"Alix","autorisationLegale":true,
                                 "tailleGilet":" M ","tailleCombinaison":"T3"}"""))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long id = cree.get("id").asLong();
        assertThat(cree.get("tailleGilet").asText()).isEqualTo("M");
        assertThat(cree.get("tailleCombinaison").asText()).isEqualTo("T3");

        JsonNode modifie = json.readTree(mvc.perform(put("/api/eleves/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Taille","prenom":"Alix","autorisationLegale":true,
                                 "tailleGilet":"L","tailleCombinaison":""}"""))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(modifie.get("tailleGilet").asText()).isEqualTo("L");
        assertThat(modifie.get("tailleCombinaison").isNull()).isTrue();

        JsonNode emprunteurs = json.readTree(mvc.perform(get("/api/materiel/emprunteurs")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String precision = null;
        for (JsonNode e : emprunteurs) {
            if (e.get("type").asText().equals("ELEVE") && e.get("id").asLong() == id) {
                precision = e.get("precision").asText();
            }
        }
        assertThat(precision).isEqualTo("gilet L");
    }

    @Test
    @DisplayName("Une taille de plus de 20 caractères est refusée")
    void tailleTropLongue() throws Exception {
        mvc.perform(post("/api/eleves").header("Authorization", jeton("presidente@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Taille","prenom":"Trop","autorisationLegale":true,
                                 "tailleGilet":"une taille beaucoup trop longue"}"""))
                .andExpect(status().is4xxClientError());
    }
}
