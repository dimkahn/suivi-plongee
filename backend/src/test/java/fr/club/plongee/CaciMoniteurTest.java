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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CACI d'un moniteur : mêmes informations que pour un élève, saisies par un
 * ADMIN dans l'écran Moniteurs et rendues au moniteur dans « Mon compte ».
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class CaciMoniteurTest {

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

    private static List<String> textes(JsonNode tableau) {
        List<String> liste = new ArrayList<>();
        tableau.forEach(n -> liste.add(n.asText()));
        return liste;
    }

    @Test
    @DisplayName("L'ADMIN saisit la date de l'examen, le médecin et les cases du CACI d'un moniteur")
    void saisieParLAdmin() throws Exception {
        String admin = jeton("presidente@club.fr");
        LocalDate examen = LocalDate.now().minusMonths(1);
        JsonNode cree = json.readTree(mvc.perform(post("/api/admin/moniteurs").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"caci.moniteur@club.fr","nom":"Caci","prenom":"Moniteur",
                                 "niveauEncadrement":"E2","caciDateExamen":"%s",
                                 "caciMedecin":"DU_SPORT","caciActivites":["LIMITES_PRECONISATIONS","ENSEMBLE_ACTIVITES"]}"""
                                .formatted(examen)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(cree.get("caciDateExamen").asText()).isEqualTo(examen.toString());
        assertThat(cree.get("certificatValideJusquAu").asText()).isEqualTo(examen.plusYears(1).toString());
        assertThat(cree.get("caciMedecin").asText()).isEqualTo("DU_SPORT");
        assertThat(textes(cree.get("caciActivites"))).containsExactly("ENSEMBLE_ACTIVITES", "LIMITES_PRECONISATIONS");

        // Même contrôle que pour un élève.
        mvc.perform(put("/api/admin/moniteurs/" + cree.get("id").asLong()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"caci.moniteur@club.fr","nom":"Caci","prenom":"Moniteur",
                                 "niveauEncadrement":"E2","caciActivites":["ENSEMBLE_ACTIVITES","APNEE"]}"""))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    @DisplayName("Le moniteur retrouve le détail de son CACI dans sa session")
    void detailDansMonCompte() throws Exception {
        JsonNode moi = json.readTree(mvc.perform(get("/api/auth/moi").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(moi.has("caciDateExamen")).isTrue();
        assertThat(moi.has("caciMedecin")).isTrue();
        assertThat(moi.get("caciActivites").isArray()).isTrue();
    }
}
