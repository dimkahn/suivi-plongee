package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Qui modifie un groupe de plongeurs (V81) : le compte qui a créé la liste et
 * les organisateurs qu'il désigne ; un ADMIN désigne seulement.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class OrganisateursGroupePlongeursTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long saisonOuverte(String jeton) throws Exception {
        for (JsonNode s : envoyer("GET", "/api/saisons", jeton, null, 200)) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new AssertionError("Pas de saison ouverte");
    }

    private long moniteur(String jeton, String nom) throws Exception {
        for (JsonNode m : envoyer("GET", "/api/moniteurs", jeton, null, 200)) {
            if (m.get("nomComplet").asText().contains(nom)) return m.get("id").asLong();
        }
        throw new AssertionError(nom + " introuvable");
    }

    private JsonNode groupe(String jeton, long saison, long id) throws Exception {
        for (JsonNode g : envoyer("GET", "/api/groupes-plongeurs?saisonId=" + saison, jeton, null, 200)) {
            if (g.get("id").asLong() == id) return g;
        }
        throw new AssertionError("Groupe " + id + " absent");
    }

    private static String corps(String nom, long saison) {
        return """
                {"nom":"%s","saisonId":%d,"membres":[{"nom":"Ferry","prenom":"Anis","aptitude":"N2"}]}"""
                .formatted(nom, saison);
    }

    @Test
    @DisplayName("Le créateur modifie et désigne ; un autre encadrant lit seulement ; l'organisateur désigné modifie")
    void createurEtOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr"), e2 = jeton("e2@club.fr"), admin = jeton("presidente@club.fr");
        long saison = saisonOuverte(dt);
        JsonNode g = envoyer("POST", "/api/groupes-plongeurs", dt, corps("Groupe organisé", saison), 200);
        long id = g.get("id").asLong();
        assertThat(g.get("gere").asBoolean()).isTrue();
        assertThat(g.get("peutDesigner").asBoolean()).isTrue();
        assertThat(g.get("organisateurs")).hasSize(1);
        assertThat(g.get("organisateurs").get(0).get("createur").asBoolean()).isTrue();
        envoyer("PUT", "/api/groupes-plongeurs/" + id, dt, corps("Groupe organisé (2)", saison), 200);

        // Un autre moniteur lit, sans rien modifier, supprimer ni désigner.
        JsonNode lu = groupe(e2, saison, id);
        assertThat(lu.get("gere").asBoolean()).isFalse();
        assertThat(lu.get("peutDesigner").asBoolean()).isFalse();
        assertThat(lu.get("membres")).hasSize(1);
        envoyer("PUT", "/api/groupes-plongeurs/" + id, e2, corps("Piraté", saison), 403);
        envoyer("DELETE", "/api/groupes-plongeurs/" + id, e2, null, 403);
        envoyer("PUT", "/api/groupes-plongeurs/" + id + "/organisateurs", e2, """
                {"utilisateurIds":[%d]}""".formatted(moniteur(e2, "Vasseur")), 403);

        // Être ADMIN ne suffit pas pour modifier.
        lu = groupe(admin, saison, id);
        assertThat(lu.get("gere").asBoolean()).isFalse();
        assertThat(lu.get("peutDesigner").asBoolean()).isTrue();
        envoyer("PUT", "/api/groupes-plongeurs/" + id, admin, corps("Piraté", saison), 403);

        // Le créateur désigne Flora : elle modifie, sans désigner à son tour.
        JsonNode apres = envoyer("PUT", "/api/groupes-plongeurs/" + id + "/organisateurs", dt, """
                {"utilisateurIds":[%d]}""".formatted(moniteur(dt, "Vasseur")), 200);
        assertThat(apres.get("organisateurs")).hasSize(2);
        JsonNode modifie = envoyer("PUT", "/api/groupes-plongeurs/" + id, e2, corps("Groupe de Flora", saison), 200);
        assertThat(modifie.get("nom").asText()).isEqualTo("Groupe de Flora");
        assertThat(modifie.get("gere").asBoolean()).isTrue();
        assertThat(modifie.get("peutDesigner").asBoolean()).isFalse();
        envoyer("PUT", "/api/groupes-plongeurs/" + id + "/organisateurs", e2, """
                {"utilisateurIds":[]}""", 403);

        envoyer("DELETE", "/api/groupes-plongeurs/" + id, dt, null, 204);
    }

    @Test
    @DisplayName("Un groupe sans créateur connu (d'avant V81) : un ADMIN en désigne l'organisateur")
    void groupeSansCreateur() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr");
        long saison = saisonOuverte(dt);
        long id = envoyer("POST", "/api/groupes-plongeurs", dt, corps("Groupe ancien", saison), 200)
                .get("id").asLong();
        jdbc.update("UPDATE groupe_plongeurs SET createur_id = NULL WHERE id = ?", id);

        assertThat(groupe(dt, saison, id).get("gere").asBoolean()).isFalse();
        envoyer("PUT", "/api/groupes-plongeurs/" + id, dt, corps("Groupe ancien", saison), 403);

        envoyer("PUT", "/api/groupes-plongeurs/" + id + "/organisateurs", admin, """
                {"utilisateurIds":[%d]}""".formatted(moniteur(admin, "Marchand")), 200);
        envoyer("PUT", "/api/groupes-plongeurs/" + id, dt, corps("Groupe repris", saison), 200);

        // Seul un encadrant actif peut organiser.
        long eleve = jdbc.queryForObject("SELECT id FROM utilisateur WHERE email = 'eleve@club.fr'", Long.class);
        envoyer("PUT", "/api/groupes-plongeurs/" + id + "/organisateurs", admin, """
                {"utilisateurIds":[%d]}""".formatted(eleve), 422);
        envoyer("DELETE", "/api/groupes-plongeurs/" + id, dt, null, 204);
    }
}
