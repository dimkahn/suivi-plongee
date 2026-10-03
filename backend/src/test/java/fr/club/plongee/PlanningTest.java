package fr.club.plongee;

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

/** Planning des soirées, de bout en bout sur les séances et groupes de démonstration. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlanningTest {

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

    private JsonNode planning(String jeton) throws Exception {
        return json.readTree(mvc.perform(get("/api/planning").header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    @DisplayName("Une case retouchée l'emporte sur la ligne attitrée ; revenir à ATTITREE l'efface")
    void caseRetoucheePuisRemiseParDefaut() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode p = planning(admin);
        long saison = p.get("saisonId").asLong();
        String date = p.get("soirees").get(0).get("date").asText();
        long debutants = p.get("groupes").get(0).get("id").asLong();
        long fosse = 0;
        for (JsonNode e : p.get("espaces")) if (e.get("type").asText().equals("FOSSE")) fosse = e.get("id").asLong();
        String url = "/api/planning/saison/" + saison + "/soirees/" + date + "/groupes/" + debutants;

        JsonNode soiree = json.readTree(mvc.perform(put(url).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ESPACE\",\"espaceId\":" + fosse + "}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("cases").get(0).get("libelle").asText()).isEqualTo("Fosse");
        assertThat(soiree.get("avertissements").toString()).contains("débutants");

        soiree = json.readTree(mvc.perform(put(url).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ESPACE\",\"espaceId\":" + fosse + ",\"profondeurLimitee\":6}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("cases").get(0).get("libelle").asText()).isEqualTo("Fosse (limitée à 6 m)");

        soiree = json.readTree(mvc.perform(put(url).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"ATTITREE\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("cases").get(0).get("type").asText()).isEqualTo("ATTITREE");
        // Retour à ses deux lignes attitrées (V111).
        assertThat(soiree.get("cases").get(0).get("libelle").asText()).isEqualTo("Ligne 5 + Ligne 6");
        assertThat(soiree.get("cases").get(0).get("espaces")).hasSize(2);
    }

    @Test
    @DisplayName("Un soir donné, un groupe peut être mis sur plusieurs lignes d'eau, mais la fosse se donne seule")
    void plusieursLignesUnSoir() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode p = planning(admin);
        long saison = p.get("saisonId").asLong();
        String date = p.get("soirees").get(2).get("date").asText();
        long groupe = p.get("groupes").get(0).get("id").asLong();
        long ligne1 = 0, ligne2 = 0, fosse = 0;
        for (JsonNode e : p.get("espaces")) {
            switch (e.get("nom").asText()) {
                case "Ligne 1" -> ligne1 = e.get("id").asLong();
                case "Ligne 2" -> ligne2 = e.get("id").asLong();
                default -> { if (e.get("type").asText().equals("FOSSE")) fosse = e.get("id").asLong(); }
            }
        }
        String url = "/api/planning/saison/" + saison + "/soirees/" + date + "/groupes/" + groupe;

        JsonNode soiree = json.readTree(mvc.perform(put(url).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ESPACE\",\"espaceIds\":[" + ligne2 + "," + ligne1 + "]}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode c = soiree.get("cases").get(0);
        assertThat(c.get("type").asText()).isEqualTo("ESPACE");
        assertThat(c.get("libelle").asText()).isEqualTo("Ligne 1 + Ligne 2");
        assertThat(c.get("espaces")).hasSize(2);
        assertThat(planning(admin).get("soirees").get(2).get("cases").get(0).get("libelle").asText())
                .isEqualTo("Ligne 1 + Ligne 2");

        mvc.perform(put(url).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ESPACE\",\"espaceIds\":[" + ligne1 + "," + fosse + "]}"))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(put(url).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ATTITREE\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Le responsable de séance d'une soirée est un encadrant ; les encadrants consultent sans écrire")
    void responsableDeSeanceEtDroits() throws Exception {
        String admin = jeton("presidente@club.fr");
        String e1 = jeton("e1@club.fr");
        JsonNode p = planning(e1);
        long saison = p.get("saisonId").asLong();
        String date = p.get("soirees").get(1).get("date").asText();
        String url = "/api/planning/saison/" + saison + "/soirees/" + date;
        long e3 = 0;
        JsonNode moniteurs = json.readTree(mvc.perform(get("/api/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString());
        for (JsonNode m : moniteurs) if (m.get("nomComplet").asText().equals("Gwendoline Marchand")) e3 = m.get("id").asLong();

        mvc.perform(put(url).header("Authorization", e1).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"responsableId\":" + e3 + "}"))
                .andExpect(status().isForbidden());

        JsonNode soiree = json.readTree(mvc.perform(put(url).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"responsableId\":" + e3 + ",\"note\":\"Baptêmes en ligne 5\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("responsable").asText()).isEqualTo("Gwendoline Marchand");
        assertThat(soiree.get("note").asText()).isEqualTo("Baptêmes en ligne 5");
    }

    @Test
    @DisplayName("Un moniteur consulte le planning et y retrouve les groupes qu'il encadre")
    void mesGroupes() throws Exception {
        JsonNode p = planning(jeton("e1@club.fr"));
        long debutants = 0;
        for (JsonNode g : p.get("groupes")) if (g.get("nom").asText().equals("Débutants")) debutants = g.get("id").asLong();

        assertThat(p.get("mesGroupeIds").size()).isEqualTo(1);
        assertThat(p.get("mesGroupeIds").get(0).asLong()).isEqualTo(debutants);
    }

    @Test
    @DisplayName("Un encadrant annonce sa présence ; l'admin répond à la place d'un autre ; un élève ne peut pas")
    void disponibilites() throws Exception {
        String e1 = jeton("e1@club.fr");
        String admin = jeton("presidente@club.fr");
        JsonNode p = planning(e1);
        long saison = p.get("saisonId").asLong();
        long moi = p.get("utilisateurId").asLong();
        String date = p.get("soirees").get(2).get("date").asText();
        String base = "/api/planning/saison/" + saison + "/soirees/" + date;

        JsonNode soiree = json.readTree(mvc.perform(put(base + "/disponibilite").header("Authorization", e1)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reponse\":\"ABSENT\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("absents").toString()).contains("\"id\":" + moi);

        // Présent, saisi par l'admin à sa place
        soiree = json.readTree(mvc.perform(put(base + "/disponibilites/" + moi).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reponse\":\"PRESENT\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("presents").toString()).contains("\"id\":" + moi);
        assertThat(soiree.get("absents").size()).isZero();

        // Réponse vide : effacée
        soiree = json.readTree(mvc.perform(put(base + "/disponibilite").header("Authorization", e1)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reponse\":null}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(soiree.get("presents").size()).isZero();

        mvc.perform(put(base + "/disponibilites/" + moi).header("Authorization", e1)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reponse\":\"PRESENT\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Une date sans séance est refusée avec un message pour l'utilisateur")
    void dateSansSeanceRefusee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = planning(admin).get("saisonId").asLong();
        mvc.perform(put("/api/planning/saison/" + saison + "/soirees/2025-12-25").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Noël\"}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("Une date qui n'a qu'une séance en milieu naturel n'est pas une soirée du planning")
    void seanceEnMilieuNaturelHorsPlanning() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode p = planning(admin);
        long saison = p.get("saisonId").asLong();

        // Une date de la saison sans aucune séance, prise juste après la première soirée.
        java.time.LocalDate date = java.time.LocalDate.parse(p.get("soirees").get(0).get("date").asText()).plusDays(1);
        JsonNode seances = json.readTree(mvc.perform(get("/api/seances").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString());
        java.util.Set<String> datesOccupees = new java.util.HashSet<>();
        for (JsonNode s : seances) datesOccupees.add(s.get("date").asText());
        while (datesOccupees.contains(date.toString())) date = date.plusDays(1);

        long seanceId = json.readTree(mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":1,"milieu":"NATUREL","lieu":"Carrière test"}""".formatted(date)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        try {
            for (JsonNode s : planning(admin).get("soirees")) {
                assertThat(s.get("date").asText()).isNotEqualTo(date.toString());
            }
            mvc.perform(put("/api/planning/saison/" + saison + "/soirees/" + date).header("Authorization", admin)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Sortie\"}"))
                    .andExpect(status().isUnprocessableEntity());
        } finally {
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }
}
