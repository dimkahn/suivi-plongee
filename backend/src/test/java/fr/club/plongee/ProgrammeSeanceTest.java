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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Programme d'exercices d'une séance : préparé par un moniteur, relié aux
 * critères d'une formation, et repris par la fiche de suivi des élèves.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ProgrammeSeanceTest {

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

    private JsonNode envoyer(String methode, String url, String jeton, Object corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        String contenu = corps == null ? "" : corps instanceof String s ? s : json.writeValueAsString(corps);
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(contenu))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long saisonOuverte(String admin) throws Exception {
        for (JsonNode s : envoyer("GET", "/api/saisons", admin, null, 200)) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new AssertionError("Aucune saison ouverte dans les données de démonstration");
    }

    private long creerSeance(String admin, int ordre) throws Exception {
        return envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":%d,"milieu":"ARTIFICIEL","lieu":"Piscine programme"}"""
                .formatted(Calendrier.aujourdhui(), ordre), 201).get("id").asLong();
    }

    private static Map<String, Object> exercice(String intitule, Long referentielId, List<Long> critereIds) {
        Map<String, Object> e = new java.util.HashMap<>();
        e.put("intitule", intitule);
        e.put("referentielId", referentielId);
        e.put("critereIds", critereIds);
        return e;
    }

    @Test
    @DisplayName("Un moniteur prépare le programme ; la fiche de suivi de l'élève présent le reprend")
    void programmeRepriParLaFiche() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");
        long seanceId = creerSeance(admin, 11);
        long eleveId = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Programme","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}""",
                201).get("id").asLong();
        try {
            long cursusId = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saisonOuverte(admin)),
                    201).get("id").asLong();
            envoyer("PUT", "/api/seances/" + seanceId + "/presences", moniteur, """
                    [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursusId), 200);

            JsonNode grille = envoyer("GET", "/api/cursus/" + cursusId + "/grille", moniteur, null, 200);
            List<Long> criteres = new ArrayList<>();
            for (JsonNode c : grille.get("blocs").get(0).get("criteres")) criteres.add(c.get("id").asLong());

            // La formation de l'élève est proposée, avec son effectif.
            JsonNode vide = envoyer("GET", "/api/seances/" + seanceId + "/programme", moniteur, null, 200);
            assertThat(vide.get("exercices")).isEmpty();
            long referentielN1 = -1;
            long referentielN2 = -1;
            for (JsonNode f : vide.get("formations")) {
                if (f.get("niveau").asText().equals("N1") && f.get("eleves").asInt() > 0) {
                    referentielN1 = f.get("referentielId").asLong();
                }
                if (f.get("niveau").asText().equals("N2")) referentielN2 = f.get("referentielId").asLong();
            }
            assertThat(referentielN1).isPositive();
            assertThat(referentielN2).isPositive();

            JsonNode programme = envoyer("PUT", "/api/seances/" + seanceId + "/programme", moniteur, List.of(
                    exercice("Échauffement 200 m PMT", null, List.of()),
                    exercice("Vidage de masque", referentielN1, criteres.subList(0, 2))), 200);
            assertThat(programme.get("exercices")).hasSize(2);
            assertThat(programme.get("exercices").get(1).get("ordre").asInt()).isEqualTo(2);
            assertThat(programme.get("exercices").get(1).get("criteres")).hasSize(2);
            assertThat(programme.get("exercices").get(1).get("niveau").asText()).isEqualTo("N1");

            // La fiche de suivi reçoit les exercices de la séance, avec les critères travaillés.
            grille = envoyer("GET", "/api/cursus/" + cursusId + "/grille", moniteur, null, 200);
            JsonNode duJour = null;
            for (JsonNode p : grille.get("programmes")) if (p.get("seanceId").asLong() == seanceId) duJour = p;
            assertThat(duJour).isNotNull();
            assertThat(duJour.get("exercices")).hasSize(2);
            assertThat(duJour.get("exercices").get(0).get("critereIds")).isEmpty();
            List<Long> travailles = new ArrayList<>();
            for (JsonNode id : duJour.get("exercices").get(1).get("critereIds")) travailles.add(id.asLong());
            assertThat(travailles).containsExactlyInAnyOrderElementsOf(criteres.subList(0, 2));

            // Refus : critère sans formation, critère d'une autre formation, exercice sans intitulé.
            JsonNode refus = envoyer("PUT", "/api/seances/" + seanceId + "/programme", moniteur,
                    List.of(exercice("Sans formation", null, criteres.subList(0, 1))), 422);
            assertThat(refus.get("detail").asText()).contains("Choisissez la formation");
            refus = envoyer("PUT", "/api/seances/" + seanceId + "/programme", moniteur,
                    List.of(exercice("Mauvaise formation", referentielN2, criteres.subList(0, 1))), 422);
            assertThat(refus.get("detail").asText()).contains("n'appartient pas");
            envoyer("PUT", "/api/seances/" + seanceId + "/programme", moniteur,
                    List.of(exercice("  ", null, List.of())), 422);
            // Un refus n'a rien changé.
            assertThat(envoyer("GET", "/api/seances/" + seanceId + "/programme", moniteur, null, 200)
                    .get("exercices")).hasSize(2);

            // Un élève ne prépare pas les séances.
            envoyer("GET", "/api/seances/" + seanceId + "/programme", jeton("eleve@club.fr"), null, 403);

            // Vider le programme.
            envoyer("PUT", "/api/seances/" + seanceId + "/programme", moniteur, List.of(), 200);
            grille = envoyer("GET", "/api/cursus/" + cursusId + "/grille", moniteur, null, 200);
            for (JsonNode p : grille.get("programmes")) assertThat(p.get("seanceId").asLong()).isNotEqualTo(seanceId);
        } finally {
            mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin));
            mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin));
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }

    @Test
    @DisplayName("Supprimer une séance emporte son programme")
    void suppressionDeLaSeance() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seanceId = creerSeance(admin, 12);
        envoyer("PUT", "/api/seances/" + seanceId + "/programme", admin,
                List.of(exercice("Apnée statique", null, List.of())), 200);
        envoyer("DELETE", "/api/seances/" + seanceId, admin, null, 204);
        envoyer("GET", "/api/seances/" + seanceId + "/programme", admin, null, 404);
    }
}
