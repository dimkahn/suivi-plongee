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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Garde-fou sur V100__donnees_demo.sql : depuis que plusieurs revisions du
 * referentiel peuvent coexister par niveau (V7, V8 - un ancien "actif=FALSE"
 * et un nouveau), une selection "WHERE r.niveau = ..." sans filtrer sur
 * actif redevient ambigue et peut silencieusement dupliquer un cursus ou
 * ne trouver aucun bloc (code de bloc d'une revision perimee). Ce test
 * aurait attrape le bug corrige en meme temps que l'import N2/N3.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class DonneesDemoTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String corps = """
                {"email":"%s","motDePasse":"plongee2026"}
                """.formatted(email);
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    @Test
    @DisplayName("Chaque eleve de demonstration n'a qu'un seul cursus par saison, pas un par revision du referentiel")
    void unSeulCursusParEleveEtParSaison() throws Exception {
        String reponse = mvc.perform(get("/api/cursus").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode cursus = json.readTree(reponse);
        assertThat(cursus).hasSize(4);
    }

    @Test
    @DisplayName("Les evaluations semees sur le N1 de Camille existent bien (pas de code de bloc perime)")
    void evaluationsSemeesSurLeN1DeCamille() throws Exception {
        String cursusReponse = mvc.perform(get("/api/cursus").header("Authorization", jeton("e3@club.fr")))
                .andReturn().getResponse().getContentAsString();
        long cursusN1 = -1;
        for (JsonNode c : json.readTree(cursusReponse)) {
            if ("N1".equals(c.get("niveau").asText())) { cursusN1 = c.get("id").asLong(); break; }
        }
        assertThat(cursusN1).isPositive();

        String grille = mvc.perform(get("/api/cursus/" + cursusN1 + "/grille")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // Deux evaluations sont semees dans V100 (un ACQUIS, un EN_COURS) :
        // si les codes de bloc ne correspondaient plus a la revision active,
        // ces INSERT ... SELECT n'auraient silencieusement rien insere.
        assertThat(json.readTree(grille).get("criteresAcquis").asInt()).isGreaterThan(0);
    }
}
