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
 * Le séjour d'une sortie de bout en bout : participants, voitures,
 * chambres, affaires, programme, et le carnet lu par un participant.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SejourTest {

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
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long idDe(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p.get("id").asLong();
        throw new AssertionError(prenom + " absent du séjour");
    }

    private long eleveCamille(String jeton) throws Exception {
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", jeton, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) return p.get("eleveId").asLong();
        }
        throw new AssertionError("Camille introuvable");
    }

    @Test
    @DisplayName("Le directeur technique organise le séjour ; Camille lit son carnet sans les données des autres")
    void organiserUnSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = AUJOURDHUI.plusDays(200);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour test","lieu":"Marseille","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(3)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;

        // Camille, depuis son dossier : son e-mail et la personne à prévenir en sont repris si le dossier en a.
        JsonNode s = envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true,"regimes":["VEGETARIEN"],
                 "urgenceNom":"Hélène","urgenceTelephone":"0600000000",
                 "arrivee":{"date":"%s","heure":"10:35","transport":"AVION","numero":"AF1234","lieu":"Marignane"}}"""
                .formatted(eleveCamille(dt), debut), 200);
        s = envoyer("POST", base + "/participants", dt, """
                {"nom":"Durand","prenom":"Léo","plongeur":false,"regimes":["SANS_PORC"],"telephone":"0611111111"}""", 200);
        s = envoyer("POST", base + "/participants", dt, """
                {"nom":"Roux","prenom":"Inès","plongeur":true}""", 200);
        assertThat(s.get("participants")).hasSize(3);
        long camille = idDe(s, "Camille"), leo = idDe(s, "Léo"), ines = idDe(s, "Inès");

        // Pas deux fois la même personne, ni un départ avant l'arrivée.
        JsonNode refus = envoyer("POST", base + "/participants", dt, """
                {"nom":"durand","prenom":"léo","plongeur":true}""", 422);
        assertThat(refus.get("detail").asText()).contains("participe déjà");
        envoyer("PUT", base + "/participants/" + ines, dt, """
                {"nom":"Roux","prenom":"Inès","plongeur":true,
                 "arrivee":{"date":"%s"},"depart":{"date":"%s"}}""".formatted(debut.plusDays(2), debut), 422);

        // Une voiture de 2 places pour 3 : avertissement, pas refus.
        s = envoyer("POST", base + "/voitures", dt, """
                {"nom":"Clio de Léo","places":2,"conducteurId":%d,"passagerIds":[%d,%d,%d]}"""
                .formatted(leo, camille, ines, leo), 200);
        JsonNode voiture = s.get("voitures").get(0);
        assertThat(voiture.get("passagerIds")).hasSize(2); // le conducteur ne se compte pas deux fois
        assertThat(s.get("avertissements").toString()).contains("3 personnes pour 2 places");

        // Un gîte : Camille et Inès dans la chambre 1, Léo sans chambre.
        s = envoyer("POST", base + "/logements", dt, """
                {"nom":"Gîte","chambres":[{"nom":"Chambre 1","couchages":2,"occupantIds":[%d,%d]},
                                         {"nom":"Chambre 2","couchages":1,"occupantIds":[]}]}"""
                .formatted(camille, ines), 200);
        assertThat(s.get("avertissements").toString()).contains("Sans chambre : Léo Durand");
        // Une même personne dans deux chambres : refusé, même dans deux logements.
        envoyer("POST", base + "/logements", dt, """
                {"nom":"Hôtel","chambres":[{"nom":"101","couchages":2,"occupantIds":[%d]}]}""".formatted(camille), 422);

        s = envoyer("PUT", base + "/affaires", dt, """
                {"affaires":[{"categorie":"DOCUMENTS","libelle":"Carte de niveau","indispensable":true},
                             {"categorie":"PLONGEE","libelle":"Masque","indispensable":false}]}""", 200);
        assertThat(s.get("affaires")).hasSize(2);
        s = envoyer("POST", base + "/evenements", dt, """
                {"jour":"%s","heureDebut":"08:00","titre":"Rendez-vous au port"}""".formatted(debut), 200);
        assertThat(s.get("evenements").get(0).get("titre").asText()).isEqualTo("Rendez-vous au port");
        envoyer("POST", base + "/evenements", dt, """
                {"jour":"%s","titre":"Trop loin"}""".formatted(debut.plusDays(60)), 422);
        envoyer("PUT", base + "/infos", dt, """
                {"infosPratiques":"Urgences : 112"}""", 200);

        // Un moniteur lit tout, sans pouvoir modifier.
        String e1 = jeton("e1@club.fr");
        JsonNode lu = envoyer("GET", base, e1, null, 200);
        assertThat(lu.get("gere").asBoolean()).isFalse();
        assertThat(lu.get("participants").toString()).contains("SANS_PORC");
        envoyer("PUT", base + "/infos", e1, "{\"infosPratiques\":\"x\"}", 403);

        // Camille (compte élève) lit son carnet : ses données, pas celles des autres.
        String eleve = jeton("eleve@club.fr");
        JsonNode carnet = envoyer("GET", base, eleve, null, 200);
        assertThat(carnet.get("encadrant").asBoolean()).isFalse();
        for (JsonNode p : carnet.get("participants")) {
            if (p.get("moi").asBoolean()) {
                assertThat(p.get("regimes").toString()).contains("VEGETARIEN");
                assertThat(p.get("arrivee").get("numero").asText()).isEqualTo("AF1234");
            } else {
                assertThat(p.get("regimes")).isEmpty();
                assertThat(p.get("telephone").isNull()).isTrue();
            }
        }
        assertThat(carnet.get("avertissements")).isEmpty();
        boolean listee = false;
        for (JsonNode r : envoyer("GET", "/api/sejours", eleve, null, 200)) {
            if (r.get("sortieId").asLong() == sortie) listee = true;
        }
        assertThat(listee).isTrue();

        // Le carnet par e-mail : Léo n'a pas d'adresse.
        JsonNode bilan = envoyer("POST", base + "/envoi-carnet", dt, null, 200);
        assertThat(bilan.get("sansEmail").toString()).contains("Léo Durand");

        // Partage des frais : Inès avance le gîte (90 €) pour elle et Camille, Camille les courses (30 €) pour trois.
        s = envoyer("POST", base + "/depenses", dt, """
                {"libelle":"Gîte","categorie":"HEBERGEMENT","montantCentimes":9000,"payeurId":%d,
                 "parts":[{"participantId":%d,"parts":1},{"participantId":%d,"parts":1}]}"""
                .formatted(ines, ines, camille), 200).get("sejour");
        s = envoyer("POST", base + "/depenses", dt, """
                {"libelle":"Courses","categorie":"REPAS","montantCentimes":3000,"payeurId":%d,
                 "parts":[{"participantId":%d,"parts":1},{"participantId":%d,"parts":1},{"participantId":%d,"parts":1}]}"""
                .formatted(camille, ines, camille, leo), 200).get("sejour");
        JsonNode comptes = s.get("frais").get("comptes");
        assertThat(comptes.get("totalCentimes").asLong()).isEqualTo(12000);
        // Inès : payé 90, doit 55 → +35. Camille : payé 30, doit 55 → -25. Léo : doit 10.
        JsonNode remboursements = comptes.get("remboursements");
        assertThat(remboursements.toString())
                .contains("{\"deId\":%d,\"aId\":%d,\"montantCentimes\":2500}".formatted(camille, ines))
                .contains("{\"deId\":%d,\"aId\":%d,\"montantCentimes\":1000}".formatted(leo, ines));
        // Sans participant, une dépense est refusée.
        envoyer("POST", base + "/depenses", dt, """
                {"libelle":"Rien","categorie":"AUTRE","montantCentimes":100,"payeurId":%d,"parts":[]}"""
                .formatted(ines), 422);
        // Léo rembourse Inès : il ne figure plus dans les remboursements à faire.
        s = envoyer("POST", base + "/versements", dt, """
                {"deId":%d,"aId":%d,"montantCentimes":1000}""".formatted(leo, ines), 200);
        assertThat(s.get("frais").get("comptes").get("remboursements")).hasSize(1);
        // Le carnet de Camille montre aussi les comptes.
        assertThat(envoyer("GET", base, eleve, null, 200).get("frais").get("depenses")).hasSize(2);
        // Léo figure dans les frais : il ne se retire pas tant qu'on ne l'en a pas sorti.
        envoyer("DELETE", base + "/participants/" + leo, dt, null, 422);
        long courses = s.get("frais").get("depenses").get(1).get("id").asLong();
        envoyer("DELETE", base + "/depenses/" + courses, dt, null, 200);
        long versement = s.get("frais").get("versements").get(0).get("id").asLong();
        envoyer("DELETE", base + "/versements/" + versement, dt, null, 200);

        // Retirer Léo : il quitte sa voiture, qui n'a plus de conducteur.
        s = envoyer("DELETE", base + "/participants/" + leo, dt, null, 200);
        assertThat(s.get("voitures").get(0).get("conducteurId").isNull()).isTrue();
        assertThat(s.get("avertissements").toString()).contains("pas encore de conducteur");

        // La sortie supprimée emporte son séjour.
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
        envoyer("GET", base, dt, null, 404);
    }

    @Test
    @DisplayName("Un élève qui ne participe pas au séjour ne le lit pas")
    void horsDuSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = AUJOURDHUI.plusDays(230);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour fermé","dateDebut":"%s"}""".formatted(debut), 201).get("id").asLong();
        envoyer("GET", "/api/sejours/" + sortie, jeton("eleve@club.fr"), null, 403);
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
