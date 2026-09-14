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
 * Adhésion à une saison sans formation : pour un élève déjà breveté qui
 * continue de plonger avec le club sans ouvrir de nouveau Cursus.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AdhesionTest {

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

    private long premiereSaison(String jeton) throws Exception {
        String reponse = mvc.perform(get("/api/saisons").header("Authorization", jeton))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get(0).get("id").asLong();
    }

    private long creerEleve(String jeton) throws Exception {
        String corps = """
                {"nom":"Dupont","prenom":"Adherent","autorisationLegale":true}
                """;
        String reponse = mvc.perform(post("/api/eleves").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    @Test
    @DisplayName("Un ADMIN peut faire adhérer un élève à une saison sans lui ouvrir de cursus")
    void adminPeutFaireAdherer() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = premiereSaison(admin);
        long eleve = creerEleve(admin);

        String demande = """
                {"eleveId":%d,"saisonId":%d}
                """.formatted(eleve, saison);
        mvc.perform(post("/api/adhesions").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande))
                .andExpect(status().isCreated());

        String reponse = mvc.perform(get("/api/adhesions").param("saisonId", String.valueOf(saison))
                        .header("Authorization", admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode liste = json.readTree(reponse);
        assertThat(liste).anyMatch(a -> a.get("eleveId").asLong() == eleve);
    }

    @Test
    @DisplayName("Une double adhésion à la même saison est refusée")
    void doubleAdhesionRefusee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = premiereSaison(admin);
        long eleve = creerEleve(admin);
        String demande = """
                {"eleveId":%d,"saisonId":%d}
                """.formatted(eleve, saison);

        mvc.perform(post("/api/adhesions").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/adhesions").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("Un moniteur (pas ADMIN) ne peut pas faire adhérer un élève")
    void moniteurNePeutPasFaireAdherer() throws Exception {
        String moniteur = jeton("e2@club.fr");
        String admin = jeton("presidente@club.fr");
        long saison = premiereSaison(admin);
        long eleve = creerEleve(admin);

        String demande = """
                {"eleveId":%d,"saisonId":%d}
                """.formatted(eleve, saison);
        mvc.perform(post("/api/adhesions").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demande))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Retirer une adhésion la fait disparaître de la saison")
    void retirerUneAdhesion() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = premiereSaison(admin);
        long eleve = creerEleve(admin);
        String demande = """
                {"eleveId":%d,"saisonId":%d}
                """.formatted(eleve, saison);

        String reponse = mvc.perform(post("/api/adhesions").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande))
                .andReturn().getResponse().getContentAsString();
        long adhesionId = json.readTree(reponse).get("id").asLong();

        mvc.perform(delete("/api/adhesions/" + adhesionId).header("Authorization", admin))
                .andExpect(status().isNoContent());

        String liste = mvc.perform(get("/api/adhesions").param("saisonId", String.valueOf(saison))
                        .header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(liste)).noneMatch(a -> a.get("eleveId").asLong() == eleve);
    }
}
