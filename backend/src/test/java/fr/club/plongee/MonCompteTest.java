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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un moniteur modifie son propre compte (identite, e-mail, mot de passe),
 * mais pas son niveau d'encadrement, qui reste du ressort de l'ADMIN.
 * Chaque test travaille sur un moniteur cree pour l'occasion : les comptes
 * de demonstration servent aux autres tests et ne doivent pas changer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class MonCompteTest {

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

    /** Cree un moniteur E1 via l'admin et lui fixe un mot de passe connu ; renvoie son e-mail. */
    private String nouveauMoniteur() throws Exception {
        String admin = jeton("presidente@club.fr", "plongee2026");
        String email = "m-" + UUID.randomUUID() + "@club.fr";
        String cree = mvc.perform(post("/api/admin/moniteurs").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","nom":"Test","prenom":"Moniteur","niveauEncadrement":"E1"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(cree).get("id").asLong();
        mvc.perform(put("/api/admin/moniteurs/" + id + "/mot-de-passe").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nouveauMotDePasse":"%s"}""".formatted(MOT_DE_PASSE)))
                .andExpect(status().isNoContent());
        return email;
    }

    @Test
    @DisplayName("Un moniteur corrige son nom et sa licence, sans toucher a son niveau")
    void modifierIdentite() throws Exception {
        String email = nouveauMoniteur();
        String moi = jeton(email, MOT_DE_PASSE);

        mvc.perform(put("/api/auth/moi").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Cousteau","prenom":"Jacques-Yves","numeroLicence":"A-99","niveauEncadrement":"E4"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomComplet").value("Jacques-Yves Cousteau"))
                .andExpect(jsonPath("$.numeroLicence").value("A-99"))
                .andExpect(jsonPath("$.niveauEncadrement").value("E1"));
    }

    @Test
    @DisplayName("Changer d'e-mail exige le mot de passe actuel, puis on se connecte avec le nouveau")
    void changerEmail() throws Exception {
        String email = nouveauMoniteur();
        String moi = jeton(email, MOT_DE_PASSE);
        String nouvelEmail = "n-" + UUID.randomUUID() + "@club.fr";

        mvc.perform(put("/api/auth/moi/email").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nouvelEmail":"%s","motDePasseActuel":"mauvais"}""".formatted(nouvelEmail)))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(put("/api/auth/moi/email").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nouvelEmail":"e1@club.fr","motDePasseActuel":"%s"}""".formatted(MOT_DE_PASSE)))
                .andExpect(status().isUnprocessableEntity());

        String reponse = mvc.perform(put("/api/auth/moi/email").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nouvelEmail":"%s","motDePasseActuel":"%s"}""".formatted(nouvelEmail, MOT_DE_PASSE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(nouvelEmail))
                .andReturn().getResponse().getContentAsString();

        // Le jeton renvoye porte le nouvel e-mail et reste utilisable.
        JsonNode session = json.readTree(reponse);
        mvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + session.get("jetonAcces").asText()))
                .andExpect(status().isOk());
        jeton(nouvelEmail, MOT_DE_PASSE);
    }

    @Test
    @DisplayName("Changer de mot de passe exige l'ancien et remplace l'ancien a la connexion")
    void changerMotDePasse() throws Exception {
        String email = nouveauMoniteur();
        String moi = jeton(email, MOT_DE_PASSE);

        mvc.perform(put("/api/auth/moi/mot-de-passe").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"motDePasseActuel":"mauvais","nouveauMotDePasse":"nouveau-mot-de-passe"}"""))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(put("/api/auth/moi/mot-de-passe").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"motDePasseActuel":"%s","nouveauMotDePasse":"court"}""".formatted(MOT_DE_PASSE)))
                .andExpect(status().isUnprocessableEntity());

        String setCookie = mvc.perform(put("/api/auth/moi/mot-de-passe").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"motDePasseActuel":"%s","nouveauMotDePasse":"nouveau-mot-de-passe"}"""
                                .formatted(MOT_DE_PASSE)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).startsWith("refresh=");

        mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"%s"}""".formatted(email, MOT_DE_PASSE)))
                .andExpect(status().isUnauthorized());
        jeton(email, "nouveau-mot-de-passe");
    }

    @Test
    @DisplayName("L'admin modifie le niveau d'encadrement ; un moniteur ne peut pas appeler cette route")
    void adminModifieLeNiveau() throws Exception {
        String email = nouveauMoniteur();
        String admin = jeton("presidente@club.fr", "plongee2026");
        String liste = mvc.perform(get("/api/admin/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        long id = -1;
        for (JsonNode m : json.readTree(liste)) {
            if (email.equals(m.get("email").asText())) id = m.get("id").asLong();
        }
        String corps = """
                {"email":"%s","nom":"Test","prenom":"Moniteur","niveauEncadrement":"E3"}""".formatted(email);

        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", jeton(email, MOT_DE_PASSE))
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isForbidden());

        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.niveauEncadrement").value("E3"));
    }

    @Test
    @DisplayName("L'admin saisit la fin de validite du CACI ; le moniteur la voit sans pouvoir la changer")
    void caciEncadrant() throws Exception {
        String email = nouveauMoniteur();
        String admin = jeton("presidente@club.fr", "plongee2026");
        String liste = mvc.perform(get("/api/admin/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        long id = -1;
        for (JsonNode m : json.readTree(liste)) {
            if (email.equals(m.get("email").asText())) {
                id = m.get("id").asLong();
                assertThat(m.get("certificatValideJusquAu").isNull()).isTrue();
            }
        }

        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","nom":"Test","prenom":"Moniteur","niveauEncadrement":"E1",
                                  "certificatValideJusquAu":"2027-06-30"}""".formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.certificatValideJusquAu").value("2027-06-30"));

        String moi = jeton(email, MOT_DE_PASSE);
        mvc.perform(get("/api/auth/moi").header("Authorization", moi))
                .andExpect(jsonPath("$.certificatValideJusquAu").value("2027-06-30"));

        // Le moniteur ne peut pas modifier sa date lui-meme : le champ est ignore.
        mvc.perform(put("/api/auth/moi").header("Authorization", moi)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Test","prenom":"Moniteur","certificatValideJusquAu":"2099-01-01"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.certificatValideJusquAu").value("2027-06-30"));
    }
}
