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

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un problème constaté sur un matériel pendant une séance (demande du club,
 * 2026-11-19) : signalé par un moniteur depuis la fiche (QR code), le
 * matériel ne se prête plus jusqu'à ce que le directeur technique le
 * déclare réparé. Chaque test crée son propre matériel.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SignalementMaterielTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private static final LocalDate AUJOURDHUI = LocalDate.now(ZoneId.of("Europe/Paris"));
    private static final String DATE = AUJOURDHUI.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    /** Un gilet neuf, sans échéance : disponible tant que rien n'est signalé. */
    private long gilet(String reference, String dt) throws Exception {
        return json.readTree(mvc.perform(post("/api/materiel/equipements").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"GILET","reference":"%s","marque":"Scubapro","taille":"M"}""".formatted(reference)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private JsonNode dansInventaire(long id, String jeton) throws Exception {
        for (JsonNode e : lire("/api/materiel/equipements", jeton)) if (e.get("id").asLong() == id) return e;
        throw new AssertionError("Équipement absent de l'inventaire : " + id);
    }

    private void signaler(long id, String description, String jeton) throws Exception {
        mvc.perform(post("/api/materiel/equipements/" + id + "/signalements").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("description", description))))
                .andExpect(status().isCreated());
    }

    private boolean signale(long id, String jeton) throws Exception {
        for (JsonNode s : lire("/api/materiel/signalements", jeton)) if (s.get("equipementId").asLong() == id) return true;
        return false;
    }

    @Test
    @DisplayName("Un matériel signalé par un moniteur ne se prête plus jusqu'à ce que le directeur technique le déclare réparé")
    void signalerPuisReparer() throws Exception {
        String dt = jeton("e3@club.fr");
        long id = gilet("G-71", dt);

        signaler(id, "L'inflateur fuit en surface.", jeton("e1@club.fr"));

        JsonNode e = dansInventaire(id, dt);
        assertThat(e.get("statut").asText()).isEqualTo("A_REPARER");
        // Le motif bloquant remonte jusqu'aux participants d'un séjour qui déclarent un emprunt
        // (lien sans compte, parfois mineurs) : ni le nom du moniteur, ni son texte libre.
        assertThat(e.get("alertes").toString())
                .contains("Problème signalé le " + DATE + " : à vérifier et réparer avant tout prêt.")
                .doesNotContain("Tiago").doesNotContain("inflateur");

        JsonNode signalements = lire("/api/materiel/signalements", dt);
        JsonNode s = null;
        for (JsonNode x : signalements) if (x.get("equipementId").asLong() == id) s = x;
        assertThat(s).isNotNull();
        assertThat(s.get("designation").asText()).isEqualTo("Gilet stabilisateur G-71");
        assertThat(s.get("description").asText()).isEqualTo("L'inflateur fuit en surface.");
        assertThat(s.get("signalePar").asText()).isEqualTo("Tiago Nogueira");

        long eleve = 0;
        for (JsonNode x : lire("/api/materiel/emprunteurs", dt)) {
            if (x.get("nomComplet").asText().equals("Camille Berthier")) eleve = x.get("id").asLong();
        }
        mvc.perform(post("/api/materiel/prets").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"datePret":"%s","equipementIds":[%d]}""".formatted(eleve, AUJOURDHUI, id)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("Gilet stabilisateur G-71 : Problème signalé le " + DATE
                                + " : à vérifier et réparer avant tout prêt."),
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Tiago")),
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("inflateur")))));

        mvc.perform(post("/api/materiel/equipements/" + id + "/interventions").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"REPARATION","dateIntervention":"%s","description":"Inflateur changé, essai en bassin."}"""
                                .formatted(AUJOURDHUI)))
                .andExpect(status().isCreated());

        assertThat(dansInventaire(id, dt).get("statut").asText()).isEqualTo("DISPONIBLE");
        assertThat(signale(id, dt)).isFalse();
    }

    @Test
    @DisplayName("Un nouveau problème signalé après une réparation bloque de nouveau le matériel")
    void nouveauSignalement() throws Exception {
        String dt = jeton("e3@club.fr");
        long id = gilet("G-72", dt);
        signaler(id, "Sangle déchirée.", dt);
        mvc.perform(post("/api/materiel/equipements/" + id + "/interventions").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"REPARATION","dateIntervention":"%s","description":"Sangle remplacée."}"""
                                .formatted(AUJOURDHUI)))
                .andExpect(status().isCreated());
        signaler(id, "Purge bloquée.", jeton("e2@club.fr"));

        assertThat(dansInventaire(id, dt).get("statut").asText()).isEqualTo("A_REPARER");
        assertThat(signale(id, dt)).isTrue();
    }

    @Test
    @DisplayName("Un élève ne signale pas de problème de matériel : il le dit à son moniteur")
    void eleveRefuse() throws Exception {
        long id = gilet("G-73", jeton("e3@club.fr"));
        mvc.perform(post("/api/materiel/equipements/" + id + "/signalements").header("Authorization", jeton("eleve@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                 {"description":"Fuite"}"""))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un élève n'ouvre pas le résumé d'un matériel, et un TIV ne le déclare pas réparé")
    void refus() throws Exception {
        long id = gilet("G-76", jeton("e3@club.fr"));
        mvc.perform(get("/api/materiel/equipements/" + id + "/resume").header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/materiel/equipements/" + id + "/interventions").header("Authorization", jeton("e2@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"REPARATION","dateIntervention":"%s","description":"Réparé."}""".formatted(AUJOURDHUI)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un signalement dit quel est le problème")
    void descriptionObligatoire() throws Exception {
        long id = gilet("G-74", jeton("e3@club.fr"));
        mvc.perform(post("/api/materiel/equipements/" + id + "/signalements").header("Authorization", jeton("e1@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                 {"description":"  "}"""))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Décrivez le problème constaté sur le matériel."));
    }

    @Test
    @DisplayName("Un moniteur qui scanne un matériel voit ce qu'il est et ses problèmes signalés, pas sa fiche de gestion")
    void resumePourUnMoniteur() throws Exception {
        String dt = jeton("e3@club.fr");
        long id = gilet("G-75", dt);
        String moniteur = jeton("e1@club.fr");
        signaler(id, "Boucle cassée.", moniteur);

        JsonNode r = lire("/api/materiel/equipements/" + id + "/resume", moniteur);
        assertThat(r.get("designation").asText()).isEqualTo("Gilet stabilisateur G-75");
        assertThat(r.get("signalements")).hasSize(1);
        assertThat(r.get("signalements").get(0).get("description").asText()).isEqualTo("Boucle cassée.");

        mvc.perform(get("/api/materiel/equipements/" + id).header("Authorization", moniteur))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/materiel/signalements").header("Authorization", moniteur))
                .andExpect(status().isForbidden());
    }
}
