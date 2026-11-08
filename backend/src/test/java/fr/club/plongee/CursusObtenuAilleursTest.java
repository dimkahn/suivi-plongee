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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un élève en formation obtient son brevet dans une autre structure : sa
 * formation se clôt « brevet obtenu ailleurs ». Il prend ce niveau et ne
 * figure plus parmi ceux qui le préparent. Chaque test crée son élève.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class CursusObtenuAilleursTest {

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

    private long saisonOuverte(String admin) throws Exception {
        for (JsonNode s : json.readTree(mvc.perform(get("/api/saisons").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString())) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new IllegalStateException("Aucune saison ouverte dans la démo");
    }

    /** Un élève neuf inscrit en N1 dans la saison ouverte ; renvoie {eleveId, cursusId}. */
    private long[] eleveEnN1(String admin, String nom) throws Exception {
        long eleveId = json.readTree(mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"%s","prenom":"Venu","autorisationLegale":true}""".formatted(nom)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        long cursusId = json.readTree(mvc.perform(post("/api/cursus").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saisonOuverte(admin))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        return new long[] {eleveId, cursusId};
    }

    private void obtenuAilleurs(String admin, long cursusId) throws Exception {
        mvc.perform(put("/api/cursus/" + cursusId).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"statut":"OBTENU_AILLEURS"}"""))
                .andExpect(status().isOk());
    }

    private long seanceDuJour(String admin) throws Exception {
        return json.readTree(mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateSeance":"%s","ordre":8,"milieu":"ARTIFICIEL","lieu":"Piscine ailleurs"}"""
                                .formatted(Calendrier.aujourdhui())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private int elevesN1AuProgramme(String admin, long seanceId) throws Exception {
        JsonNode programme = json.readTree(mvc.perform(get("/api/seances/" + seanceId + "/programme")
                        .header("Authorization", admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        int total = 0;
        for (JsonNode f : programme.get("formations")) if (f.get("niveau").asText().equals("N1")) total += f.get("eleves").asInt();
        return total;
    }

    private static List<Long> cursusIds(JsonNode lignes) {
        List<Long> ids = new ArrayList<>();
        for (JsonNode l : lignes) ids.add(l.get("cursusId").asLong());
        return ids;
    }

    @Test
    @DisplayName("Brevet obtenu ailleurs : le dernier niveau de l'élève devient le niveau de la formation")
    void obtenuAilleurs_metAJourLeDernierNiveau() throws Exception {
        String admin = jeton("presidente@club.fr");
        long[] e = eleveEnN1(admin, "Ailleurs");

        obtenuAilleurs(admin, e[1]);

        JsonNode eleve = null;
        for (JsonNode x : json.readTree(mvc.perform(get("/api/eleves").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString())) {
            if (x.get("id").asLong() == e[0]) eleve = x;
        }
        assertThat(eleve).isNotNull();
        assertThat(eleve.get("dernierNiveau").asText()).isEqualTo("N1");
    }

    @Test
    @DisplayName("Brevet obtenu ailleurs : l'élève n'est plus dans Infos élèves parmi ceux qui préparent le niveau")
    void obtenuAilleurs_sortDuRoster() throws Exception {
        String admin = jeton("presidente@club.fr");
        long[] e = eleveEnN1(admin, "Ailleursroster");

        obtenuAilleurs(admin, e[1]);

        JsonNode roster = json.readTree(mvc.perform(get("/api/roster").header("Authorization", admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(cursusIds(roster.get("eleves"))).doesNotContain(e[1]);
    }

    @Test
    @DisplayName("Brevet obtenu ailleurs : l'élève n'est plus proposé sur la feuille de présence")
    void obtenuAilleurs_sortDeLaFeuilleDePresence() throws Exception {
        String admin = jeton("presidente@club.fr");
        long[] e = eleveEnN1(admin, "Ailleurspresence");
        long seanceId = seanceDuJour(admin);

        obtenuAilleurs(admin, e[1]);

        JsonNode feuille = json.readTree(mvc.perform(get("/api/seances/" + seanceId + "/presences")
                        .header("Authorization", admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(cursusIds(feuille.get("eleves"))).doesNotContain(e[1]);
    }

    @Test
    @DisplayName("Brevet obtenu ailleurs mais noté présent à une séance du jour : il reste dans Infos élèves (téléphone, personne à prévenir)")
    void obtenuAilleurs_presentCeJour_resteDansLeRoster() throws Exception {
        String admin = jeton("presidente@club.fr");
        long[] e = eleveEnN1(admin, "Ailleurssoiree");
        long seanceId = seanceDuJour(admin);
        mvc.perform(put("/api/seances/" + seanceId + "/presences").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(e[1])))
                .andExpect(status().isOk());

        obtenuAilleurs(admin, e[1]);

        JsonNode roster = json.readTree(mvc.perform(get("/api/roster").header("Authorization", admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(cursusIds(roster.get("eleves"))).contains(e[1]);
    }

    @Test
    @DisplayName("Brevet obtenu ailleurs : l'élève ne compte plus parmi ceux de la formation au programme d'une séance")
    void obtenuAilleurs_neCompteplusAuProgramme() throws Exception {
        String admin = jeton("presidente@club.fr");
        long[] e = eleveEnN1(admin, "Ailleursprogramme");
        long seanceId = seanceDuJour(admin);
        int avant = elevesN1AuProgramme(admin, seanceId);

        obtenuAilleurs(admin, e[1]);

        assertThat(elevesN1AuProgramme(admin, seanceId)).isEqualTo(avant - 1);
    }

    @Test
    @DisplayName("Un moniteur ne peut pas clore une formation comme brevet obtenu ailleurs (403)")
    void moniteur_refuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long[] e = eleveEnN1(admin, "Ailleursrefus");

        mvc.perform(put("/api/cursus/" + e[1]).header("Authorization", jeton("e1@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"statut":"OBTENU_AILLEURS"}"""))
                .andExpect(status().isForbidden());
    }
}
