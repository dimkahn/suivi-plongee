package fr.club.plongee;

import fr.club.plongee.notification.service.ServiceNotification;
import fr.club.plongee.securite.domain.Utilisateur;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Depuis le séjour, l'organisateur envoie à un ou plusieurs participants
 * cochés les paramètres de leurs plongées, lus sur les fiches de sécurité.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(ParametresPlongeeSejourTest.BoiteAuxLettres.class)
class ParametresPlongeeSejourTest {

    record Courriel(String adresse, String sujet, String corps) {}

    static final List<Courriel> COURRIELS = new ArrayList<>();

    @TestConfiguration
    static class BoiteAuxLettres {
        @Bean @Primary
        ServiceNotification notificationDeTest() {
            return new ServiceNotification() {
                @Override public void envoyerLienReinitialisation(Utilisateur u, String jeton) {}
                @Override public void envoyerLienInvitation(Utilisateur u, String jeton) {}
                @Override public boolean envoyerCourriel(String adresse, String sujet, String corps) {
                    synchronized (COURRIELS) { COURRIELS.add(new Courriel(adresse, sujet, corps)); }
                    return true;
                }
            };
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
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

    private static List<Courriel> pour(String adresse) {
        synchronized (COURRIELS) {
            return COURRIELS.stream().filter(c -> c.adresse().equals(adresse)).toList();
        }
    }

    private long idDe(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p.get("id").asLong();
        throw new AssertionError(prenom + " absent du séjour");
    }

    /** Un séjour d'une plongée (samedi de fin de saison de démo), créé par e3, préfixe unique pour les adresses. */
    private record Sejour(String base, long seance, JsonNode vue) {}

    private Sejour sejour(String dt, String prefixe) throws Exception {
        LocalDate samedi = LocalDate.of(2027, 6, 30).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        long seance = envoyer("POST", "/api/seances/serie", dt, """
                {"dateDebut":"%s","dateFin":"%s","plongeesParJour":1,"milieu":"NATUREL","lieu":"Cassis"}"""
                .formatted(samedi, samedi), 201).get(0).get("id").asLong();
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour %s","dateDebut":"%s"}""".formatted(prefixe, samedi), 201).get("id").asLong();
        envoyer("PUT", "/api/sorties/" + sortie + "/seances", dt, "{\"seanceIds\":[" + seance + "]}", 200);
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Roux","prenom":"Inès","plongeur":true,"email":"%s-ines@club.fr"}""".formatted(prefixe), 200);
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Morel","prenom":"Sami","plongeur":true,"email":"%s-sami@club.fr"}""".formatted(prefixe), 200);
        JsonNode vue = envoyer("POST", base + "/participants", dt, """
                {"nom":"Lenoir","prenom":"Zoé","plongeur":false,"email":"%s-zoe@club.fr"}""".formatted(prefixe), 200);
        return new Sejour(base, seance, vue);
    }

    private void fiche(String dt, long seance) throws Exception {
        long dpId = -1;
        for (JsonNode m : envoyer("GET", "/api/admin/moniteurs", jeton("presidente@club.fr"), null, 200)) {
            if ("e3@club.fr".equals(m.get("email").asText())) dpId = m.get("id").asLong();
        }
        envoyer("PUT", "/api/seances/" + seance + "/fiche-securite", dt, """
                {"dpId":%d,"palanquees":[
                  {"numero":1,"profondeurPrevue":20,"dureePrevue":40,"membres":[
                    {"nom":"ROUX","prenom":"Ines","aptitude":"N2","fonction":"PLONGEUR"},
                    {"nom":"Dulac","prenom":"Anis","aptitude":"E2","fonction":"ENCADRANT"}]},
                  {"numero":2,"profondeurPrevue":35,"membres":[
                    {"nom":"Morel","prenom":"Sami","aptitude":"N4","fonction":"PLONGEUR"}]}]}"""
                .formatted(dpId), 200);
    }

    @Test
    @DisplayName("L'organisateur envoie leurs paramètres de plongée aux seuls participants cochés")
    void seulementAuxCoches() throws Exception {
        String dt = jeton("e3@club.fr");
        Sejour s = sejour(dt, "coches");
        fiche(dt, s.seance());
        long ines = idDe(s.vue(), "Inès");
        long zoe = idDe(s.vue(), "Zoé");

        JsonNode bilan = envoyer("POST", s.base() + "/envoi-parametres", dt,
                "{\"participantIds\":[%d,%d]}".formatted(ines, zoe), 200);

        assertThat(bilan.get("envoyes")).hasSize(1);
        assertThat(bilan.get("envoyes").get(0).get("nom").asText()).isEqualTo("Inès Roux");
        assertThat(bilan.get("envoyes").get(0).get("nombrePlongees").asInt()).isEqualTo(1);
        assertThat(bilan.get("sansPlongee").toString()).contains("Zoé Lenoir");
        List<Courriel> recus = pour("coches-ines@club.fr");
        assertThat(recus).hasSize(1);
        assertThat(recus.getFirst().corps()).contains("Profondeur : 20 m (prévue)", "Anis Dulac").doesNotContain("Morel");
        assertThat(pour("coches-sami@club.fr")).isEmpty();
        assertThat(pour("coches-zoe@club.fr")).isEmpty();
    }

    @Test
    @DisplayName("Sans fiche de sécurité, rien à envoyer : refus lisible")
    void sansFiche() throws Exception {
        String dt = jeton("e3@club.fr");
        Sejour s = sejour(dt, "sansfiche");
        JsonNode refus = envoyer("POST", s.base() + "/envoi-parametres", dt,
                "{\"participantIds\":[%d]}".formatted(idDe(s.vue(), "Inès")), 422);
        assertThat(refus.get("detail").asText()).contains("Aucune fiche de sécurité");
    }

    @Test
    @DisplayName("Un moniteur qui n'organise pas le séjour n'envoie pas les paramètres")
    void reserveAuxOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr");
        Sejour s = sejour(dt, "droits");
        fiche(dt, s.seance());
        envoyer("POST", s.base() + "/envoi-parametres", jeton("e1@club.fr"),
                "{\"participantIds\":[%d]}".formatted(idDe(s.vue(), "Inès")), 403);
        assertThat(pour("droits-ines@club.fr")).isEmpty();
    }

    @Test
    @DisplayName("Un participant d'un autre séjour n'est pas un destinataire possible")
    void participantDUnAutreSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        Sejour a = sejour(dt, "autre-a");
        Sejour b = sejour(dt, "autre-b");
        fiche(dt, a.seance());
        envoyer("POST", a.base() + "/envoi-parametres", dt,
                "{\"participantIds\":[%d]}".formatted(idDe(b.vue(), "Inès")), 404);
        envoyer("POST", a.base() + "/envoi-parametres", dt, "{\"participantIds\":[]}", 422);
    }
}
