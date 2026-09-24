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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Séjour de plongée : une séance par jour × plongée du jour × info
 * complémentaire. Dates lointaines (2030) pour ne croiser aucune séance
 * du jeu de démonstration ni des autres tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SerieSeancesTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    @Test
    @DisplayName("3 jours × 2 plongées × 2 infos complémentaires = 12 séances, n° de plongée par jour")
    void sejourAvecDeuxInfos() throws Exception {
        String admin = jeton("presidente@club.fr");

        String reponse = mvc.perform(post("/api/seances/serie").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2030-05-10","dateFin":"2030-05-12","plongeesParJour":2,
                                  "milieu":"NATUREL","lieu":"Port-Cros","site":"La Gabinière","profondeurMax":20,
                                  "infos":["Bateau Aquilon"," Bateau Borée ",""]}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode seances = json.readTree(reponse);
        assertThat(seances.size()).isEqualTo(12);
        List<String> cles = new ArrayList<>();
        for (JsonNode s : seances) {
            assertThat(s.get("lieu").asText()).isEqualTo("Port-Cros");
            assertThat(s.get("site").asText()).isEqualTo("La Gabinière");
            assertThat(s.get("milieu").asText()).isEqualTo("NATUREL");
            cles.add(s.get("date").asText() + "|" + s.get("ordre").asInt() + "|" + s.get("commentaire").asText());
        }
        assertThat(cles).contains(
                "2030-05-10|1|Bateau Aquilon", "2030-05-10|1|Bateau Borée",
                "2030-05-10|2|Bateau Aquilon", "2030-05-12|2|Bateau Borée");
    }

    @Test
    @DisplayName("Sans info complémentaire : une séance par plongée, n° après les séances déjà prévues ce jour-là")
    void sejourSansInfoApresSeanceExistante() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"2030-06-01","ordre":1,"milieu":"ARTIFICIEL","lieu":"Piscine"}"""))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/seances/serie").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2030-06-01","dateFin":"2030-06-02","plongeesParJour":2,
                                  "milieu":"NATUREL","lieu":"Carrière"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].ordre").value(2))
                .andExpect(jsonPath("$[1].ordre").value(3))
                .andExpect(jsonPath("$[2].ordre").value(1))
                .andExpect(jsonPath("$[0].commentaire").isEmpty());
    }

    @Test
    @DisplayName("Dates inversées ou séjour trop long : refus avec un message pour l'utilisateur")
    void datesRefusees() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(post("/api/seances/serie").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2030-07-10","dateFin":"2030-07-09","plongeesParJour":1,"milieu":"NATUREL"}"""))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("date de fin")));

        mvc.perform(post("/api/seances/serie").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2030-07-01","dateFin":"2030-08-15","plongeesParJour":1,"milieu":"NATUREL"}"""))
                .andExpect(status().isUnprocessableEntity());
    }
}
