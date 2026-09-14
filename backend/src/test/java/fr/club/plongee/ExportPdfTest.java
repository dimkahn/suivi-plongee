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

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Export PDF de la fiche de suivi : meme regle d'habilitation que la grille
 * (@habilitation.peutConsulter), verifiee ici plutot que re-testee dans
 * SecuriteEvaluationTest pour garder chaque fichier centre sur un endpoint.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ExportPdfTest {

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

    @Test
    @DisplayName("Sans authentification, l'export PDF est refuse")
    void anonymeRefuse() throws Exception {
        long cursus = cursusDuNiveau("N1");
        mvc.perform(get("/api/cursus/" + cursus + "/fiche.pdf"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Le moniteur referent peut telecharger la fiche PDF d'un eleve")
    void moniteurPeutTelecharger() throws Exception {
        long cursus = cursusDuNiveau("N1");
        byte[] pdf = mvc.perform(get("/api/cursus/" + cursus + "/fiche.pdf")
                        .header("Authorization", jeton("e2@club.fr")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().exists("Content-Disposition"))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(pdf).isNotEmpty();
        // Un PDF valide commence toujours par cette signature.
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("Un eleve peut telecharger sa propre fiche PDF")
    void elevePeutTelechargerSaPropreFiche() throws Exception {
        long cursus = cursusDuNiveau("N1"); // le N1 de demonstration appartient a eleve@club.fr
        mvc.perform(get("/api/cursus/" + cursus + "/fiche.pdf")
                        .header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"));
    }

    @Test
    @DisplayName("Un eleve ne peut pas telecharger la fiche PDF d'un autre eleve")
    void eleveNePeutPasTelechargerLaFicheDUnAutre() throws Exception {
        long cursus = cursusDuNiveau("N2"); // appartient a Mateo, pas a Camille (eleve@club.fr)
        mvc.perform(get("/api/cursus/" + cursus + "/fiche.pdf")
                        .header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isForbidden());
    }
}
