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
 * Ce que chaque groupe a travaillé pendant une séance, retrouvé d'après les
 * notes (sans programme préparé) : les exercices notés et les critères notés
 * sans exercice, par exemple par la notation groupée.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class TravailSeanceTest {

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
                {"nom":"Travail","prenom":"%s","dateNaissance":"2000-01-01","autorisationLegale":true}"""
                .formatted(prenom), 201).get("id").asLong();
    }

    @Test
    @DisplayName("Sans programme préparé, les notes d'une séance disent par groupe les exercices et critères travaillés")
    void travailParGroupeDapresLesNotes() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long saison = saisonOuverte(admin);
        long alice = eleve(admin, "Alice");
        long bruno = eleve(admin, "Bruno");
        long chloe = eleve(admin, "Chloe");
        long groupe = envoyer("POST", "/api/groupes-entrainement", admin, """
                {"saisonId":%d,"nom":"Groupe travail","niveauPrepare":"N1"}""".formatted(saison), 201)
                .get("id").asLong();
        long seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":13,"milieu":"ARTIFICIEL","lieu":"Piscine travail"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        try {
            long cAlice = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(alice, saison), 201).get("id").asLong();
            long cBruno = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(bruno, saison), 201).get("id").asLong();
            long cChloe = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(chloe, saison), 201).get("id").asLong();
            for (long e : new long[] {alice, bruno}) {
                envoyer("PUT", "/api/groupes-entrainement/saison/" + saison + "/eleves/" + e, admin,
                        "{\"groupeId\":" + groupe + "}", 200);
            }
            envoyer("PUT", "/api/seances/" + seanceId + "/presences", moniteur, """
                    [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"},
                     {"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"},
                     {"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cAlice, cBruno, cChloe), 200);

            JsonNode bloc = envoyer("GET", "/api/cursus/" + cAlice + "/grille", moniteur, null, 200).get("blocs").get(0);
            JsonNode critere = bloc.get("criteres").get(0);
            long critereId = critere.get("id").asLong();
            long exercice16 = 0;
            for (JsonNode e : bloc.get("exercices")) {
                if (e.get("numero").asText().equals("1.6")) exercice16 = e.get("id").asLong();
            }

            // Rien de noté : aucun groupe n'a de travail à montrer.
            assertThat(envoyer("GET", "/api/seances/" + seanceId + "/travail", moniteur, null, 200)
                    .get("groupes")).isEmpty();

            // Notation groupée d'Alice et Bruno, sans exercice ; Bruno noté aussi sur l'exercice 1.6 ;
            // Chloé, sans groupe, notée sur le même critère sans exercice.
            envoyer("POST", "/api/seances/" + seanceId + "/notation-groupee", moniteur, """
                    {"cursusIds":[%d,%d],"criteres":[{"critereId":%d,"commentaire":"Vu en groupe"}]}"""
                    .formatted(cAlice, cBruno, critereId), 200);
            envoyer("POST", "/api/cursus/" + cBruno + "/evaluations", moniteur, """
                    {"critereId":%d,"seanceId":%d,"statut":"EN_COURS","exerciceId":%d,"commentaire":"Hésitant"}"""
                    .formatted(critereId, seanceId, exercice16), 201);
            envoyer("POST", "/api/cursus/" + cChloe + "/evaluations", moniteur, """
                    {"critereId":%d,"seanceId":%d,"statut":"EN_COURS","commentaire":"Premier essai"}"""
                    .formatted(critereId, seanceId), 201);

            JsonNode groupes = envoyer("GET", "/api/seances/" + seanceId + "/travail", moniteur, null, 200)
                    .get("groupes");
            assertThat(groupes).hasSize(2);

            JsonNode duGroupe = groupes.get(0);
            assertThat(duGroupe.get("groupeId").asLong()).isEqualTo(groupe);
            assertThat(duGroupe.get("nom").asText()).isEqualTo("Groupe travail");
            assertThat(duGroupe.get("elevesNotes").asInt()).isEqualTo(2);
            assertThat(duGroupe.get("exercices")).hasSize(1);
            assertThat(duGroupe.get("exercices").get(0).get("exercice").get("numero").asText()).isEqualTo("1.6");
            assertThat(duGroupe.get("exercices").get(0).get("eleves").asInt()).isEqualTo(1);
            assertThat(duGroupe.get("criteres")).hasSize(1);
            JsonNode sansExercice = duGroupe.get("criteres").get(0);
            assertThat(sansExercice.get("critereId").asLong()).isEqualTo(critereId);
            assertThat(sansExercice.get("bloc").asText()).isEqualTo(bloc.get("intitule").asText());
            assertThat(sansExercice.get("savoirFaire").asText()).isEqualTo(critere.get("savoirFaire").asText());
            assertThat(sansExercice.get("eleves").asInt()).isEqualTo(2);

            JsonNode sansGroupe = groupes.get(1);
            assertThat(sansGroupe.get("groupeId").isNull()).isTrue();
            assertThat(sansGroupe.get("nom").asText()).isEqualTo("Sans groupe");
            assertThat(sansGroupe.get("elevesNotes").asInt()).isEqualTo(1);
            assertThat(sansGroupe.get("exercices")).isEmpty();
            assertThat(sansGroupe.get("criteres").get(0).get("eleves").asInt()).isEqualTo(1);

            // Un élève ne consulte pas le travail d'une séance.
            envoyer("GET", "/api/seances/" + seanceId + "/travail", jeton("eleve@club.fr"), null, 403);
        } finally {
            mvc.perform(delete("/api/groupes-entrainement/" + groupe).header("Authorization", admin));
            for (long id : new long[] {alice, bruno, chloe}) {
                mvc.perform(post("/api/eleves/" + id + "/archivage").header("Authorization", admin));
                mvc.perform(delete("/api/eleves/" + id).header("Authorization", admin));
            }
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }
}
