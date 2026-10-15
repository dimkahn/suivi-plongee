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

        // Le vol de Camille, posé d'un coup sur Inès et Léo ; le départ d'Inès avant cette arrivée est refusé.
        envoyer("PUT", base + "/participants/" + ines, dt, """
                {"nom":"Roux","prenom":"Inès","plongeur":true,"depart":{"date":"%s"}}""".formatted(debut.minusDays(1)), 200);
        envoyer("PUT", base + "/trajets", dt, """
                {"sens":"ARRIVEE","trajet":{"date":"%s","heure":"10:35","transport":"AVION","numero":"AF1234"},
                 "participantIds":[%d,%d]}""".formatted(debut, ines, leo), 422);
        envoyer("PUT", base + "/participants/" + ines, dt, """
                {"nom":"Roux","prenom":"Inès","plongeur":true}""", 200);
        s = envoyer("PUT", base + "/trajets", dt, """
                {"sens":"ARRIVEE","trajet":{"date":"%s","heure":"10:35","transport":"AVION","numero":"AF1234",
                 "heureDepart":"09:10","lieuDepart":"Paris-Orly"},
                 "participantIds":[%d,%d]}""".formatted(debut, ines, leo), 200);
        for (JsonNode p : s.get("participants")) {
            assertThat(p.get("arrivee").get("numero").asText()).isEqualTo("AF1234");
            if (p.get("id").asLong() != camille) {
                // L'heure et le lieu de départ de l'avion aller, pour le conseil « soyez à l'aéroport vers… ».
                assertThat(p.get("arrivee").get("heureDepart").asText()).startsWith("09:10");
                assertThat(p.get("arrivee").get("lieuDepart").asText()).isEqualTo("Paris-Orly");
            }
        }
        envoyer("PUT", base + "/trajets", jeton("e1@club.fr"), """
                {"sens":"DEPART","trajet":null,"participantIds":[%d]}""".formatted(ines), 403);

        // Une voiture de 2 places pour 3 : avertissement, pas refus.
        s = envoyer("POST", base + "/voitures", dt, """
                {"nom":"Clio de Léo","places":2,"conducteurId":%d,"passagerIds":[%d,%d,%d]}"""
                .formatted(leo, camille, ines, leo), 200);
        JsonNode voiture = s.get("voitures").get(0);
        assertThat(voiture.get("passagerIds")).hasSize(2); // le conducteur ne se compte pas deux fois
        assertThat(s.get("avertissements").toString()).contains("3 personnes pour 2 places");

        // Une seule voiture par personne : le conducteur Léo ne monte pas dans une autre, Inès non plus.
        envoyer("POST", base + "/voitures", dt, """
                {"nom":"Kangoo","places":5,"conducteurId":%d,"passagerIds":[]}""".formatted(leo), 422);
        envoyer("POST", base + "/voitures", dt, """
                {"nom":"Kangoo","places":5,"conducteurId":null,"passagerIds":[%d]}""".formatted(ines), 422);
        // Modifier la voiture elle-même reste possible (on ne se compte pas contre soi).
        envoyer("PUT", base + "/voitures/" + voiture.get("id").asLong(), dt, """
                {"nom":"Clio de Léo","places":2,"conducteurId":%d,"passagerIds":[%d,%d]}"""
                .formatted(leo, camille, ines), 200);

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
    @DisplayName("Un participant lié à un plongeur d'un groupe : nom, prénom et e-mail suivent dans les deux sens")
    void participantLieAuGroupeDePlongeurs() throws Exception {
        String dt = jeton("e3@club.fr");
        JsonNode saison = null;
        for (JsonNode x : envoyer("GET", "/api/saisons", dt, null, 200)) if (x.get("ouverte").asBoolean()) saison = x;
        assertThat(saison).isNotNull();
        LocalDate debut = LocalDate.parse(saison.get("dateFin").asText()).minusDays(5);
        JsonNode groupe = envoyer("POST", "/api/groupes-plongeurs", dt, """
                {"nom":"Groupe lié","saisonId":%d,"membres":[
                  {"nom":"Ferry","prenom":"Anis","aptitude":"PA40","email":"anis@exemple.fr"},
                  {"nom":"Morel","prenom":"Béa","aptitude":"PE40","email":"bea@groupe.fr"}]}"""
                .formatted(saison.get("id").asLong()), 200);
        long groupeId = groupe.get("id").asLong();
        long anisMembre = groupe.get("membres").get(0).get("id").asLong();
        long beaMembre = groupe.get("membres").get(1).get("id").asLong();
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour lié","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;

        // Inscrire le groupe : chaque participant est lié à son plongeur.
        JsonNode s = envoyer("GET", base, dt, null, 200);
        assertThat(s.get("groupesProposes").toString()).contains("Groupe lié").contains("\"aptitude\":\"PA40\"");
        // Béa était déjà inscrite avec un autre e-mail : elle n'est pas liée toute seule, son e-mail reste.
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Morel","prenom":"Béa","plongeur":true,"email":"bea.perso@exemple.fr"}""", 200);
        s = envoyer("POST", base + "/participants/groupe", dt, "{\"groupeId\":" + groupeId + "}", 200);
        long anis = idDe(s, "Anis"), bea = idDe(s, "Béa");
        assertThat(s.get("participants")).hasSize(2);
        for (JsonNode p : s.get("participants")) {
            if (p.get("id").asLong() == anis) {
                assertThat(p.get("groupe").asText()).isEqualTo("Groupe lié");
                assertThat(p.get("membreGroupeId").asLong()).isEqualTo(anisMembre);
            } else {
                assertThat(p.get("membreGroupeId").isNull()).isTrue();
                assertThat(p.get("email").asText()).isEqualTo("bea.perso@exemple.fr");
            }
        }
        // Sans e-mail dans le groupe, rien ne s'oppose : réinscrire le groupe la lie.
        envoyer("PUT", "/api/groupes-plongeurs/" + groupeId, dt, """
                {"nom":"Groupe lié","saisonId":%d,"membres":[
                  {"id":%d,"nom":"Ferry","prenom":"Anis","aptitude":"PA40","email":"anis@exemple.fr"},
                  {"id":%d,"nom":"Morel","prenom":"Béa","aptitude":"PE40"}]}"""
                .formatted(saison.get("id").asLong(), anisMembre, beaMembre), 200);
        s = envoyer("POST", base + "/participants/groupe", dt, "{\"groupeId\":" + groupeId + "}", 200);
        for (JsonNode p : s.get("participants")) {
            assertThat(p.get("membreGroupeId").asLong()).isIn(anisMembre, beaMembre);
            if (p.get("id").asLong() == bea) assertThat(p.get("email").asText()).isEqualTo("bea.perso@exemple.fr");
        }

        // Corrigé dans le groupe (la ligne garde son id) : le participant suit.
        envoyer("PUT", "/api/groupes-plongeurs/" + groupeId, dt, """
                {"nom":"Groupe lié","saisonId":%d,"membres":[
                  {"id":%d,"nom":"Ferry","prenom":"Anis-Karim","aptitude":"PA40","email":"ak@exemple.fr"},
                  {"id":%d,"nom":"Morel","prenom":"Béa","aptitude":"PE40"}]}"""
                .formatted(saison.get("id").asLong(), anisMembre, beaMembre), 200);
        s = envoyer("GET", base, dt, null, 200);
        assertThat(idDe(s, "Anis-Karim")).isEqualTo(anis);
        assertThat(s.toString()).contains("ak@exemple.fr");

        // Corrigé dans le séjour : le plongeur du groupe suit.
        envoyer("PUT", base + "/participants/" + bea, dt, """
                {"nom":"Morel","prenom":"Béatrice","plongeur":true,"email":"bea@exemple.fr","membreGroupeId":%d}"""
                .formatted(beaMembre), 200);
        JsonNode lu = null;
        for (JsonNode g : envoyer("GET", "/api/groupes-plongeurs?saisonId=" + saison.get("id").asLong(), dt, null, 200)) {
            if (g.get("id").asLong() == groupeId) lu = g;
        }
        assertThat(lu.get("membres").get(1).get("prenom").asText()).isEqualTo("Béatrice");
        assertThat(lu.get("membres").get(1).get("email").asText()).isEqualTo("bea@exemple.fr");

        // Un accompagnant n'a pas de lien ; un plongeur n'est lié qu'à un participant du séjour.
        s = envoyer("POST", base + "/participants", dt, """
                {"nom":"Ferry","prenom":"Lou","plongeur":false}""", 200);
        long lou = idDe(s, "Lou");
        for (JsonNode p : s.get("participants")) {
            if (p.get("id").asLong() == lou) assertThat(p.get("membreGroupeId").isNull()).isTrue();
        }
        envoyer("PUT", base + "/participants/" + lou, dt, """
                {"nom":"Ferry","prenom":"Lou","plongeur":true,"membreGroupeId":%d}""".formatted(anisMembre), 422);

        // Un téléphone resté à l'ancienne version de l'appli enregistre le groupe sans les id :
        // chaque plongeur est retrouvé par ses nom et prénom, sa ligne et son lien restent.
        JsonNode sansId = envoyer("PUT", "/api/groupes-plongeurs/" + groupeId, dt, """
                {"nom":"Groupe lié","saisonId":%d,"membres":[
                  {"nom":"Ferry","prenom":"Anis-Karim","aptitude":"PA40","email":"ak@exemple.fr"},
                  {"nom":"Morel","prenom":"Béatrice","aptitude":"PE40","email":"bea@exemple.fr"}]}"""
                .formatted(saison.get("id").asLong()), 200);
        assertThat(sansId.get("membres").get(0).get("id").asLong()).isEqualTo(anisMembre);
        assertThat(sansId.get("membres").get(1).get("id").asLong()).isEqualTo(beaMembre);
        s = envoyer("GET", base, dt, null, 200);
        for (JsonNode p : s.get("participants")) {
            if (p.get("id").asLong() == bea) assertThat(p.get("membreGroupeId").asLong()).isEqualTo(beaMembre);
        }

        // Une adresse mal formée est refusée, avec un message lisible.
        JsonNode refus = envoyer("PUT", base + "/participants/" + bea, dt, """
                {"nom":"Morel","prenom":"Béatrice","plongeur":true,"email":"bea@exemple","membreGroupeId":%d}"""
                .formatted(beaMembre), 422);
        assertThat(refus.get("detail").asText()).contains("n'est pas valide");

        // Retiré du groupe : le participant reste, sans lien.
        envoyer("PUT", "/api/groupes-plongeurs/" + groupeId, dt, """
                {"nom":"Groupe lié","saisonId":%d,"membres":[
                  {"id":%d,"nom":"Ferry","prenom":"Anis-Karim","aptitude":"PA40"}]}"""
                .formatted(saison.get("id").asLong(), anisMembre), 200);
        s = envoyer("GET", base, dt, null, 200);
        for (JsonNode p : s.get("participants")) {
            if (p.get("id").asLong() == bea) assertThat(p.get("membreGroupeId").isNull()).isTrue();
            if (p.get("id").asLong() == anis) assertThat(p.get("membreGroupeId").asLong()).isEqualTo(anisMembre);
        }

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
        envoyer("DELETE", "/api/groupes-plongeurs/" + groupeId, dt, null, 204);
    }

    @Test
    @DisplayName("L'e-mail du dossier n'est pas figé dans le groupe : le plongeur suit son dossier")
    void emailDuDossierNonFigeDansLeGroupe() throws Exception {
        String dt = jeton("e3@club.fr");
        JsonNode saison = null;
        for (JsonNode x : envoyer("GET", "/api/saisons", dt, null, 200)) if (x.get("ouverte").asBoolean()) saison = x;
        LocalDate debut = LocalDate.parse(saison.get("dateFin").asText()).minusDays(8);
        // Un encadrant : son compte a un e-mail (celui de son « dossier »).
        long encadrant = -1;
        String nom = null, prenom = null;
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (p.hasNonNull("utilisateurId")) {
                encadrant = p.get("utilisateurId").asLong();
                nom = p.get("nom").asText();
                prenom = p.get("prenom").asText();
                break;
            }
        }
        JsonNode groupe = envoyer("POST", "/api/groupes-plongeurs", dt, """
                {"nom":"Groupe dossier","saisonId":%d,"membres":[
                  {"utilisateurId":%d,"nom":"%s","prenom":"%s","aptitude":"E2"}]}"""
                .formatted(saison.get("id").asLong(), encadrant, nom, prenom), 200);
        long groupeId = groupe.get("id").asLong();
        long membre = groupe.get("membres").get(0).get("id").asLong();
        String emailDossier = groupe.get("membres").get(0).get("emailDossier").asText();
        assertThat(emailDossier).contains("@");
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour dossier","dateDebut":"%s"}""".formatted(debut), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;

        // Inscrit avec le groupe, son e-mail est celui du dossier ; le modifier ne le fige pas dans le groupe.
        JsonNode s = envoyer("POST", base + "/participants/groupe", dt, "{\"groupeId\":" + groupeId + "}", 200);
        long participant = idDe(s, prenom);
        assertThat(s.toString()).contains(emailDossier);
        envoyer("PUT", base + "/participants/" + participant, dt, """
                {"utilisateurId":%d,"nom":"%s","prenom":"%s","plongeur":true,"email":"%s","membreGroupeId":%d}"""
                .formatted(encadrant, nom, prenom, emailDossier, membre), 200);
        JsonNode lu = null;
        for (JsonNode g : envoyer("GET", "/api/groupes-plongeurs?saisonId=" + saison.get("id").asLong(), dt, null, 200)) {
            if (g.get("id").asLong() == groupeId) lu = g;
        }
        assertThat(lu.get("membres").get(0).get("email").isNull()).isTrue();

        // Une autre adresse que celle du dossier, elle, passe dans le groupe.
        envoyer("PUT", base + "/participants/" + participant, dt, """
                {"utilisateurId":%d,"nom":"%s","prenom":"%s","plongeur":true,"email":"camille.sejour@exemple.fr",
                 "membreGroupeId":%d}""".formatted(encadrant, nom, prenom, membre), 200);
        for (JsonNode g : envoyer("GET", "/api/groupes-plongeurs?saisonId=" + saison.get("id").asLong(), dt, null, 200)) {
            if (g.get("id").asLong() == groupeId) lu = g;
        }
        assertThat(lu.get("membres").get(0).get("email").asText()).isEqualTo("camille.sejour@exemple.fr");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
        envoyer("DELETE", "/api/groupes-plongeurs/" + groupeId, dt, null, 204);
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

    private long moniteur(String jeton, String nom) throws Exception {
        for (JsonNode m : envoyer("GET", "/api/moniteurs", jeton, null, 200)) {
            if (m.get("nomComplet").asText().contains(nom)) return m.get("id").asLong();
        }
        throw new AssertionError(nom + " introuvable");
    }

    @Test
    @DisplayName("Seuls le créateur du séjour et les organisateurs qu'il désigne le modifient ; les autres le lisent")
    void organisateursDuSejour() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr"), e2 = jeton("e2@club.fr"),
                e1 = jeton("e1@club.fr");
        LocalDate debut = AUJOURDHUI.plusDays(260);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour organisé","dateDebut":"%s"}""".formatted(debut), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        String participant = """
                {"nom":"Roux","prenom":"Inès","plongeur":true}""";

        // Le créateur (la directrice technique, qui a créé la sortie) modifie et désigne.
        JsonNode s = envoyer("GET", base, dt, null, 200);
        assertThat(s.get("gere").asBoolean()).isTrue();
        assertThat(s.get("peutDesigner").asBoolean()).isTrue();
        assertThat(s.get("organisateurs")).hasSize(1);
        assertThat(s.get("organisateurs").get(0).get("createur").asBoolean()).isTrue();
        envoyer("POST", base + "/participants", dt, participant, 200);

        // Être ADMIN ne suffit plus pour modifier : il lit, et peut seulement désigner les organisateurs.
        s = envoyer("GET", base, admin, null, 200);
        assertThat(s.get("gere").asBoolean()).isFalse();
        assertThat(s.get("peutDesigner").asBoolean()).isTrue();
        envoyer("PUT", base + "/infos", admin, """
                {"infosPratiques":"Rendez-vous au port"}""", 403);
        // Un autre moniteur lit tout, sans rien modifier ni désigner.
        s = envoyer("GET", base, e2, null, 200);
        assertThat(s.get("gere").asBoolean()).isFalse();
        assertThat(s.get("peutDesigner").asBoolean()).isFalse();
        envoyer("PUT", base + "/infos", e2, """
                {"infosPratiques":"Rendez-vous au port"}""", 403);
        envoyer("PUT", base + "/organisateurs", e2, """
                {"utilisateurIds":[%d]}""".formatted(moniteur(e2, "Vasseur")), 403);

        // Le créateur désigne Flora : elle modifie, sans pouvoir désigner à son tour.
        s = envoyer("PUT", base + "/organisateurs", dt, """
                {"utilisateurIds":[%d]}""".formatted(moniteur(dt, "Vasseur")), 200);
        assertThat(s.get("organisateurs")).hasSize(2);
        s = envoyer("PUT", base + "/infos", e2, """
                {"infosPratiques":"Rendez-vous au port"}""", 200);
        assertThat(s.get("gere").asBoolean()).isTrue();
        assertThat(s.get("peutDesigner").asBoolean()).isFalse();
        envoyer("POST", base + "/participants", e2, """
                {"nom":"Durand","prenom":"Léo","plongeur":false}""", 200);
        envoyer("PUT", base + "/organisateurs", e2, """
                {"utilisateurIds":[]}""", 403);
        assertThat(envoyer("GET", base, e1, null, 200).get("gere").asBoolean()).isFalse();
        envoyer("PUT", base + "/infos", e1, """
                {"infosPratiques":"Autre"}""", 403);

        // Seul un compte d'encadrant actif s'y désigne.
        JsonNode refus = envoyer("PUT", base + "/organisateurs", dt, """
                {"utilisateurIds":[999999]}""", 422);
        assertThat(refus.get("detail").asText()).contains("encadrant");

        // Retirée de la liste, Flora ne modifie plus ; l'ADMIN peut reprendre le séjour en se désignant.
        envoyer("PUT", base + "/organisateurs", dt, """
                {"utilisateurIds":[]}""", 200);
        envoyer("PUT", base + "/infos", e2, """
                {"infosPratiques":"Rendez-vous au ponton"}""", 403);
        envoyer("PUT", base + "/organisateurs", admin, """
                {"utilisateurIds":[%d]}""".formatted(moniteur(admin, "Ferrand")), 200);
        envoyer("PUT", base + "/infos", admin, """
                {"infosPratiques":"Rendez-vous au ponton"}""", 200);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
