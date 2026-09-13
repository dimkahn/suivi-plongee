package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le test le plus important du projet : verifier qu'on ne peut pas noter
 * un eleve sans en avoir le droit. Les gardes du front ne sont que du confort.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SecuriteEvaluationTest {

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

    private long cursusDuNiveau(String niveau) throws Exception {
        String reponse = mvc.perform(get("/api/cursus").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode c : json.readTree(reponse)) {
            if (niveau.equals(c.get("niveau").asText())) return c.get("id").asLong();
        }
        throw new IllegalStateException("Aucun cursus " + niveau + " dans le jeu de demonstration");
    }

    private long premierCritere(long cursusId, String lecteur) throws Exception {
        String grille = mvc.perform(get("/api/cursus/" + cursusId + "/grille")
                        .header("Authorization", jeton(lecteur)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(grille).get("blocs").get(0).get("criteres").get(0).get("id").asLong();
    }

    @Test
    @DisplayName("Sans authentification, la saisie est refusee")
    void anonymeRefuse() throws Exception {
        mvc.perform(post("/api/cursus/1/evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":1,"statut":"ACQUIS"}"""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Un eleve ne peut pas noter, meme sur son propre cursus")
    void eleveNePeutPasNoter() throws Exception {
        long cursus = cursusDuNiveau("N1");
        long critere = premierCritere(cursus, "e2@club.fr");
        mvc.perform(post("/api/cursus/" + cursus + "/evaluations")
                        .header("Authorization", jeton("eleve@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"statut":"ACQUIS"}""".formatted(critere)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un E1 ne peut pas valider une competence de N2")
    void e1NePeutPasNoterUnN2() throws Exception {
        long cursus = cursusDuNiveau("N2");
        long critere = premierCritere(cursus, "e3@club.fr");
        mvc.perform(post("/api/cursus/" + cursus + "/evaluations")
                        .header("Authorization", jeton("e1@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"statut":"ACQUIS"}""".formatted(critere)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Une competence de N2 ne peut pas etre validee en piscine")
    void n2InterditEnMilieuArtificiel() throws Exception {
        long cursus = cursusDuNiveau("N2");
        long critere = premierCritere(cursus, "e3@club.fr");
        String seances = mvc.perform(get("/api/seances").header("Authorization", jeton("e3@club.fr")))
                .andReturn().getResponse().getContentAsString();
        long piscine = -1;
        for (JsonNode s : json.readTree(seances)) {
            if ("ARTIFICIEL".equals(s.get("milieu").asText())) { piscine = s.get("id").asLong(); break; }
        }

        mvc.perform(post("/api/cursus/" + cursus + "/evaluations")
                        .header("Authorization", jeton("e3@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"ACQUIS"}"""
                                .formatted(critere, piscine)))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("Un E2 peut noter un cursus N1")
    void e2PeutNoterUnN1() throws Exception {
        long cursus = cursusDuNiveau("N1");
        long critere = premierCritere(cursus, "e2@club.fr");
        String seances = mvc.perform(get("/api/seances").header("Authorization", jeton("e2@club.fr")))
                .andReturn().getResponse().getContentAsString();
        long seance = json.readTree(seances).get(0).get("id").asLong();

        mvc.perform(post("/api/cursus/" + cursus + "/evaluations")
                        .header("Authorization", jeton("e2@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"ACQUIS"}"""
                                .formatted(critere, seance)))
                .andExpect(status().isCreated());
    }
}
