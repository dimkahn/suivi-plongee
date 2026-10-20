package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La réservation d'un voyage du séjour (V96) : terminal, ouverture de
 * l'enregistrement, numéro de dossier et lien d'enregistrement. Le dossier
 * et le lien permettent de modifier ou d'annuler le billet : seuls le
 * voyageur et les organisateurs du séjour les lisent.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ReservationVoyageTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private static final LocalDate AUJOURDHUI = LocalDate.now(ZoneId.of("Europe/Paris"));

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private JsonNode participant(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p;
        throw new AssertionError(prenom + " absent du séjour");
    }

    private long eleveCamille(String jeton) throws Exception {
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", jeton, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) return p.get("eleveId").asLong();
        }
        throw new AssertionError("Camille introuvable");
    }

    /** Un séjour du DT (e3) avec Camille (compte élève) et Léo, chacun avec son dossier de vol. */
    private String sejourAvecDeuxVoyageurs(String dt) throws Exception {
        LocalDate debut = AUJOURDHUI.plusDays(220);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour Martinique","lieu":"Fort-de-France","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(10)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true,
                 "arrivee":{"date":"%s","heure":"15:05","transport":"AVION","numero":"TX510","lieu":"Fort-de-France",
                            "heureDepart":"12:20","lieuDepart":"Paris-Orly","terminal":"4","dossier":"ABC123",
                            "lienEnregistrement":"https://compagnie.example/enregistrement?dossier=ABC123",
                            "ouvertureEnregistrement":"%sT12:20"}}"""
                .formatted(eleveCamille(dt), debut, debut.minusDays(2)), 200);
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Durand","prenom":"Léo","plongeur":false,
                 "arrivee":{"date":"%s","heure":"15:05","transport":"AVION","numero":"TX510","terminal":"4",
                            "dossier":"XYZ789","lienEnregistrement":"https://compagnie.example/XYZ789"}}"""
                .formatted(debut), 200);
        return base;
    }

    @Test
    @DisplayName("Le dossier et le lien d'enregistrement ne sont lus que par le voyageur et les organisateurs")
    void dossierLuParLeVoyageurEtLesOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejourAvecDeuxVoyageurs(dt);

        JsonNode leoVuParLeDt = participant(envoyer("GET", base, dt, null, 200), "Léo").get("arrivee");
        assertThat(leoVuParLeDt.get("dossier").asText()).isEqualTo("XYZ789");
        assertThat(leoVuParLeDt.get("lienEnregistrement").asText()).isEqualTo("https://compagnie.example/XYZ789");

        // Un moniteur qui n'organise pas lit le vol, le terminal, mais pas le dossier des autres.
        JsonNode leoVuParE1 = participant(envoyer("GET", base, jeton("e1@club.fr"), null, 200), "Léo").get("arrivee");
        assertThat(leoVuParE1.get("terminal").asText()).isEqualTo("4");
        assertThat(leoVuParE1.get("dossier").isNull()).isTrue();
        assertThat(leoVuParE1.get("lienEnregistrement").isNull()).isTrue();

        // Camille lit son dossier et l'ouverture de son enregistrement, pas le dossier de Léo.
        JsonNode carnet = envoyer("GET", base, jeton("eleve@club.fr"), null, 200);
        JsonNode sienne = participant(carnet, "Camille").get("arrivee");
        assertThat(sienne.get("dossier").asText()).isEqualTo("ABC123");
        assertThat(sienne.get("lienEnregistrement").asText()).contains("ABC123");
        assertThat(sienne.get("ouvertureEnregistrement").asText()).startsWith(AUJOURDHUI.plusDays(218) + "T12:20");
        JsonNode leoVuParCamille = participant(carnet, "Léo").get("arrivee");
        assertThat(leoVuParCamille.get("terminal").asText()).isEqualTo("4");
        assertThat(leoVuParCamille.get("dossier").isNull()).isTrue();
        assertThat(leoVuParCamille.get("lienEnregistrement").isNull()).isTrue();
    }

    @Test
    @DisplayName("Un organisateur désigné par le créateur lit le dossier de chacun")
    void organisateurDesigneLitLesDossiers() throws Exception {
        String dt = jeton("e3@club.fr"), e2 = jeton("e2@club.fr");
        String base = sejourAvecDeuxVoyageurs(dt);
        assertThat(participant(envoyer("GET", base, e2, null, 200), "Léo").get("arrivee").get("dossier").isNull()).isTrue();

        long flora = 0;
        for (JsonNode m : envoyer("GET", "/api/moniteurs", dt, null, 200)) {
            if (m.get("nomComplet").asText().contains("Vasseur")) flora = m.get("id").asLong();
        }
        envoyer("PUT", base + "/organisateurs", dt, "{\"utilisateurIds\":[%d]}".formatted(flora), 200);

        JsonNode leo = participant(envoyer("GET", base, e2, null, 200), "Léo").get("arrivee");
        assertThat(leo.get("dossier").asText()).isEqualTo("XYZ789");
    }

    @Test
    @DisplayName("Un lien d'enregistrement qui n'est pas une adresse web est refusé")
    void lienQuiNEstPasUneAdresseWeb() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejourAvecDeuxVoyageurs(dt);
        JsonNode refus = envoyer("POST", base + "/participants", dt, """
                {"nom":"Roux","prenom":"Inès","plongeur":true,
                 "depart":{"date":"%s","transport":"AVION","lienEnregistrement":"javascript:alert(1)"}}"""
                .formatted(AUJOURDHUI.plusDays(230)), 422);
        assertThat(refus.get("detail").asText()).contains("https://");
    }

    @Test
    @DisplayName("Un vol commun pose le terminal sans effacer le dossier de chacun, sauf dossier commun donné")
    void volCommunGardeLeDossierDeChacun() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejourAvecDeuxVoyageurs(dt);
        JsonNode s = envoyer("GET", base, dt, null, 200);
        long camille = participant(s, "Camille").get("id").asLong(), leo = participant(s, "Léo").get("id").asLong();
        LocalDate debut = AUJOURDHUI.plusDays(220);

        s = envoyer("PUT", base + "/trajets", dt, """
                {"sens":"ARRIVEE","trajet":{"date":"%s","heure":"15:05","transport":"AVION","numero":"TX510",
                 "terminal":"Sud"},"participantIds":[%d,%d]}""".formatted(debut, camille, leo), 200);
        assertThat(participant(s, "Camille").get("arrivee").get("terminal").asText()).isEqualTo("Sud");
        assertThat(participant(s, "Camille").get("arrivee").get("dossier").asText()).isEqualTo("ABC123");
        assertThat(participant(s, "Léo").get("arrivee").get("dossier").asText()).isEqualTo("XYZ789");

        s = envoyer("PUT", base + "/trajets", dt, """
                {"sens":"ARRIVEE","trajet":{"date":"%s","heure":"15:05","transport":"AVION","numero":"TX510",
                 "dossier":"GRP001"},"participantIds":[%d,%d]}""".formatted(debut, camille, leo), 200);
        assertThat(participant(s, "Camille").get("arrivee").get("dossier").asText()).isEqualTo("GRP001");
        assertThat(participant(s, "Léo").get("arrivee").get("dossier").asText()).isEqualTo("GRP001");
    }
}
