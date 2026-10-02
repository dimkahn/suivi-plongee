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

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Une séance à venir se prépare mais ne se remplit pas : pas d'évaluation ;
 * les présences seules s'annoncent, au plus une semaine à l'avance. Les
 * séances sont créées pour l'occasion.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SeanceAVenirTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private long cursusN1EnCours(String lecteur) throws Exception {
        String reponse = mvc.perform(get("/api/cursus").header("Authorization", lecteur))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode c : json.readTree(reponse)) {
            if ("N1".equals(c.get("niveau").asText()) && "EN_COURS".equals(c.get("statut").asText())) {
                return c.get("id").asLong();
            }
        }
        throw new IllegalStateException("Aucun cursus N1 EN_COURS dans le jeu de demonstration");
    }

    @Test
    @DisplayName("On ne note pas une compétence ni les présences sur une séance à venir")
    void seanceAVenirRefusee() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e3@club.fr");
        LocalDate demain = Calendrier.aujourdhui().plusDays(1);

        // Créer une séance à venir reste permis : c'est de la préparation.
        String seance = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":9,"milieu":"NATUREL","lieu":"Test futur"}"""
                                .formatted(demain)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long seanceId = json.readTree(seance).get("id").asLong();

        long cursus = cursusN1EnCours(moniteur);
        String grille = mvc.perform(get("/api/cursus/" + cursus + "/grille").header("Authorization", moniteur))
                .andReturn().getResponse().getContentAsString();
        long critere = json.readTree(grille).get("blocs").get(0).get("criteres").get(0).get("id").asLong();

        mvc.perform(post("/api/cursus/" + cursus + "/evaluations").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"ACQUIS"}""".formatted(critere, seanceId)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("n'a pas encore eu lieu")));

        // La présence, elle, se renseigne à l'avance : l'élève a prévenu qu'il viendrait.
        mvc.perform(put("/api/seances/" + seanceId + "/presences").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursus)))
                .andExpect(status().isOk());
        // Elle ne compte pas encore dans les séances bloc, et la note reste refusée.
        mvc.perform(post("/api/cursus/" + cursus + "/evaluations").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"ACQUIS"}""".formatted(critere, seanceId)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("n'a pas encore eu lieu")));
        mvc.perform(get("/api/cursus/" + cursus + "/grille").header("Authorization", moniteur))
                .andExpect(jsonPath("$.seancesBloc").value(json.readTree(grille).get("seancesBloc").asInt()));
        mvc.perform(delete("/api/seances/" + seanceId + "/presences/" + cursus).header("Authorization", moniteur))
                .andExpect(status().isNoContent());

        // Évaluation transverse (sans séance) datée dans le futur : refusée elle aussi.
        long transverse = -1;
        for (JsonNode bloc : json.readTree(grille).get("blocs")) {
            if (bloc.path("evaluationTransverse").asBoolean()) {
                transverse = bloc.get("criteres").get(0).get("id").asLong();
                break;
            }
        }
        if (transverse > 0) {
            mvc.perform(post("/api/cursus/" + cursus + "/evaluations").header("Authorization", moniteur)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                     {"critereId":%d,"statut":"ACQUIS","dateEvaluation":"%s"}"""
                                    .formatted(transverse, demain)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("futur")));
        }
    }

    @Test
    @DisplayName("Les présences se renseignent au plus une semaine à l'avance")
    void presencesAuPlusUneSemaineALAvance() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e3@club.fr");
        long cursus = cursusN1EnCours(moniteur);

        long dansUneSemaine = creerSeance(admin, Calendrier.aujourdhui().plusDays(7), 7);
        long dansHuitJours = creerSeance(admin, Calendrier.aujourdhui().plusDays(8), 8);

        mvc.perform(put("/api/seances/" + dansUneSemaine + "/presences").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"NAGE"}]""".formatted(cursus)))
                .andExpect(status().isOk());
        mvc.perform(put("/api/seances/" + dansHuitJours + "/presences").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"NAGE"}]""".formatted(cursus)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("plus d'une semaine")));

        // Rien ne reste derrière : les autres tests comptent les séances et présences de démonstration.
        mvc.perform(delete("/api/seances/" + dansUneSemaine + "/presences/" + cursus).header("Authorization", moniteur))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/seances/" + dansUneSemaine).header("Authorization", admin));
        mvc.perform(delete("/api/seances/" + dansHuitJours).header("Authorization", admin));
    }

    private long creerSeance(String admin, LocalDate date, int ordre) throws Exception {
        String seance = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":%d,"milieu":"ARTIFICIEL","lieu":"Test anticipation"}"""
                                .formatted(date, ordre)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(seance).get("id").asLong();
    }
}
