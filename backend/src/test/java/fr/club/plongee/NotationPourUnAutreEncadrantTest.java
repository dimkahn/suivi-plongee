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
 * Un référent de groupe note au nom d'un encadrant qui ne l'a pas fait
 * (choix du club, 2026) : la note porte le nom de l'encadrant, le référent
 * reste tracé comme auteur de la saisie. Personne d'autre ne le peut.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class NotationPourUnAutreEncadrantTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private JsonNode session(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    private String jeton(String email) throws Exception {
        return "Bearer " + session(email).get("jetonAcces").asText();
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

    private long saisonOuverte(String admin) throws Exception {
        for (JsonNode s : envoyer("GET", "/api/saisons", admin, null, 200)) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new AssertionError("Aucune saison ouverte");
    }

    @Test
    @DisplayName("Seul un référent du groupe de l'élève note au nom d'un autre encadrant, sous le nom de celui-ci")
    void referentNotePourUnEncadrant() throws Exception {
        String admin = jeton("presidente@club.fr");
        String referent = jeton("e2@club.fr");
        String autre = jeton("e3@club.fr");
        long idReferent = session("e2@club.fr").get("id").asLong();
        long idEncadrant = session("e1@club.fr").get("id").asLong();
        long idEleveCompte = session("eleve@club.fr").get("id").asLong();
        long saison = saisonOuverte(admin);

        long eleveId = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Remplacement","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}""",
                201).get("id").asLong();
        long seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":11,"milieu":"ARTIFICIEL","lieu":"Piscine remplacement"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        Long groupeId = null;
        try {
            long cursus = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saison), 201)
                    .get("id").asLong();
            groupeId = envoyer("POST", "/api/groupes-entrainement", admin, """
                    {"saisonId":%d,"nom":"Groupe remplacement","encadrantIds":[%d],"referentIds":[%d]}"""
                    .formatted(saison, idEncadrant, idReferent), 201).get("id").asLong();
            envoyer("PUT", "/api/groupes-entrainement/saison/" + saison + "/eleves/" + eleveId, admin, """
                    {"groupeId":%d}""".formatted(groupeId), 200);
            envoyer("PUT", "/api/seances/" + seanceId + "/presences", referent, """
                    [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursus), 200);

            JsonNode grille = envoyer("GET", "/api/cursus/" + cursus + "/grille", referent, null, 200);
            assertThat(grille.get("referentIds")).extracting(JsonNode::asLong).containsExactly(idReferent);
            long critere = grille.get("blocs").get(0).get("criteres").get(0).get("id").asLong();

            String url = "/api/cursus/" + cursus + "/evaluations";
            String note = """
                    {"critereId":%d,"seanceId":%d,"statut":"EN_COURS","pourMoniteurId":%d}""";

            // Un encadrant qui n'est pas référent du groupe ne peut pas noter pour un autre.
            JsonNode refus = envoyer("POST", url, autre, note.formatted(critere, seanceId, idEncadrant), 422);
            assertThat(refus.get("detail").asText()).contains("Seuls les référents du groupe");
            // Le référent ne note qu'au nom d'un encadrant qui peut noter ce brevet.
            refus = envoyer("POST", url, referent, note.formatted(critere, seanceId, idEleveCompte), 422);
            assertThat(refus.get("detail").asText()).contains("ne peut pas noter le N1");

            JsonNode faite = envoyer("POST", url, referent, note.formatted(critere, seanceId, idEncadrant), 201);
            assertThat(faite.get("parQui").asText()).isEqualTo("Tiago Nogueira");
            assertThat(faite.get("saisiPar").asText()).isEqualTo("Flora Vasseur");

            // Par la file hors ligne aussi.
            envoyer("POST", "/api/synchronisation/evaluations", referent, """
                    [{"referenceClient":"remplacement-1","cursusId":%d,"critereId":%d,"seanceId":%d,
                      "statut":"EN_COURS","commentaire":"Rattrapage","dateEvaluation":"%s","pourMoniteurId":%d}]"""
                    .formatted(cursus, critere, seanceId, Calendrier.aujourdhui(), idEncadrant), 200);

            // Une note prise par le référent pour lui-même reste à son nom, sans « saisi par ».
            envoyer("POST", url, referent, """
                    {"critereId":%d,"seanceId":%d,"statut":"EN_COURS","commentaire":"Moi"}"""
                    .formatted(critere, seanceId), 201);

            JsonNode historique = envoyer("GET", "/api/cursus/" + cursus + "/criteres/" + critere + "/historique",
                    referent, null, 200);
            assertThat(historique).hasSize(3);
            assertThat(historique.get(1).get("parQui").asText()).isEqualTo("Tiago Nogueira");
            assertThat(historique.get(1).get("saisiPar").asText()).isEqualTo("Flora Vasseur");
            assertThat(historique.get(2).get("parQui").asText()).isEqualTo("Flora Vasseur");
            assertThat(historique.get(2).get("saisiPar").isNull()).isTrue();
        } finally {
            if (groupeId != null) mvc.perform(delete("/api/groupes-entrainement/" + groupeId).header("Authorization", admin));
            mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin));
            mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin));
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }
}
