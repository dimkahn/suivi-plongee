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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Synthèse des notations d'une séance pour un niveau : par critère (combien
 * d'acquis, d'en cours) et par élève présent, notés ou non.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SyntheseSeanceTest {

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

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long saisonOuverte(String admin) throws Exception {
        for (JsonNode s : envoyer("GET", "/api/saisons", admin, null, 200)) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new AssertionError("Aucune saison ouverte");
    }

    private long eleve(String admin, String prenom) throws Exception {
        return envoyer("POST", "/api/eleves", admin, """
                {"nom":"Synthese","prenom":"%s","dateNaissance":"2000-01-01","autorisationLegale":true}"""
                .formatted(prenom), 201).get("id").asLong();
    }

    @Test
    @DisplayName("La synthèse d'une séance compte, critère par critère, les élèves du niveau, et signale les non notés")
    void syntheseParNiveau() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long saison = saisonOuverte(admin);
        long alice = eleve(admin, "Alice");
        long bruno = eleve(admin, "Bruno");
        long chloe = eleve(admin, "Chloe");
        long seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":12,"milieu":"ARTIFICIEL","lieu":"Piscine synthèse"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        try {
            long cAlice = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(alice, saison), 201).get("id").asLong();
            long cBruno = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(bruno, saison), 201).get("id").asLong();
            long cChloe = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(chloe, saison), 201).get("id").asLong();
            envoyer("PUT", "/api/seances/" + seanceId + "/presences", moniteur, """
                    [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"},
                     {"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"},
                     {"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cAlice, cBruno, cChloe), 200);

            JsonNode bloc = envoyer("GET", "/api/cursus/" + cAlice + "/grille", moniteur, null, 200).get("blocs").get(0);
            long critere = bloc.get("criteres").get(0).get("id").asLong();
            String note = """
                    {"critereId":%d,"seanceId":%d,"statut":"%s","commentaire":"%s"}""";
            envoyer("POST", "/api/cursus/" + cAlice + "/evaluations", moniteur,
                    note.formatted(critere, seanceId, "EN_COURS", "Premier essai"), 201);
            envoyer("POST", "/api/cursus/" + cBruno + "/evaluations", moniteur,
                    note.formatted(critere, seanceId, "EN_COURS", "Hésitant"), 201);
            // Une correction le même jour : seule la dernière note compte dans la synthèse.
            envoyer("POST", "/api/cursus/" + cAlice + "/evaluations", moniteur,
                    note.formatted(critere, seanceId, "NON_ABORDE", "Pas vu finalement"), 201);

            JsonNode synthese = envoyer("GET", "/api/seances/" + seanceId + "/synthese?niveau=N1", moniteur, null, 200);
            assertThat(synthese.get("niveau").asText()).isEqualTo("N1");
            assertThat(synthese.get("presents").asInt()).isEqualTo(3);
            assertThat(synthese.get("presentsNotes").asInt()).isEqualTo(2);
            assertThat(synthese.get("notes").asInt()).isEqualTo(3);

            JsonNode ligne = synthese.get("criteres").get(0);
            assertThat(ligne.get("critereId").asLong()).isEqualTo(critere);
            assertThat(ligne.get("enCours").asInt()).isEqualTo(1);
            assertThat(ligne.get("nonAborde").asInt()).isEqualTo(1);
            assertThat(ligne.get("acquis").asInt()).isZero();

            JsonNode eleves = synthese.get("eleves");
            assertThat(eleves).hasSize(3);
            assertThat(eleves.get(0).get("eleve").asText()).isEqualTo("Alice Synthese");
            assertThat(eleves.get(0).get("atelier").asText()).isEqualTo("BLOC");
            assertThat(eleves.get(0).get("notePar")).extracting(JsonNode::asText).containsExactly("Flora Vasseur");
            assertThat(eleves.get(2).get("notePar")).isEmpty();
            JsonNode noteAlice = eleves.get(0).get("notes").get(0);
            assertThat(noteAlice.get("statut").asText()).isEqualTo("NON_ABORDE");
            assertThat(noteAlice.get("commentaires")).extracting(JsonNode::asText)
                    .containsExactly("Premier essai", "Pas vu finalement");
            assertThat(noteAlice.get("parQui").asText()).isEqualTo("Flora Vasseur");
            assertThat(eleves.get(2).get("eleve").asText()).isEqualTo("Chloe Synthese");
            assertThat(eleves.get(2).get("notes")).isEmpty();

            // Un élève ne consulte pas la synthèse d'une séance.
            envoyer("GET", "/api/seances/" + seanceId + "/synthese", jeton("eleve@club.fr"), null, 403);
        } finally {
            for (long id : new long[] {alice, bruno, chloe}) {
                mvc.perform(post("/api/eleves/" + id + "/archivage").header("Authorization", admin));
                mvc.perform(delete("/api/eleves/" + id).header("Authorization", admin));
            }
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }
}
