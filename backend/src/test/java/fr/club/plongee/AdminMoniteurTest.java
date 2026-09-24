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

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Role ADMIN d'un moniteur et photo du trombinoscope des moniteurs.
 * Chaque test travaille sur un moniteur cree pour l'occasion : les comptes
 * de demonstration servent aux autres tests et ne doivent pas changer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AdminMoniteurTest {

    private static final String MOT_DE_PASSE = "motdepasse-initial";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email, String motDePasse) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"%s"}""".formatted(email, motDePasse)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private String admin() throws Exception {
        return jeton("presidente@club.fr", "plongee2026");
    }

    /** Cree un moniteur E1 avec un mot de passe connu ; renvoie sa vue. */
    private JsonNode nouveauMoniteur(String admin) throws Exception {
        String email = "m-" + UUID.randomUUID() + "@club.fr";
        String cree = mvc.perform(post("/api/admin/moniteurs").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","nom":"Test","prenom":"Moniteur","niveauEncadrement":"E1"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.admin").value(false))
                .andReturn().getResponse().getContentAsString();
        JsonNode vue = json.readTree(cree);
        mvc.perform(put("/api/admin/moniteurs/" + vue.get("id").asLong() + "/mot-de-passe")
                        .header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nouveauMotDePasse":"%s"}""".formatted(MOT_DE_PASSE)))
                .andExpect(status().isNoContent());
        return vue;
    }

    private String modification(JsonNode m, Boolean admin) {
        return """
               {"email":"%s","nom":"Test","prenom":"Moniteur","niveauEncadrement":"E1"%s}"""
                .formatted(m.get("email").asText(), admin == null ? "" : ",\"admin\":" + admin);
    }

    @Test
    @DisplayName("Un ADMIN donne puis retire le role administrateur a un moniteur, effectif aussitot")
    void donnerEtRetirerAdmin() throws Exception {
        String admin = admin();
        JsonNode m = nouveauMoniteur(admin);
        long id = m.get("id").asLong();
        String sesDroits = jeton(m.get("email").asText(), MOT_DE_PASSE);

        mvc.perform(get("/api/admin/moniteurs").header("Authorization", sesDroits))
                .andExpect(status().isForbidden());

        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(modification(m, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admin").value(true));

        // Meme jeton : les roles sont relus en base a chaque requete.
        mvc.perform(get("/api/admin/moniteurs").header("Authorization", sesDroits))
                .andExpect(status().isOk());

        // Sans le champ, le role reste tel quel.
        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(modification(m, null)))
                .andExpect(jsonPath("$.admin").value(true));

        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(modification(m, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admin").value(false));

        mvc.perform(get("/api/admin/moniteurs").header("Authorization", sesDroits))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un ADMIN ne peut pas se retirer lui-meme le role administrateur")
    void pasDAutoDestitution() throws Exception {
        String admin = admin();
        JsonNode m = nouveauMoniteur(admin);
        long id = m.get("id").asLong();
        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(modification(m, true)))
                .andExpect(status().isOk());

        String lui = jeton(m.get("email").asText(), MOT_DE_PASSE);
        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", lui)
                        .contentType(MediaType.APPLICATION_JSON).content(modification(m, false)))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("La photo d'un moniteur exige le droit a l'image, et son retrait la supprime")
    void photoSousConsentement() throws Exception {
        String admin = admin();
        long id = nouveauMoniteur(admin).get("id").asLong();
        MockMultipartFile photo = new MockMultipartFile("fichier", "m.jpg", "image/jpeg", new byte[] {1, 2, 3});

        mvc.perform(multipart("/api/admin/moniteurs/" + id + "/photo").file(photo).header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(put("/api/admin/moniteurs/" + id + "/autorisation-image").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"autorisationImage\":true}"))
                .andExpect(status().isOk());
        mvc.perform(multipart("/api/admin/moniteurs/" + id + "/photo").file(photo).header("Authorization", admin))
                .andExpect(status().isNoContent());

        String encadrant = jeton("e1@club.fr", "plongee2026");
        mvc.perform(get("/api/moniteurs/" + id + "/photo").header("Authorization", encadrant))
                .andExpect(status().isOk());
        mvc.perform(get("/api/moniteurs/trombinoscope").header("Authorization", encadrant))
                .andExpect(jsonPath("$[?(@.id == " + id + ")].aPhoto").value(true));

        mvc.perform(put("/api/admin/moniteurs/" + id + "/autorisation-image").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"autorisationImage\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aPhoto").value(false));
        mvc.perform(get("/api/moniteurs/" + id + "/photo").header("Authorization", encadrant))
                .andExpect(status().isNotFound());
    }
}
