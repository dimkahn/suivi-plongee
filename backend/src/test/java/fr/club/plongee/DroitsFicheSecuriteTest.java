package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Qui établit, qui complète une fiche de sécurité (choix du club, 2026) :
 * établir ou modifier est réservé aux E3, E4, administrateurs et moniteurs
 * qui ont reçu le droit FICHE_SECURITE ; compléter au retour est ouvert à
 * tous les moniteurs et aux comptes « sécurité surface », qui ne font rien
 * d'autre.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class DroitsFicheSecuriteTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email, String motDePasse) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"%s\"}".formatted(email, motDePasse)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private String jeton(String email) throws Exception {
        return jeton(email, "plongee2026");
    }

    private long moniteurId(String admin, String email) throws Exception {
        String reponse = mvc.perform(get("/api/admin/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode m : json.readTree(reponse)) {
            if (email.equals(m.get("email").asText())) return m.get("id").asLong();
        }
        throw new IllegalStateException("Moniteur introuvable : " + email);
    }

    private long creerSeance(String admin) throws Exception {
        String reponse = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"dateSeance":"2026-06-08","milieu":"NATUREL","lieu":"Carriere","profondeurMax":20}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    private String fiche(long dpId) {
        return """
                {"dpId":%d,"palanquees":[{"numero":1,"profondeurPrevue":20,"dureePrevue":40,
                  "membres":[{"nom":"Dulac","prenom":"Anis","aptitude":"N2","fonction":"PLONGEUR"}]}]}
                """.formatted(dpId);
    }

    private static final String REALISE = "[{\"numero\":1,\"profondeurRealisee\":18,\"dureeRealisee\":38}]";

    @Test
    @DisplayName("Un E1 sans le droit ne peut ni établir ni proposer, mais complète au retour")
    void e1CompleteSansEtablir() throws Exception {
        String admin = jeton("presidente@club.fr");
        String e1 = jeton("e1@club.fr");
        long seance = creerSeance(admin);
        long dp = moniteurId(admin, "e3@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", e1)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(dp)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("E3 ou E4")));
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/proposition").header("Authorization", e1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profondeur\":20,\"type\":\"EXPLORATION\",\"plongeurs\":[]}"))
                .andExpect(status().isUnprocessableContent());

        // Un E3 établit sans droit particulier ; l'E1 complète ensuite.
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", jeton("e3@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(dp)))
                .andExpect(status().isOk());
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", e1)
                        .contentType(MediaType.APPLICATION_JSON).content(REALISE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.palanquees[0].profondeurRealisee").value(18));
    }

    @Test
    @DisplayName("Le droit FICHE_SECURITE, donné dans l'écran Moniteurs, permet d'établir sans être E3")
    void droitDonneParLAdmin() throws Exception {
        String admin = jeton("presidente@club.fr");
        String email = "droit-" + UUID.randomUUID().toString().substring(0, 8) + "@club.fr";
        String cree = mvc.perform(post("/api/admin/moniteurs").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"Droit","prenom":"Dana","niveauEncadrement":"E1"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ficheSecurite").value(false))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(cree).get("id").asLong();
        mvc.perform(put("/api/admin/moniteurs/" + id + "/mot-de-passe").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nouveauMotDePasse\":\"motdepasse-dana\"}"))
                .andExpect(status().isNoContent());
        String dana = jeton(email, "motdepasse-dana");
        long seance = creerSeance(admin);
        long dp = moniteurId(admin, "e3@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", dana)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(dp)))
                .andExpect(status().isUnprocessableContent());

        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"Droit","prenom":"Dana","niveauEncadrement":"E1","ficheSecurite":true}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ficheSecurite").value(true));
        // Les rôles sont relus à chaque requête : le même jeton suffit.
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", dana)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(dp)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("La sécurité surface lit et complète la fiche, et rien d'autre")
    void securiteSurface() throws Exception {
        String admin = jeton("presidente@club.fr");
        String surface = jeton("surface@club.fr");
        long seance = creerSeance(admin);
        long dp = moniteurId(admin, "e3@club.fr");
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(dp)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", surface))
                .andExpect(status().isOk());
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", surface)
                        .contentType(MediaType.APPLICATION_JSON).content(REALISE))
                .andExpect(status().isOk());

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", surface)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(dp)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/seances/" + seance + "/presences").header("Authorization", surface))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/moniteurs").header("Authorization", surface))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Les comptes de sécurité surface se gèrent à part des moniteurs")
    void gestionDesComptesSurface() throws Exception {
        String admin = jeton("presidente@club.fr");
        String email = "surface-" + UUID.randomUUID().toString().substring(0, 8) + "@club.fr";
        String cree = mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"Bouee","prenom":"Lou"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.actif").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(cree).get("id").asLong();

        String liste = mvc.perform(get("/api/admin/securite-surface").header("Authorization", admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(liste).contains(email).contains("surface@club.fr");
        String moniteurs = mvc.perform(get("/api/admin/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        assertThat(moniteurs).doesNotContain(email);

        mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"e1@club.fr","nom":"X","prenom":"Y"}
                                """))
                .andExpect(status().isUnprocessableContent());
        // Un moniteur n'est pas un compte de sécurité surface.
        mvc.perform(delete("/api/admin/securite-surface/" + moniteurId(admin, "e1@club.fr"))
                        .header("Authorization", admin))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/securite-surface").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isForbidden());

        mvc.perform(put("/api/admin/securite-surface/" + id + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actif").value(false));
        mvc.perform(delete("/api/admin/securite-surface/" + id).header("Authorization", admin))
                .andExpect(status().isNoContent());
    }
}
