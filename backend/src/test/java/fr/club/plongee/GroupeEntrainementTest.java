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

/** Espaces du bassin et groupes d'entraînement, de bout en bout (données de démonstration). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class GroupeEntrainementTest {

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

    @Test
    @DisplayName("Un encadrant consulte le bassin et les groupes de la saison ouverte")
    void consultationParUnEncadrant() throws Exception {
        String e1 = jeton("e1@club.fr");

        JsonNode espaces = json.readTree(mvc.perform(get("/api/espaces-bassin").header("Authorization", e1))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(espaces).hasSize(7);
        assertThat(espaces.get(6).get("type").asText()).isEqualTo("FOSSE");
        assertThat(espaces.get(6).get("capacite").asInt()).isEqualTo(15);

        JsonNode groupes = json.readTree(mvc.perform(get("/api/groupes-entrainement").header("Authorization", e1))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(groupes).extracting(g -> g.get("nom").asText())
                .startsWith("Débutants", "Prépa N2", "N2+", "Prépa N3"); // saison 2026-2027 (V107)
        assertThat(groupes.get(0).get("espaceAttitre").asText()).isEqualTo("Ligne 6");
        assertThat(groupes.get(0).get("encadrants")).hasSize(2);
    }

    @Test
    @DisplayName("Seul un admin compose les groupes")
    void compositionReserveeALAdmin() throws Exception {
        String e3 = jeton("e3@club.fr");
        mvc.perform(post("/api/groupes-entrainement").header("Authorization", e3)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"saisonId":1,"nom":"Pirate"}"""))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("L'admin range un élève de la saison, puis le retire")
    void rangementDUnEleve() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode groupes = json.readTree(mvc.perform(get("/api/groupes-entrainement").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString());
        long saisonId = groupes.get(0).get("saisonId").asLong();
        long groupeId = groupes.get(3).get("id").asLong();
        JsonNode eleves = json.readTree(mvc.perform(get("/api/groupes-entrainement/saison/" + saisonId + "/eleves")
                        .header("Authorization", admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(eleves).isNotEmpty();
        long eleveId = eleves.get(0).get("eleveId").asLong();

        JsonNode range = json.readTree(mvc.perform(put("/api/groupes-entrainement/saison/" + saisonId + "/eleves/" + eleveId)
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"groupeId\":" + groupeId + "}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(range.get("groupeId").asLong()).isEqualTo(groupeId);

        JsonNode retire = json.readTree(mvc.perform(put("/api/groupes-entrainement/saison/" + saisonId + "/eleves/" + eleveId)
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"groupeId\":null}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(retire.get("groupeId").isNull()).isTrue();
    }

    @Test
    @DisplayName("À l'inscription, l'admin range l'élève dans un groupe ; un groupe inconnu annule toute l'inscription")
    void groupeChoisiALInscription() throws Exception {
        String admin = jeton("presidente@club.fr");
        // Saison 2025-2026 (fermée depuis V107) : l'élève créé ici reste hors de la saison ouverte.
        long saisonId = -1;
        for (JsonNode sa : json.readTree(mvc.perform(get("/api/saisons").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString())) {
            if (sa.get("libelle").asText().equals("2025-2026")) saisonId = sa.get("id").asLong();
        }
        long debutants = json.readTree(mvc.perform(post("/api/groupes-entrainement").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"saisonId":%d,"nom":"Débutants test","niveauPrepare":"N1"}""".formatted(saisonId)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long eleveId = json.readTree(mvc.perform(post("/api/eleves").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"nom":"Groupe","prenom":"Inscription","dateNaissance":"2001-01-01","autorisationLegale":true}"""))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // Groupe inconnu : ni cursus ni groupe.
        mvc.perform(post("/api/cursus").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N1","groupeId":999999}""".formatted(eleveId, saisonId)))
                .andExpect(status().isNotFound());
        assertThat(json.readTree(mvc.perform(get("/api/cursus/eleve/" + eleveId).header("Authorization", admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())).isEmpty();

        mvc.perform(post("/api/cursus").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"saisonId":%d,"niveau":"N1","groupeId":%d}""".formatted(eleveId, saisonId, debutants)))
                .andExpect(status().isCreated());

        JsonNode eleves = json.readTree(mvc.perform(get("/api/groupes-entrainement/saison/" + saisonId + "/eleves")
                        .header("Authorization", admin))
                .andReturn().getResponse().getContentAsString());
        JsonNode inscrit = null;
        for (JsonNode e : eleves) if (e.get("eleveId").asLong() == eleveId) inscrit = e;
        assertThat(inscrit.get("groupeId").asLong()).isEqualTo(debutants);
    }
}
