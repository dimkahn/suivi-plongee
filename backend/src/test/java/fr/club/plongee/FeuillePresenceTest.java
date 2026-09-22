package fr.club.plongee;

import fr.club.plongee.commun.Calendrier;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Feuille de presence d'une seance : lecture, saisie de l'atelier, effacement.
 * Eleve, cursus et seance sont crees pour l'occasion.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FeuillePresenceTest {

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

    private JsonNode ligne(String moniteur, long seanceId, long cursusId) throws Exception {
        String feuille = mvc.perform(get("/api/seances/" + seanceId + "/presences").header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode l : json.readTree(feuille).get("eleves")) {
            if (l.get("cursusId").asLong() == cursusId) return l;
        }
        throw new AssertionError("Cursus absent de la feuille de presence");
    }

    private void saisir(String moniteur, long seanceId, long cursusId, String statut, String atelier) throws Exception {
        mvc.perform(put("/api/seances/" + seanceId + "/presences").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"%s","atelier":%s}]"""
                                .formatted(cursusId, statut, atelier == null ? "null" : "\"" + atelier + "\"")))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Saisir bloc, passer absent (l'atelier tombe), puis effacer")
    void feuilleDePresence() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");

        String eleve = mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Presence","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long eleveId = json.readTree(eleve).get("id").asLong();

        String seance = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":8,"milieu":"ARTIFICIEL","lieu":"Piscine test"}"""
                                .formatted(Calendrier.aujourdhui())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long seanceId = json.readTree(seance).get("id").asLong();

        String saisons = mvc.perform(get("/api/saisons").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        long saisonId = -1;
        for (JsonNode s : json.readTree(saisons)) {
            if (s.get("ouverte").asBoolean()) { saisonId = s.get("id").asLong(); break; }
        }
        String cursus = mvc.perform(post("/api/cursus").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saisonId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long cursusId = json.readTree(cursus).get("id").asLong();

        try {
            verifier(moniteur, seanceId, cursusId);
        } finally {
            // Les autres tests comptent les inscriptions de demonstration : on ne laisse rien derriere.
            mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin));
            mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin));
        }
    }

    private void verifier(String moniteur, long seanceId, long cursusId) throws Exception {
        // Rien de saisi au depart.
        assertThat(ligne(moniteur, seanceId, cursusId).get("statut").isNull()).isTrue();

        saisir(moniteur, seanceId, cursusId, "PRESENT", "BLOC");
        JsonNode l = ligne(moniteur, seanceId, cursusId);
        assertThat(l.get("statut").asText()).isEqualTo("PRESENT");
        assertThat(l.get("atelier").asText()).isEqualTo("BLOC");

        // Un absent n'a pas d'atelier, meme si le client en envoie un.
        saisir(moniteur, seanceId, cursusId, "ABSENT", "NAGE");
        l = ligne(moniteur, seanceId, cursusId);
        assertThat(l.get("statut").asText()).isEqualTo("ABSENT");
        assertThat(l.get("atelier").isNull()).isTrue();

        mvc.perform(delete("/api/seances/" + seanceId + "/presences/" + cursusId).header("Authorization", moniteur))
                .andExpect(status().isNoContent());
        assertThat(ligne(moniteur, seanceId, cursusId).get("statut").isNull()).isTrue();

        // Un eleve ne consulte pas la feuille de presence.
        mvc.perform(get("/api/seances/" + seanceId + "/presences").header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isForbidden());
    }
}
