package fr.club.plongee;

import fr.club.plongee.commun.Calendrier;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Supprimer une inscription faite par erreur (demande du club, 2026-11-08) :
 * ADMIN seulement, et seulement tant que rien n'y est rattaché. Chaque test
 * crée son élève dans la saison 2025-2026 (fermée depuis V107), sauf celui
 * qui a besoin d'une séance du jour.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SuppressionInscriptionTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private long saison(String jeton, boolean ouverte) throws Exception {
        for (JsonNode s : lire("/api/saisons", jeton)) {
            if (ouverte ? s.get("ouverte").asBoolean() : s.get("libelle").asText().equals("2025-2026")) {
                return s.get("id").asLong();
            }
        }
        throw new AssertionError("Saison absente");
    }

    private long nouvelEleve(String jeton, String prenom) throws Exception {
        return json.readTree(mvc.perform(post("/api/eleves").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Suppression","prenom":"%s","dateNaissance":"1990-01-01","autorisationLegale":true}"""
                                .formatted(prenom)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private long inscrire(String jeton, long eleve, long saison, String niveau) throws Exception {
        return json.readTree(mvc.perform(post("/api/cursus").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"%s"}""".formatted(eleve, saison, niveau)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    @DisplayName("Une inscription faite par erreur, sans rien de rattaché, se supprime ; l'autre formation reste")
    void supprimerUneInscriptionEnTrop() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = saison(admin, false);
        long eleve = nouvelEleve(admin, "Doublon");
        long bonne = inscrire(admin, eleve, saison, "N2");
        long enTrop = inscrire(admin, eleve, saison, "N3");

        mvc.perform(delete("/api/cursus/" + enTrop).header("Authorization", admin))
                .andExpect(status().isNoContent());

        JsonNode restantes = lire("/api/cursus/eleve/" + eleve, admin);
        assertThat(restantes).singleElement().satisfies(c -> assertThat(c.get("id").asLong()).isEqualTo(bonne));
    }

    @Test
    @DisplayName("Supprimer sa seule formation de la saison le laisse adhérent, sans formation")
    void seuleFormationDevientAdhesion() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = saison(admin, false);
        long eleve = nouvelEleve(admin, "Seul");
        long cursus = inscrire(admin, eleve, saison, "N1");

        mvc.perform(delete("/api/cursus/" + cursus).header("Authorization", admin))
                .andExpect(status().isNoContent());

        assertThat(lire("/api/cursus/eleve/" + eleve, admin)).isEmpty();
        assertThat(lire("/api/adhesions?eleveId=" + eleve, admin)).singleElement()
                .satisfies(a -> assertThat(a.get("saison").asText()).isEqualTo("2025-2026"));
    }

    @Test
    @DisplayName("Une inscription qui porte une présence ne se supprime pas (422 lisible)")
    void refusAvecPresence() throws Exception {
        String admin = jeton("presidente@club.fr");
        long eleve = nouvelEleve(admin, "Present");
        long cursus = inscrire(admin, eleve, saison(admin, true), "N1");
        long seance = json.readTree(mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":15,"milieu":"ARTIFICIEL","lieu":"Piscine suppression"}"""
                                .formatted(Calendrier.aujourdhui())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/seances/" + seance + "/presences").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursus)))
                .andExpect(status().isOk());

        mvc.perform(delete("/api/cursus/" + cursus).header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("présences")));
        assertThat(lire("/api/cursus/eleve/" + eleve, admin)).hasSize(1);
    }

    @Test
    @DisplayName("Une inscription déjà notée ne se supprime pas (422 lisible)")
    void refusAvecNotes() throws Exception {
        String admin = jeton("presidente@club.fr");
        // Camille Berthier (démo) : N2 en cours sur la saison ouverte, déjà notée (V107).
        JsonNode camille = null;
        for (JsonNode c : lire("/api/cursus", admin)) if (c.get("eleve").asText().equals("Camille Berthier")) camille = c;

        mvc.perform(delete("/api/cursus/" + camille.get("id").asLong()).header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.startsWith("Des compétences ont déjà été notées")));
    }

    @Test
    @DisplayName("Un moniteur ne supprime pas une inscription (403)")
    void moniteurRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long eleve = nouvelEleve(admin, "Moniteur");
        long cursus = inscrire(admin, eleve, saison(admin, false), "N1");

        mvc.perform(delete("/api/cursus/" + cursus).header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isForbidden());
        assertThat(lire("/api/cursus/eleve/" + eleve, admin)).hasSize(1);
    }
}
