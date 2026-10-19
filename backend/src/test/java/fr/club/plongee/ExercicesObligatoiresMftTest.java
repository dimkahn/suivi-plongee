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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contenu installé (N1 PE20, N2 PA20 | PE40, N3 PA40 | PE60) : le MFT veut
 * que chaque critère d'une compétence soit validé. Les exercices de maîtrise
 * obligatoires (V93) couvrent donc chaque critère qui a un exercice de
 * maîtrise, et la progression type du club les prévoit tous, en milieu
 * naturel au N2 et au N3.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ExercicesObligatoiresMftTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton() throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"presidente@club.fr\",\"motDePasse\":\"plongee2026\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    @DisplayName("Chaque critère qui a un exercice de maîtrise est couvert par un exercice de maîtrise obligatoire")
    void obligatoiresCouvrentChaqueCritere() throws Exception {
        String admin = jeton();
        List<String> nonCouverts = new ArrayList<>();
        int obligatoires = 0;
        for (JsonNode r : lire("/api/referentiels", admin)) {
            JsonNode exercices = lire("/api/referentiels/" + r.get("id").asLong() + "/exercices", admin);
            Set<Long> deMaitrise = new HashSet<>();
            Set<Long> couverts = new HashSet<>();
            for (JsonNode e : exercices) {
                if (!e.get("actif").asBoolean()) continue;
                boolean maitrise = "MAITRISE".equals(e.get("phase").asText());
                if (e.get("obligatoire").asBoolean()) {
                    assertThat(maitrise).as("exercice obligatoire " + e.get("numero").asText()).isTrue();
                    obligatoires++;
                }
                for (JsonNode c : e.get("critereIds")) {
                    if (maitrise) deMaitrise.add(c.asLong());
                    if (e.get("obligatoire").asBoolean()) couverts.add(c.asLong());
                }
            }
            for (JsonNode b : lire("/api/referentiels/" + r.get("id").asLong(), admin).get("blocs")) {
                for (JsonNode c : b.get("criteres")) {
                    long id = c.get("id").asLong();
                    if (deMaitrise.contains(id) && !couverts.contains(id)) {
                        nonCouverts.add(r.get("niveau").asText() + " « " + c.get("savoirFaire").asText() + " »");
                    }
                }
            }
        }
        assertThat(obligatoires).isPositive();
        assertThat(nonCouverts).isEmpty();
    }

    @Test
    @DisplayName("La progression type du club prévoit chaque exercice obligatoire, en milieu naturel au N2 et au N3")
    void progressionsDuClubPrevoientLesObligatoires() throws Exception {
        String admin = jeton();
        int vues = 0;
        for (JsonNode p : lire("/api/progressions", admin)) {
            if (!p.get("nom").asText().contains("progression type du club")) continue;
            vues++;
            JsonNode detail = lire("/api/progressions/" + p.get("id").asLong(), admin);
            List<String> manquants = new ArrayList<>();
            detail.get("obligatoiresManquants").forEach(m ->
                    manquants.add(m.get("exercice").get("numero").asText() + " : " + m.get("raison").asText()));
            assertThat(manquants).as(p.get("nom").asText()).isEmpty();
        }
        assertThat(vues).isEqualTo(3);
    }
}
