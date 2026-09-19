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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Les deux proprietes sans lesquelles la saisie hors ligne est dangereuse :
 * rejouer une saisie ne la duplique pas, et un refus isole ne fait pas
 * perdre le reste de la file.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SynchronisationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** EN_COURS explicitement : le jeu de demonstration porte aussi un N1 deja DELIVRE (Camille), pas notable. */
    private long cursusDuNiveau(String niveau, String auth) throws Exception {
        String reponse = mvc.perform(get("/api/cursus").header("Authorization", auth))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode c : json.readTree(reponse)) {
            if (niveau.equals(c.get("niveau").asText()) && "EN_COURS".equals(c.get("statut").asText())) {
                return c.get("id").asLong();
            }
        }
        throw new IllegalStateException("Aucun cursus " + niveau + " EN_COURS");
    }

    private long critere(long cursusId, int bloc, int index, String auth) throws Exception {
        String grille = mvc.perform(get("/api/cursus/" + cursusId + "/grille")
                        .header("Authorization", auth))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(grille).get("blocs").get(bloc).get("criteres").get(index).get("id").asLong();
    }

    private long seance(String milieu, String auth) throws Exception {
        String seances = mvc.perform(get("/api/seances").header("Authorization", auth))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode s : json.readTree(seances)) {
            if (milieu.equals(s.get("milieu").asText())) return s.get("id").asLong();
        }
        throw new IllegalStateException("Aucune seance " + milieu);
    }

    @Test
    @DisplayName("Rejouer deux fois la meme saisie ne cree qu'une evaluation")
    void rejeuIdempotent() throws Exception {
        String auth = jeton("e2@club.fr");
        long cursus = cursusDuNiveau("N1", auth);
        long critere = critere(cursus, 1, 0, auth);
        long seance = seance("ARTIFICIEL", auth);
        String reference = UUID.randomUUID().toString();

        String lot = """
                [{"referenceClient":"%s","cursusId":%d,"critereId":%d,"seanceId":%d,
                  "statut":"ACQUIS","dateEvaluation":"2025-09-22"}]
                """.formatted(reference, cursus, critere, seance);

        String premier = mvc.perform(post("/api/synchronisation/evaluations")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(lot))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(premier).get(0).get("etat").asText()).isEqualTo("ACCEPTEE");
        long idEvaluation = json.readTree(premier).get(0).get("evaluationId").asLong();

        String second = mvc.perform(post("/api/synchronisation/evaluations")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(lot))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(second).get(0).get("etat").asText()).isEqualTo("DEJA_ENREGISTREE");
        assertThat(json.readTree(second).get(0).get("evaluationId").asLong()).isEqualTo(idEvaluation);
    }

    @Test
    @DisplayName("Une saisie refusee ne fait pas perdre le reste du lot")
    void refusIsole() throws Exception {
        String auth = jeton("e3@club.fr");
        long cursusN2 = cursusDuNiveau("N2", auth);
        long piscine = seance("ARTIFICIEL", auth);
        long mer = seance("NATUREL", auth);
        long premierCritere = critere(cursusN2, 0, 0, auth);
        long secondCritere = critere(cursusN2, 0, 1, auth);

        String lot = """
                [{"referenceClient":"%s","cursusId":%d,"critereId":%d,"seanceId":%d,
                  "statut":"ACQUIS","dateEvaluation":"2025-10-11"},
                 {"referenceClient":"%s","cursusId":%d,"critereId":%d,"seanceId":%d,
                  "statut":"ACQUIS","dateEvaluation":"2025-09-22"}]
                """.formatted(UUID.randomUUID(), cursusN2, premierCritere, mer,
                              UUID.randomUUID(), cursusN2, secondCritere, piscine);

        String reponse = mvc.perform(post("/api/synchronisation/evaluations")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(lot))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode resultats = json.readTree(reponse);
        assertThat(resultats.get(0).get("etat").asText()).isEqualTo("ACCEPTEE");
        assertThat(resultats.get(1).get("etat").asText()).isEqualTo("REFUSEE");
        assertThat(resultats.get(1).get("raison").asText()).contains("milieu naturel");
    }

    @Test
    @DisplayName("Le paquet d'amorce ramene les grilles de la saison")
    void paquetAmorce() throws Exception {
        String auth = jeton("e3@club.fr");
        String reponse = mvc.perform(get("/api/synchronisation/paquet").header("Authorization", auth))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode paquet = json.readTree(reponse);
        assertThat(paquet.get("grilles")).isNotEmpty();
        assertThat(paquet.get("seances")).isNotEmpty();
        assertThat(paquet.get("referentiels")).isNotEmpty();
    }
}
