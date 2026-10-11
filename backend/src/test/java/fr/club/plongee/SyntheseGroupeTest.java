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
 * Synthèse des compétences d'un groupe d'entraînement : un élève par ligne,
 * une compétence par colonne, l'état repris de la grille de chaque élève.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SyntheseGroupeTest {

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
                {"nom":"Groupesynthese","prenom":"%s","dateNaissance":"2000-01-01","autorisationLegale":true}"""
                .formatted(prenom), 201).get("id").asLong();
    }

    @Test
    @DisplayName("La synthèse d'un groupe donne, compétence par compétence, l'avancement de chaque élève")
    void syntheseDuGroupe() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long saison = saisonOuverte(admin);
        long alice = eleve(admin, "Alice");
        long bruno = eleve(admin, "Bruno");
        long chloe = eleve(admin, "Chloe");
        long groupe = envoyer("POST", "/api/groupes-entrainement", admin, """
                {"saisonId":%d,"nom":"Groupe synthèse","niveauPrepare":"N1"}""".formatted(saison), 201)
                .get("id").asLong();
        long seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":14,"milieu":"ARTIFICIEL","lieu":"Piscine groupe"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        try {
            long cAlice = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(alice, saison), 201).get("id").asLong();
            envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(bruno, saison), 201);
            // Chloé est dans le groupe sans formation cette saison : une simple adhésion.
            envoyer("POST", "/api/adhesions", admin, """
                    {"eleveId":%d,"saisonId":%d,"groupeId":%d}""".formatted(chloe, saison, groupe), 201);
            for (long e : new long[] {alice, bruno}) {
                envoyer("PUT", "/api/groupes-entrainement/saison/" + saison + "/eleves/" + e, admin,
                        "{\"groupeId\":" + groupe + "}", 200);
            }
            envoyer("PUT", "/api/seances/" + seanceId + "/presences", moniteur, """
                    [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cAlice), 200);

            // Alice acquiert un critère sur son exercice de maîtrise.
            JsonNode bloc = envoyer("GET", "/api/cursus/" + cAlice + "/grille", moniteur, null, 200).get("blocs").get(0);
            long blocId = bloc.get("id").asLong();
            long critere = bloc.get("criteres").get(0).get("id").asLong();
            long maitrise = 0;
            for (JsonNode e : bloc.get("exercices")) {
                boolean travaille = false;
                for (JsonNode c : e.get("critereIds")) travaille |= c.asLong() == critere;
                if (travaille && e.get("phase").asText().equals("MAITRISE")) maitrise = e.get("id").asLong();
            }
            assertThat(maitrise).isPositive();
            envoyer("POST", "/api/cursus/" + cAlice + "/evaluations", moniteur, """
                    {"critereId":%d,"seanceId":%d,"statut":"ACQUIS","exerciceId":%d,"commentaire":"Très bien"}"""
                    .formatted(critere, seanceId, maitrise), 201);

            JsonNode synthese = envoyer("GET", "/api/groupes-entrainement/" + groupe + "/synthese-competences",
                    moniteur, null, 200);
            assertThat(synthese.get("groupe").asText()).isEqualTo("Groupe synthèse");
            assertThat(synthese.get("sansFormation")).extracting(JsonNode::asText)
                    .containsExactly("Chloe Groupesynthese");
            assertThat(synthese.get("formations")).hasSize(1);
            JsonNode formation = synthese.get("formations").get(0);
            assertThat(formation.get("niveau").asText()).isEqualTo("N1");
            JsonNode competence = formation.get("competences").get(0);
            assertThat(competence.get("blocId").asLong()).isEqualTo(blocId);
            assertThat(competence.get("acquises").asInt()).isZero();
            assertThat(competence.get("enCours").asInt()).isEqualTo(1);
            assertThat(competence.get("nonTravaillees").asInt()).isEqualTo(1);

            // Seulement l'état de la compétence : Alice l'a travaillée, Bruno non.
            JsonNode eleves = formation.get("eleves");
            assertThat(eleves).extracting(e -> e.get("eleve").asText())
                    .containsExactly("Alice Groupesynthese", "Bruno Groupesynthese");
            JsonNode caseAlice = eleves.get(0).get("cases").get(0);
            assertThat(caseAlice.get("etat").asText()).isEqualTo("ECA");
            assertThat(caseAlice.has("acquis")).isFalse();
            assertThat(eleves.get(0).get("acquises").asInt()).isZero();
            // Pas de photo déposée : les initiales s'affichent.
            assertThat(eleves.get(0).get("aPhoto").asBoolean()).isFalse();
            assertThat(eleves.get(1).get("cases").get(0).get("etat").asText()).isEqualTo("NT");

            // Un élève ne consulte pas la synthèse d'un groupe.
            envoyer("GET", "/api/groupes-entrainement/" + groupe + "/synthese-competences",
                    jeton("eleve@club.fr"), null, 403);
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
