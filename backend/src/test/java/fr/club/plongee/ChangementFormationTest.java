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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Maintien à l'inscription, changement de niveau et passage en maintien
 * d'une inscription. Les élèves créés ici vont dans la saison 2026-2027
 * (fermée, V11) : ceux de la saison ouverte sont comptés par DonneesDemoTest.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ChangementFormationTest {

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

    private long saison2026(String jeton) throws Exception {
        for (JsonNode s : lire("/api/saisons", jeton)) {
            if (s.get("libelle").asText().equals("2026-2027")) return s.get("id").asLong();
        }
        throw new AssertionError("Saison 2026-2027 absente");
    }

    private long nouvelEleve(String jeton, String prenom) throws Exception {
        return json.readTree(mvc.perform(post("/api/eleves").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Formation","prenom":"%s","dateNaissance":"1990-01-01","autorisationLegale":true}"""
                                .formatted(prenom)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    @DisplayName("Un élève en simple maintien est inscrit sans formation, directement dans son groupe")
    void maintienAvecGroupe() throws Exception {
        String admin = jeton();
        long saison = saison2026(admin);
        long eleve = nouvelEleve(admin, "Maintien");
        long groupe = json.readTree(mvc.perform(post("/api/groupes-entrainement").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"saisonId":%d,"nom":"N2+ 2026"}""".formatted(saison)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/adhesions").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"groupeId":%d}""".formatted(eleve, saison, groupe)))
                .andExpect(status().isCreated());

        JsonNode rangement = null;
        for (JsonNode e : lire("/api/groupes-entrainement/saison/" + saison + "/eleves", admin)) {
            if (e.get("eleveId").asLong() == eleve) rangement = e;
        }
        assertThat(rangement.get("adhesionSeule").asBoolean()).isTrue();
        assertThat(rangement.get("groupeId").asLong()).isEqualTo(groupe);
    }

    @Test
    @DisplayName("Une inscription sans note change de niveau, puis passe en maintien")
    void changementDeNiveauPuisMaintien() throws Exception {
        String admin = jeton();
        long saison = saison2026(admin);
        long eleve = nouvelEleve(admin, "Hesitant");
        long cursusId = json.readTree(mvc.perform(post("/api/cursus").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleve, saison)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/cursus/" + cursusId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"statut":"EN_COURS","niveau":"N2"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.niveau").value("N2"));

        mvc.perform(post("/api/cursus/" + cursusId + "/maintien").header("Authorization", admin))
                .andExpect(status().isNoContent());
        assertThat(lire("/api/cursus/eleve/" + eleve, admin)).isEmpty();
        assertThat(lire("/api/adhesions?eleveId=" + eleve, admin)).singleElement()
                .satisfies(a -> assertThat(a.get("saison").asText()).isEqualTo("2026-2027"));
    }

    @Test
    @DisplayName("Une formation déjà notée ne change plus de niveau et ne passe pas en maintien")
    void refusDesQueDesCompetencesSontNotees() throws Exception {
        String admin = jeton();
        // Camille Berthier (démo) : N1 délivré, compétences notées.
        JsonNode camille = null;
        for (JsonNode c : lire("/api/cursus", admin)) if (c.get("eleve").asText().equals("Camille Berthier")) camille = c;

        mvc.perform(put("/api/cursus/" + camille.get("id").asLong()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"statut":"%s","niveau":"N2"}""".formatted(camille.get("statut").asText())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.startsWith("Des compétences ont déjà été notées")));
        mvc.perform(post("/api/cursus/" + camille.get("id").asLong() + "/maintien").header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity());

        // Rien n'a bougé : même niveau, même référent.
        JsonNode apres = null;
        for (JsonNode c : lire("/api/cursus", admin)) if (c.get("id").asLong() == camille.get("id").asLong()) apres = c;
        assertThat(apres).isEqualTo(camille);
    }
}
