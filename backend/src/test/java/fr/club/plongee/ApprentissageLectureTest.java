package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Les corrections faites après la lecture d'une note deviennent des règles
 * pour tout le club : tel commerçant → telle catégorie, tel libellé de
 * ligne → le total. Seuls le commerçant, la catégorie et le libellé sont
 * envoyés, jamais la photo ni le texte du ticket.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ApprentissageLectureTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = methode.equals("POST") ? post(url) : get(url);
        if (jeton != null) requete = requete.header("Authorization", jeton);
        String reponse = mvc.perform(requete.contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    /** Un séjour où Flora (e2, moniteur) et Camille (élève, eleve@club.fr) sont inscrites. */
    private String sejour() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(280);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour apprentissage","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long flora = 0, camille = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
            if (c.get("prenom").asText().equals("Camille") && c.hasNonNull("eleveId")) camille = c.get("eleveId").asLong();
        }
        envoyer("POST", base + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora), 200);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(camille), 200);
        return base;
    }

    private static JsonNode regleDe(JsonNode regles, String enseigne) {
        for (JsonNode r : regles) if (r.get("enseigne").asText().equals(enseigne)) return r;
        return null;
    }

    @Test
    @DisplayName("Une correction après lecture apprend la catégorie et le libellé du total d'un commerçant")
    void uneCorrectionApprendUneRegle() throws Exception {
        String base = sejour();
        String e2 = jeton("e2@club.fr");

        envoyer("POST", base + "/lecture-notes/apprentissage", e2,
                "{\"enseigne\":\"CHEZ MARCEL\",\"categorie\":\"REPAS\",\"libelleTotal\":\"A REGLER\"}", 204);

        JsonNode regle = regleDe(envoyer("GET", base + "/lecture-notes/regles", e2, null, 200), "CHEZ MARCEL");
        assertThat(regle).isNotNull();
        assertThat(regle.get("categorie").asText()).isEqualTo("REPAS");
        assertThat(regle.get("libelleTotal").asText()).isEqualTo("A REGLER");
    }

    @Test
    @DisplayName("Quand les corrections divergent, la catégorie la plus souvent choisie l'emporte")
    void laCategorieLaPlusChoisieLEmporte() throws Exception {
        String base = sejour();
        String e2 = jeton("e2@club.fr");
        String url = base + "/lecture-notes/apprentissage";

        envoyer("POST", url, e2, "{\"enseigne\":\"MARINA DU PORT\",\"categorie\":\"REPAS\"}", 204);
        envoyer("POST", url, e2, "{\"enseigne\":\"MARINA DU PORT\",\"categorie\":\"TRANSPORT\"}", 204);
        envoyer("POST", url, e2, "{\"enseigne\":\"MARINA DU PORT\",\"categorie\":\"TRANSPORT\"}", 204);

        JsonNode regle = regleDe(envoyer("GET", base + "/lecture-notes/regles", e2, null, 200), "MARINA DU PORT");
        assertThat(regle.get("categorie").asText()).isEqualTo("TRANSPORT");
        assertThat(regle.get("libelleTotal").isNull()).isTrue();
    }

    @Test
    @DisplayName("Rien n'est appris d'un nom de commerçant ou d'un libellé illisible, ni d'un encadrant hors du séjour, ni sans connexion")
    void lesApprentissagesRefuses() throws Exception {
        String base = sejour();
        String e2 = jeton("e2@club.fr");
        String url = base + "/lecture-notes/apprentissage";

        envoyer("POST", url, e2, "{\"enseigne\":\"#@\",\"categorie\":\"REPAS\"}", 422);
        envoyer("POST", url, e2, "{\"enseigne\":\"CHEZ MARCEL\",\"libelleTotal\":\"12,50\"}", 422);
        envoyer("POST", url, e2, "{\"enseigne\":\"CHEZ MARCEL\"}", 422);
        JsonNode refus = envoyer("POST", url, jeton("e1@club.fr"),
                "{\"enseigne\":\"CHEZ MARCEL\",\"categorie\":\"REPAS\"}", 422);
        assertThat(refus.get("detail").asText()).contains("Seuls les participants");
        envoyer("POST", "/api/public/sejour/inconnu/lecture-notes/apprentissage", null,
                "{\"enseigne\":\"CHEZ MARCEL\",\"categorie\":\"REPAS\"}", 403);
    }
}
