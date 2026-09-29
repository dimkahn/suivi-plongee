package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La liste des élèves (écran d'administration) dit qui a une photo, pour
 * l'afficher sur chaque ligne — jamais sans le droit à l'image.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PhotoListeElevesTest {

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

    private JsonNode dansLaListe(String admin, long id) throws Exception {
        JsonNode liste = json.readTree(mvc.perform(get("/api/eleves").header("Authorization", admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        for (JsonNode e : liste) {
            if (e.get("id").asLong() == id) return e;
        }
        throw new AssertionError("Élève absent de la liste");
    }

    private void autorisationImage(String admin, long id, boolean valeur) throws Exception {
        mvc.perform(put("/api/eleves/" + id + "/autorisation-image").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"autorisationImage\":" + valeur + "}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("La liste signale la photo d'un élève, et plus du tout après retrait du droit à l'image")
    void photoSignaleeDansLaListe() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode cree = json.readTree(mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Portrait","prenom":"Lou","autorisationLegale":true}"""))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long id = cree.get("id").asLong();
        assertThat(cree.get("aPhoto").asBoolean()).isFalse();

        autorisationImage(admin, id, true);
        mvc.perform(multipart("/api/eleves/" + id + "/photo").file(new MockMultipartFile(
                        "fichier", "lou.png", MediaType.IMAGE_PNG_VALUE, new byte[] {(byte) 0x89, 'P', 'N', 'G'}))
                        .header("Authorization", admin))
                .andExpect(status().isNoContent());
        assertThat(dansLaListe(admin, id).get("aPhoto").asBoolean()).isTrue();

        autorisationImage(admin, id, false);
        assertThat(dansLaListe(admin, id).get("aPhoto").asBoolean()).isFalse();
    }
}
