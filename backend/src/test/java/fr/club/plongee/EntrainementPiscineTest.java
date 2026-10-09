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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * N2 et N3 : les exercices travaillés en piscine et en fosse sont suivis à
 * part de l'évaluation en milieu naturel. Une note prise en piscine, même
 * sur un exercice de maîtrise, n'acquiert rien et ne permet pas de valider
 * une compétence.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class EntrainementPiscineTest {

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

    private long seance(String admin, String milieu, int ordre) throws Exception {
        String seance = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":%d,"milieu":"%s","lieu":"Entraînement test"}"""
                                .formatted(Calendrier.aujourdhui(), ordre, milieu)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(seance).get("id").asLong();
    }

    private void present(String moniteur, long seanceId, long cursusId) throws Exception {
        mvc.perform(put("/api/seances/" + seanceId + "/presences").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"PLONGEE"}]""".formatted(cursusId)))
                .andExpect(status().isOk());
    }

    private void noter(String moniteur, long cursusId, long critereId, long seanceId, long exerciceId) throws Exception {
        mvc.perform(post("/api/cursus/" + cursusId + "/evaluations").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"ACQUIS","exerciceId":%d}"""
                                .formatted(critereId, seanceId, exerciceId)))
                .andExpect(status().isCreated());
    }

    /** Un exercice de maîtrise du bloc qui travaille le critère (base d'exercices du N2, V59). */
    private long exerciceDeMaitrise(JsonNode bloc, long critereId) {
        for (JsonNode e : bloc.get("exercices")) {
            if (!"MAITRISE".equals(e.get("phase").asText())) continue;
            for (JsonNode c : e.get("critereIds")) if (c.asLong() == critereId) return e.get("id").asLong();
        }
        throw new AssertionError("Aucun exercice de maîtrise pour le critère " + critereId);
    }

    /** Nombre de notes reçues sur la séance, tel que l'affiche la feuille de présence. */
    private long notesSurLaFeuille(String moniteur, long seanceId, long cursusId) throws Exception {
        String feuille = mvc.perform(get("/api/seances/" + seanceId + "/presences").header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode l : json.readTree(feuille).get("eleves")) {
            if (l.get("cursusId").asLong() == cursusId) return l.get("evaluations").asLong();
        }
        throw new AssertionError("Cursus absent de la feuille de presence");
    }

    private JsonNode premierBloc(String moniteur, long cursusId) throws Exception {
        String grille = mvc.perform(get("/api/cursus/" + cursusId + "/grille").header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(grille).get("blocs").get(0);
    }

    @Test
    @DisplayName("N2 noté en piscine : suivi d'entraînement à part, sans effet sur l'acquisition")
    void entrainementEnPiscine() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e3@club.fr");

        String saisons = mvc.perform(get("/api/saisons").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        long saisonId = -1;
        for (JsonNode s : json.readTree(saisons)) {
            if (s.get("ouverte").asBoolean()) { saisonId = s.get("id").asLong(); break; }
        }

        long piscine = seance(admin, "ARTIFICIEL", 11);
        long mer = seance(admin, "NATUREL", 12);
        String eleve = mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Entrainement","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long eleveId = json.readTree(eleve).get("id").asLong();
        try {
            String cursus = mvc.perform(post("/api/cursus").header("Authorization", admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                     {"eleveId":%d,"saisonId":%d,"niveau":"N2"}""".formatted(eleveId, saisonId)))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            long cursusId = json.readTree(cursus).get("id").asLong();
            present(moniteur, piscine, cursusId);
            present(moniteur, mer, cursusId);

            JsonNode bloc = premierBloc(moniteur, cursusId);
            long blocId = bloc.get("id").asLong();
            long critere = bloc.get("criteres").get(0).get("id").asLong();

            // Feuille de présence : présent, mais pas encore noté sur cette séance.
            assertThat(notesSurLaFeuille(moniteur, piscine, cursusId)).isZero();

            // Tous les critères du bloc acquis en piscine, sur un exercice de maîtrise :
            // rien d'acquis pour autant, seul le milieu naturel fait acquérir.
            for (JsonNode c : bloc.get("criteres")) {
                long id = c.get("id").asLong();
                noter(moniteur, cursusId, id, piscine, exerciceDeMaitrise(bloc, id));
            }
            assertThat(notesSurLaFeuille(moniteur, piscine, cursusId)).isEqualTo(bloc.get("criteres").size());
            assertThat(notesSurLaFeuille(moniteur, mer, cursusId)).isZero();
            bloc = premierBloc(moniteur, cursusId);
            assertThat(bloc.get("acquis").asInt()).isZero();
            assertThat(bloc.get("acquisEntrainement").asInt()).isEqualTo(bloc.get("total").asInt());
            JsonNode c0 = bloc.get("criteres").get(0);
            assertThat(c0.get("statut").asText()).isEqualTo("NON_ABORDE");
            assertThat(c0.get("entrainement").get("statut").asText()).isEqualTo("ACQUIS");
            mvc.perform(post("/api/cursus/" + cursusId + "/competences/" + blocId + "/validation")
                            .header("Authorization", moniteur))
                    .andExpect(status().isUnprocessableEntity());

            // La notation groupée en piscine ne fait pas reculer l'entraînement non plus.
            mvc.perform(post("/api/seances/" + piscine + "/notation-groupee").header("Authorization", moniteur)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                     {"cursusIds":[%d],"criteres":[{"critereId":%d,"commentaire":"Bien en fosse"}]}"""
                                    .formatted(cursusId, critere)))
                    .andExpect(status().isOk());
            c0 = premierBloc(moniteur, cursusId).get("criteres").get(0);
            assertThat(c0.get("entrainement").get("statut").asText()).isEqualTo("ACQUIS");
            assertThat(c0.get("entrainement").get("commentaire").asText()).isEqualTo("Bien en fosse");
            assertThat(c0.get("statut").asText()).isEqualTo("NON_ABORDE");

            // En milieu naturel, c'est l'évaluation qui compte ; l'entraînement reste affiché à côté.
            noter(moniteur, cursusId, critere, mer, exerciceDeMaitrise(bloc, critere));
            c0 = premierBloc(moniteur, cursusId).get("criteres").get(0);
            assertThat(c0.get("statut").asText()).isEqualTo("ACQUIS");
            assertThat(c0.get("entrainement").get("statut").asText()).isEqualTo("ACQUIS");

            String historique = mvc.perform(get("/api/cursus/" + cursusId + "/criteres/" + critere + "/historique")
                            .header("Authorization", moniteur))
                    .andReturn().getResponse().getContentAsString();
            List<Boolean> entrainements = json.readTree(historique).valueStream()
                    .map(e -> e.get("entrainement").asBoolean()).toList();
            assertThat(entrainements).containsExactly(true, true, false);

            // Vue globale : chaque case dit si elle est de l'entraînement.
            String matrice = mvc.perform(get("/api/cursus/" + cursusId + "/matrice").header("Authorization", moniteur))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            JsonNode m = json.readTree(matrice);
            assertThat(m.get("milieuNaturelExclusif").asBoolean()).isTrue();
            List<Boolean> cases = m.get("lignes").get(0).get("historique").valueStream()
                    .map(c -> c.get("entrainement").asBoolean()).toList();
            assertThat(cases).containsExactly(true, true, false);
        } finally {
            // Les autres tests comptent les inscriptions de demonstration : on ne laisse rien derriere.
            mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin));
            mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin));
            mvc.perform(delete("/api/seances/" + piscine).header("Authorization", admin));
            mvc.perform(delete("/api/seances/" + mer).header("Authorization", admin));
        }
    }
}
