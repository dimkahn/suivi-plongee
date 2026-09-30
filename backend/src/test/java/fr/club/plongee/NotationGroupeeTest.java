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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Notation groupée des présents d'une séance : un critère acquis reste acquis
 * (seul le commentaire s'ajoute), un critère en cours le reste, un critère
 * non abordé passe en cours. Tout ou rien si un élève est refusé.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class NotationGroupeeTest {

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

    private long creerEleve(String admin, String nom) throws Exception {
        String eleve = mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"%s","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}"""
                                .formatted(nom)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(eleve).get("id").asLong();
    }

    private long inscrire(String admin, long eleveId, long saisonId) throws Exception {
        String cursus = mvc.perform(post("/api/cursus").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saisonId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(cursus).get("id").asLong();
    }

    private JsonNode critere(String moniteur, long cursusId, long critereId) throws Exception {
        String grille = mvc.perform(get("/api/cursus/" + cursusId + "/grille").header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode b : json.readTree(grille).get("blocs")) {
            for (JsonNode c : b.get("criteres")) {
                if (c.get("id").asLong() == critereId) return c;
            }
        }
        throw new AssertionError("Critere absent de la grille");
    }

    private int nombreDeSaisies(String moniteur, long cursusId, long critereId) throws Exception {
        String historique = mvc.perform(get("/api/cursus/" + cursusId + "/criteres/" + critereId + "/historique")
                        .header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(historique).size();
    }

    /** Même commentaire pour chaque critère coché (le serveur accepte un commentaire différent par critère). */
    private String noterGroupe(String moniteur, long seanceId, List<Long> cursusIds, List<Long> critereIds,
                               String commentaire, int statutAttendu) throws Exception {
        List<Map<String, Object>> criteres = critereIds.stream()
                .map(id -> Map.<String, Object>of("critereId", id, "commentaire", commentaire == null ? "" : commentaire))
                .toList();
        return mvc.perform(post("/api/seances/" + seanceId + "/notation-groupee").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("cursusIds", cursusIds, "criteres", criteres))))
                .andExpect(status().is(statutAttendu))
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    @DisplayName("Noter plusieurs critères en une fois : acquis reste acquis, non abordé passe en cours")
    void notationGroupee() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");

        String seance = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":9,"milieu":"ARTIFICIEL","lieu":"Piscine test"}"""
                                .formatted(Calendrier.aujourdhui())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long seanceId = json.readTree(seance).get("id").asLong();

        String saisons = mvc.perform(get("/api/saisons").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        long saisonId = -1;
        for (JsonNode s : json.readTree(saisons)) {
            if (s.get("ouverte").asBoolean()) { saisonId = s.get("id").asLong(); break; }
        }

        long presentId = creerEleve(admin, "Groupee");
        long absentId = creerEleve(admin, "Absente");
        try {
            long present = inscrire(admin, presentId, saisonId);
            long absent = inscrire(admin, absentId, saisonId);
            mvc.perform(put("/api/seances/" + seanceId + "/presences").header("Authorization", moniteur)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                     [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(present)))
                    .andExpect(status().isOk());

            verifier(moniteur, seanceId, present, absent);
        } finally {
            // Les autres tests comptent les inscriptions de demonstration : on ne laisse rien derriere.
            for (long id : List.of(presentId, absentId)) {
                mvc.perform(post("/api/eleves/" + id + "/archivage").header("Authorization", admin));
                mvc.perform(delete("/api/eleves/" + id).header("Authorization", admin));
            }
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }

    private void verifier(String moniteur, long seanceId, long present, long absent) throws Exception {
        String grille = mvc.perform(get("/api/cursus/" + present + "/grille").header("Authorization", moniteur))
                .andReturn().getResponse().getContentAsString();
        List<Long> ids = new ArrayList<>();
        for (JsonNode c : json.readTree(grille).get("blocs").get(0).get("criteres")) ids.add(c.get("id").asLong());
        long dejaAcquis = ids.get(0);
        long nonAborde = ids.get(1);

        mvc.perform(post("/api/cursus/" + present + "/evaluations").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"critereId":%d,"seanceId":%d,"statut":"ACQUIS"}""".formatted(dejaAcquis, seanceId)))
                .andExpect(status().isCreated());

        JsonNode bilan = json.readTree(noterGroupe(moniteur, seanceId, List.of(present),
                List.of(dejaAcquis, nonAborde), "Bon palmage", 200));
        assertThat(bilan.get("passesEnCours").asInt()).isEqualTo(1);
        assertThat(bilan.get("commentairesAjoutes").asInt()).isEqualTo(1);

        JsonNode acquis = critere(moniteur, present, dejaAcquis);
        assertThat(acquis.get("statut").asText()).isEqualTo("ACQUIS");
        assertThat(acquis.get("commentaire").asText()).isEqualTo("Bon palmage");
        JsonNode enCours = critere(moniteur, present, nonAborde);
        assertThat(enCours.get("statut").asText()).isEqualTo("EN_COURS");
        assertThat(enCours.get("commentaire").asText()).isEqualTo("Bon palmage");

        // En cours, avec un nouveau commentaire : reste en cours.
        noterGroupe(moniteur, seanceId, List.of(present), List.of(nonAborde), "Encore un peu", 200);
        enCours = critere(moniteur, present, nonAborde);
        assertThat(enCours.get("statut").asText()).isEqualTo("EN_COURS");
        assertThat(enCours.get("commentaire").asText()).isEqualTo("Encore un peu");

        // Un commentaire propre à chaque critère coché.
        mvc.perform(post("/api/seances/" + seanceId + "/notation-groupee").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"cursusIds":[%d],"criteres":[{"critereId":%d,"commentaire":"Vidage fluide"},
                                  {"critereId":%d,"commentaire":"Palmage à reprendre"}]}"""
                                .formatted(present, dejaAcquis, nonAborde)))
                .andExpect(status().isOk());
        assertThat(critere(moniteur, present, dejaAcquis).get("commentaire").asText()).isEqualTo("Vidage fluide");
        assertThat(critere(moniteur, present, nonAborde).get("commentaire").asText())
                .isEqualTo("Palmage à reprendre");
        assertThat(nombreDeSaisies(moniteur, present, dejaAcquis)).isEqualTo(3);

        // Un critère coché sans commentaire : refusé, aucune ligne ajoutée.
        String sansCommentaire = noterGroupe(moniteur, seanceId, List.of(present),
                List.of(dejaAcquis, nonAborde), null, 422);
        assertThat(sansCommentaire).contains("commentaire pour chaque critère");
        assertThat(nombreDeSaisies(moniteur, present, dejaAcquis)).isEqualTo(3);

        // Un élève non présent : refus nommé, et rien n'est enregistré pour les autres.
        String refus = noterGroupe(moniteur, seanceId, List.of(present, absent),
                List.of(dejaAcquis), "Ne doit pas passer", 422);
        assertThat(refus).contains("Absente").contains("pas noté présent");
        assertThat(nombreDeSaisies(moniteur, present, dejaAcquis)).isEqualTo(3);

        // Un élève ne note pas.
        noterGroupe(jeton("eleve@club.fr"), seanceId, List.of(present), List.of(dejaAcquis), "x", 403);
    }
}
