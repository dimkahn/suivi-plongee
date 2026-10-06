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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CACI d'un élève : date de l'examen et cases cochées du formulaire FFESSM,
 * saisies dans le dossier par un ADMIN et rendues aux encadrants dans la vue
 * « Infos élèves ».
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class CaciEleveTest {

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
    @DisplayName("La date de l'examen et les cases cochées du CACI s'enregistrent et se modifient")
    void casesCocheesDuDossier() throws Exception {
        String admin = jeton("presidente@club.fr");
        String examen = LocalDate.now().minusMonths(2).toString();
        String fin = LocalDate.now().plusMonths(10).toString();
        JsonNode cree = json.readTree(mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Caci","prenom":"Lou","autorisationLegale":true,
                                 "certificatValideJusquAu":"%s","caciDateExamen":"%s",
                                 "caciActivites":["LOISIR","PLONGEE_SCAPHANDRE"]}""".formatted(fin, examen)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long id = cree.get("id").asLong();
        assertThat(cree.get("caciDateExamen").asText()).isEqualTo(examen);
        // Rendues dans l'ordre du formulaire, quel que soit l'ordre d'envoi.
        assertThat(textes(cree.get("caciActivites"))).containsExactly("PLONGEE_SCAPHANDRE", "LOISIR");

        JsonNode modifie = json.readTree(mvc.perform(put("/api/eleves/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Caci","prenom":"Lou","autorisationLegale":true,
                                 "certificatValideJusquAu":"%s"}""".formatted(fin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(modifie.get("caciDateExamen").isNull()).isTrue();
        assertThat(modifie.get("caciActivites").size()).isZero();
    }

    @Test
    @DisplayName("Une date d'examen à venir ou après la fin de validité est refusée")
    void datesIncoherentesRefusees() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Caci","prenom":"Futur","autorisationLegale":true,
                                 "caciDateExamen":"%s"}""".formatted(LocalDate.now().plusDays(3))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value("La date de l'examen du CACI ne peut pas être dans le futur."));
        mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Caci","prenom":"Inverse","autorisationLegale":true,
                                 "caciDateExamen":"%s","certificatValideJusquAu":"%s"}"""
                                .formatted(LocalDate.now().minusDays(3), LocalDate.now().minusDays(10))))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    @DisplayName("Les encadrants voient la date et les cases cochées dans « Infos élèves »")
    void rosterDonneLesCases() throws Exception {
        JsonNode roster = json.readTree(mvc.perform(get("/api/roster").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode camille = null;
        for (JsonNode ligne : roster.get("eleves")) {
            if (ligne.get("eleve").asText().equals("Camille Berthier")) camille = ligne;
        }
        assertThat(camille).isNotNull();
        assertThat(camille.has("caciDateExamen")).isTrue();
        assertThat(camille.get("caciActivites").isArray()).isTrue();
    }
}
