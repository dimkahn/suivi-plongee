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

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un élève breveté en cours de saison, puis inscrit au niveau suivant, a deux
 * inscriptions dans la saison : il n'apparaît qu'une fois dans les listes de
 * personnes, au niveau qu'il prépare (choix du club, 2026-11-08). Chaque test
 * crée son élève dans la saison 2025-2026 (fermée), pour ne pas mêler ces
 * doublons voulus aux données de démonstration de la saison ouverte.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlusieursInscriptionsTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton() throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"presidente@club.fr","motDePasse":"plongee2026"}"""))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    /** Saison 2025-2026, fermée depuis V107 : les doublons voulus ici ne se mêlent pas à la démo ouverte. */
    private long saison(String jeton) throws Exception {
        for (JsonNode s : lire("/api/saisons", jeton)) if (s.get("libelle").asText().equals("2025-2026")) return s.get("id").asLong();
        throw new AssertionError("Saison 2025-2026 absente");
    }

    private long nouvelEleve(String jeton, String nom) throws Exception {
        return json.readTree(mvc.perform(post("/api/eleves").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"%s","prenom":"Promu","dateNaissance":"1990-01-01","autorisationLegale":true}"""
                                .formatted(nom)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private long inscrire(String jeton, long eleve, String niveau, Long groupe) throws Exception {
        long saison = saison(jeton);
        String corps = groupe == null
                ? """
                  {"eleveId":%d,"saisonId":%d,"niveau":"%s"}""".formatted(eleve, saison, niveau)
                : """
                  {"eleveId":%d,"saisonId":%d,"niveau":"%s","groupeId":%d}""".formatted(eleve, saison, niveau, groupe);
        return json.readTree(mvc.perform(post("/api/cursus").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private void statut(String jeton, long cursus, String statut) throws Exception {
        mvc.perform(put("/api/cursus/" + cursus).header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"statut":"%s"}""".formatted(statut)))
                .andExpect(status().isOk());
    }

    /** N1 délivré puis N2 en cours ; renvoie {eleveId, cursusN1, cursusN2}. */
    private long[] promuEnN2(String jeton, String nom, Long groupe) throws Exception {
        long eleve = nouvelEleve(jeton, nom);
        long n1 = inscrire(jeton, eleve, "N1", groupe);
        statut(jeton, n1, "DELIVRE");
        long n2 = inscrire(jeton, eleve, "N2", groupe);
        return new long[] {eleve, n1, n2};
    }

    /** Séance de juin 2026, dans la saison 2025-2026. */
    private long seanceDuJour(String jeton, int ordre) throws Exception {
        return json.readTree(mvc.perform(post("/api/seances").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"2026-06-20","ordre":%d,"milieu":"ARTIFICIEL","lieu":"Piscine promus"}"""
                                .formatted(ordre)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private void present(String jeton, long seance, long cursus) throws Exception {
        mvc.perform(put("/api/seances/" + seance + "/presences").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursus)))
                .andExpect(status().isOk());
    }

    private static List<Long> cursusDeLEleve(JsonNode lignes, long eleve) {
        List<Long> ids = new ArrayList<>();
        for (JsonNode l : lignes) if (l.get("eleveId").asLong() == eleve) ids.add(l.get("cursusId").asLong());
        return ids;
    }

    @Test
    @DisplayName("Trombinoscope : l'élève promu n'apparaît qu'une fois, au niveau qu'il prépare")
    void trombinoscope() throws Exception {
        String admin = jeton();
        long[] e = promuEnN2(admin, "Trombi", null);
        assertThat(cursusDeLEleve(lire("/api/trombinoscope?saisonId=" + saison(admin), admin), e[0])).containsExactly(e[2]);
    }

    @Test
    @DisplayName("Trombinoscope : un élève dont la seule formation est abandonnée n'y figure pas")
    void trombinoscopeSansAbandon() throws Exception {
        String admin = jeton();
        long eleve = nouvelEleve(admin, "Parti");
        statut(admin, inscrire(admin, eleve, "N1", null), "ABANDON");
        assertThat(cursusDeLEleve(lire("/api/trombinoscope?saisonId=" + saison(admin), admin), eleve)).isEmpty();
    }

    @Test
    @DisplayName("Feuille de présence : l'élève promu n'a qu'une ligne, au niveau qu'il prépare")
    void feuilleDePresence() throws Exception {
        String admin = jeton();
        long[] e = promuEnN2(admin, "Feuille", null);
        long seance = seanceDuJour(admin, 11);
        JsonNode feuille = lire("/api/seances/" + seance + "/presences", admin);
        assertThat(cursusDeLEleve(feuille.get("eleves"), e[0])).containsExactly(e[2]);
    }

    @Test
    @DisplayName("Feuille de présence : déjà noté présent sur son ancien niveau, l'élève garde cette seule ligne")
    void feuilleDePresenceDejaSaisie() throws Exception {
        String admin = jeton();
        long eleve = nouvelEleve(admin, "Saisi");
        long n1 = inscrire(admin, eleve, "N1", null);
        long seance = seanceDuJour(admin, 12);
        present(admin, seance, n1);
        statut(admin, n1, "DELIVRE");
        inscrire(admin, eleve, "N2", null);

        JsonNode feuille = lire("/api/seances/" + seance + "/presences", admin);
        assertThat(cursusDeLEleve(feuille.get("eleves"), eleve)).containsExactly(n1);
    }

    @Test
    @DisplayName("Infos élèves : l'élève promu n'a qu'une ligne, avec les présences de ses deux inscriptions")
    void infosEleves() throws Exception {
        String admin = jeton();
        long eleve = nouvelEleve(admin, "Infos");
        long n1 = inscrire(admin, eleve, "N1", null);
        long seance = seanceDuJour(admin, 13);
        present(admin, seance, n1);
        statut(admin, n1, "DELIVRE");
        long n2 = inscrire(admin, eleve, "N2", null);

        JsonNode lignes = lire("/api/roster?saisonId=" + saison(admin), admin).get("eleves");
        assertThat(cursusDeLEleve(lignes, eleve)).containsExactly(n2);
        for (JsonNode l : lignes) {
            if (l.get("eleveId").asLong() != eleve) continue;
            assertThat(l.get("presencesParSeance").has(String.valueOf(seance))).isTrue();
            assertThat(l.get("seancesBloc").asLong()).isEqualTo(1);
        }
    }

    @Test
    @DisplayName("Synthèse des compétences du groupe : l'élève promu n'apparaît que dans le tableau du niveau qu'il prépare")
    void syntheseDuGroupe() throws Exception {
        String admin = jeton();
        long groupe = json.readTree(mvc.perform(post("/api/groupes-entrainement").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"saisonId":%d,"nom":"Promus test"}""".formatted(saison(admin))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        long[] e = promuEnN2(admin, "Synthese", groupe);

        List<String> niveaux = new ArrayList<>();
        for (JsonNode f : lire("/api/groupes-entrainement/" + groupe + "/synthese-competences", admin).get("formations")) {
            if (!cursusDeLEleve(f.get("eleves"), e[0]).isEmpty()) niveaux.add(f.get("niveau").asText());
        }
        assertThat(niveaux).containsExactly("N2");
    }

    @Test
    @DisplayName("Programme d'exercices : l'élève promu ne compte plus parmi les élèves de son ancien niveau")
    void programme() throws Exception {
        String admin = jeton();
        long seance = seanceDuJour(admin, 14);
        int avant = elevesAuProgramme(admin, seance, "N1");
        promuEnN2(admin, "Programme", null);
        assertThat(elevesAuProgramme(admin, seance, "N1")).isEqualTo(avant);
    }

    private int elevesAuProgramme(String jeton, long seance, String niveau) throws Exception {
        int total = 0;
        for (JsonNode f : lire("/api/seances/" + seance + "/programme", jeton).get("formations")) {
            if (f.get("niveau").asText().equals(niveau)) total += f.get("eleves").asInt();
        }
        return total;
    }
}
