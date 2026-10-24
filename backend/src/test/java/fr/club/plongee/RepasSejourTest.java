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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Les repas d'un séjour pris au restaurant (ou pas à préparer), choisis par
 * l'organisateur pour la liste de courses : les autres repas, du premier au
 * dernier jour, sont à faire soi-même.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class RepasSejourTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    /** Un séjour du 1er au 3 juillet 2031, créé (donc organisé) par e3. */
    private String sejour(String dt) throws Exception {
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour repas","dateDebut":"2031-07-01","dateFin":"2031-07-03"}""", 201).get("id").asLong();
        return "/api/sejours/" + sortie;
    }

    @Test
    @DisplayName("L'organisateur choisit les repas pris au restaurant, que les autres encadrants lisent")
    void choisirLesRepasAuRestaurant() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt);
        assertThat(envoyer("GET", base + "/repas", dt, null, 200).get("auRestaurant")).isEmpty();

        envoyer("PUT", base + "/repas", dt, """
                {"auRestaurant":[{"jour":"2031-07-02","repas":"DINER"},{"jour":"2031-07-01","repas":"DEJEUNER"}]}""", 200);

        JsonNode lus = envoyer("GET", base + "/repas", jeton("e1@club.fr"), null, 200).get("auRestaurant");
        assertThat(lus).hasSize(2);
        assertThat(lus.get(0).get("jour").asText()).isEqualTo("2031-07-01");
        assertThat(lus.get(0).get("repas").asText()).isEqualTo("DEJEUNER");
        assertThat(lus.get(1).get("jour").asText()).isEqualTo("2031-07-02");
        assertThat(lus.get(1).get("repas").asText()).isEqualTo("DINER");

        // La liste est remplacée d'un bloc.
        envoyer("PUT", base + "/repas", dt, """
                {"auRestaurant":[{"jour":"2031-07-03","repas":"PETIT_DEJEUNER"}]}""", 200);
        assertThat(envoyer("GET", base + "/repas", dt, null, 200).get("auRestaurant")).hasSize(1);
    }

    @Test
    @DisplayName("Un encadrant qui n'organise pas le séjour ne choisit pas les repas")
    void encadrantNonOrganisateur() throws Exception {
        String base = sejour(jeton("e3@club.fr"));
        envoyer("PUT", base + "/repas", jeton("e1@club.fr"), """
                {"auRestaurant":[{"jour":"2031-07-02","repas":"DINER"}]}""", 403);
    }

    @Test
    @DisplayName("Un élève ne lit pas les repas ni la liste de courses du séjour")
    void eleveRefuse() throws Exception {
        String base = sejour(jeton("e3@club.fr"));
        envoyer("GET", base + "/repas", jeton("eleve@club.fr"), null, 403);
    }

    @Test
    @DisplayName("Un repas hors des dates du séjour est refusé")
    void repasHorsDuSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt);
        JsonNode erreur = envoyer("PUT", base + "/repas", dt, """
                {"auRestaurant":[{"jour":"2031-07-04","repas":"DINER"}]}""", 422);
        assertThat(erreur.get("detail").asText())
                .isEqualTo("Le 04/07/2031 n'est pas un jour du séjour (du 01/07/2031 au 03/07/2031).");
    }
}
