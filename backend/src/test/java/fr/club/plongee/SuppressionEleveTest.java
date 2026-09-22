package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Suppression definitive d'un eleve archive, historique compris. L'eleve est
 * cree pour l'occasion : les donnees de demonstration servent aux autres tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SuppressionEleveTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EntityManager em;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private long compter(String sql, long id) {
        return ((Number) em.createNativeQuery(sql).setParameter("id", id).getSingleResult()).longValue();
    }

    @Test
    @DisplayName("Un eleve archive est supprime avec cursus, evaluations et lignes d'audit")
    void supprimerUnEleveArchive() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e3@club.fr");

        // Un eleve avec un vrai historique : un cursus N1 et une evaluation.
        String eleve = mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Asupprimer","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long eleveId = json.readTree(eleve).get("id").asLong();

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

        String grille = mvc.perform(get("/api/cursus/" + cursusId + "/grille").header("Authorization", moniteur))
                .andReturn().getResponse().getContentAsString();
        long critere = json.readTree(grille).get("blocs").get(0).get("criteres").get(0).get("id").asLong();
        String seances = mvc.perform(get("/api/seances").header("Authorization", moniteur))
                .andReturn().getResponse().getContentAsString();
        long seance = json.readTree(seances).get(0).get("id").asLong();
        mvc.perform(post("/api/cursus/" + cursusId + "/evaluations").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"EN_COURS"}""".formatted(critere, seance)))
                .andExpect(status().isCreated());

        // Pas encore archive : refuse.
        mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin))
                .andExpect(status().isOk());
        String archives = mvc.perform(get("/api/eleves/archives").header("Authorization", admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(archives).contains("Asupprimer");

        // Un moniteur ne peut pas supprimer.
        mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", moniteur))
                .andExpect(status().isForbidden());

        mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin))
                .andExpect(status().isNoContent());

        assertThat(compter("SELECT COUNT(*) FROM eleve WHERE id = :id", eleveId)).isZero();
        assertThat(compter("SELECT COUNT(*) FROM eleve_aud WHERE id = :id", eleveId)).isZero();
        assertThat(compter("SELECT COUNT(*) FROM cursus_aud WHERE eleve_id = :id", eleveId)).isZero();
        assertThat(compter("SELECT COUNT(*) FROM evaluation WHERE cursus_id = :id", cursusId)).isZero();
        assertThat(compter("SELECT COUNT(*) FROM cursus WHERE id = :id", cursusId)).isZero();
        mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin))
                .andExpect(status().isNotFound());
    }
}
