package fr.club.plongee;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sorties et choix de leurs séances, de bout en bout. Chaque test prend ses
 * propres dates, loin des autres, la base étant partagée entre les tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SortieTest {

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

    /** Un séjour de deux jours à deux plongées, et un autre lieu le même samedi. */
    private List<Long> creerPlongees(String jeton, LocalDate samedi) throws Exception {
        List<Long> ids = new ArrayList<>();
        for (JsonNode s : envoyer("POST", "/api/seances/serie", jeton, """
                {"dateDebut":"%s","dateFin":"%s","plongeesParJour":2,"milieu":"NATUREL","lieu":"Blaisy"}"""
                .formatted(samedi, samedi.plusDays(1)), 201)) ids.add(s.get("id").asLong());
        for (JsonNode s : envoyer("POST", "/api/seances/serie", jeton, """
                {"dateDebut":"%s","dateFin":"%s","plongeesParJour":1,"milieu":"NATUREL","lieu":"Marseille"}"""
                .formatted(samedi, samedi), 201)) ids.add(s.get("id").asLong());
        return ids;
    }

    @Test
    @DisplayName("Le directeur technique crée une sortie et choisit ses plongées parmi celles de ses dates")
    void choixDesSeances() throws Exception {
        String dt = jeton("e3@club.fr");
        // Un vrai samedi : le lundi porte les séances de piscine de démonstration, qui fausseraient le compte.
        LocalDate samedi = AUJOURDHUI.plusDays(60).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        List<Long> plongees = creerPlongees(dt, samedi);

        JsonNode sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Week-end Blaisy","lieu":"Blaisy","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(samedi, samedi.plusDays(1)), 201);
        long id = sortie.get("id").asLong();

        JsonNode possibles = envoyer("GET", "/api/sorties/" + id + "/seances-possibles", dt, null, 200);
        assertThat(possibles).hasSize(5);

        // Les 4 plongées de Blaisy, pas celle de Marseille.
        String choix = plongees.subList(0, 4).toString();
        mvc.perform(put("/api/sorties/" + id + "/seances").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"seanceIds\":" + choix + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombrePlongees").value(4))
                .andExpect(jsonPath("$.seances.length()").value(4));

        // La plongée de Marseille rejoint une autre sortie ; elle ne peut plus aller dans la première.
        JsonNode marseille = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Marseille","dateDebut":"%s"}""".formatted(samedi), 201);
        envoyer("PUT", "/api/sorties/" + marseille.get("id").asLong() + "/seances", dt,
                "{\"seanceIds\":[" + plongees.get(4) + "]}", 200);
        JsonNode apres = envoyer("GET", "/api/sorties/" + id + "/seances-possibles", dt, null, 200);
        // Les n° de plongée continuent d'un séjour à l'autre : Marseille est la 3e du samedi, pas la dernière.
        JsonNode laMarseillaise = null;
        for (JsonNode p : apres) if (p.get("seance").get("id").asLong() == plongees.get(4)) laMarseillaise = p;
        assertThat(laMarseillaise.get("autreSortie").asText()).isEqualTo("Marseille");
        assertThat(laMarseillaise.get("choisie").asBoolean()).isFalse();
        envoyer("PUT", "/api/sorties/" + id + "/seances", dt,
                "{\"seanceIds\":" + plongees + "}", 422);

        // Raccourcir la sortie en laissant dehors des plongées choisies : refusé.
        JsonNode refus = envoyer("PUT", "/api/sorties/" + id, dt, """
                {"nom":"Week-end Blaisy","dateDebut":"%s"}""".formatted(samedi), 422);
        assertThat(refus.get("detail").asText()).contains("retirez-les d'abord");
    }

    @Test
    @DisplayName("Une séance hors des dates de la sortie ne peut pas y être ajoutée")
    void seanceHorsDates() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(90).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        List<Long> plongees = creerPlongees(dt, samedi);
        long id = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Samedi seul","dateDebut":"%s"}""".formatted(samedi), 201).get("id").asLong();
        JsonNode refus = envoyer("PUT", "/api/sorties/" + id + "/seances", dt,
                "{\"seanceIds\":[" + plongees.get(2) + "]}", 422);
        assertThat(refus.get("detail").asText()).contains("hors des dates de la sortie");
    }

    @Test
    @DisplayName("Les fiches de sécurité d'une sortie s'impriment d'un coup, une par page")
    void fichesSecuriteDeLaSortie() throws Exception {
        String dt = jeton("e3@club.fr");
        String admin = jeton("presidente@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(120).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        List<Long> plongees = creerPlongees(dt, samedi);
        long id = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Week-end fiches","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(samedi, samedi.plusDays(1)), 201).get("id").asLong();
        envoyer("PUT", "/api/sorties/" + id + "/seances", dt,
                "{\"seanceIds\":" + plongees.subList(0, 4) + "}", 200);

        // Aucune fiche encore établie : refus explicite plutôt qu'un PDF vide.
        JsonNode refus = envoyer("GET", "/api/sorties/" + id + "/fiches-securite.pdf", dt, null, 422);
        assertThat(refus.get("detail").asText()).contains("Aucune fiche de sécurité");

        long dpId = -1;
        for (JsonNode m : envoyer("GET", "/api/admin/moniteurs", admin, null, 200)) {
            if ("e3@club.fr".equals(m.get("email").asText())) dpId = m.get("id").asLong();
        }
        // Trois des quatre plongées ont leur fiche : la quatrième est sautée.
        for (Long seance : plongees.subList(0, 3)) {
            envoyer("PUT", "/api/seances/" + seance + "/fiche-securite", dt, """
                    {"dpId":%d,"palanquees":[{"numero":1,"profondeurPrevue":20,"dureePrevue":40,
                     "membres":[{"nom":"Dulac","prenom":"Anis","aptitude":"N2","fonction":"GUIDE_PALANQUEE"}]}]}"""
                    .formatted(dpId), 200);
        }
        // La fiche d'une plongée connaît sa sortie, pour proposer d'imprimer toutes les autres.
        JsonNode fiche = envoyer("GET", "/api/seances/" + plongees.get(0) + "/fiche-securite", dt, null, 200);
        assertThat(fiche.get("sortie").get("nom").asText()).isEqualTo("Week-end fiches");

        byte[] pdf = mvc.perform(get("/api/sorties/" + id + "/fiches-securite.pdf")
                        .header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(3);
        }
    }

    @Test
    @DisplayName("En fin de séjour, chaque plongeur du groupe reçoit par e-mail ses seules plongées")
    void envoiDesParametresAuGroupe() throws Exception {
        String dt = jeton("e3@club.fr");
        String admin = jeton("presidente@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(150).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        List<Long> plongees = creerPlongees(dt, samedi);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour e-mails","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(samedi, samedi.plusDays(1)), 201).get("id").asLong();
        envoyer("PUT", "/api/sorties/" + sortie + "/seances", dt,
                "{\"seanceIds\":" + plongees.subList(0, 4) + "}", 200);

        long saisonId = -1;
        for (JsonNode s : envoyer("GET", "/api/saisons", admin, null, 200)) {
            if (s.get("ouverte").asBoolean()) saisonId = s.get("id").asLong();
        }
        JsonNode groupe = envoyer("POST", "/api/groupes-plongeurs", dt, """
                {"nom":"Groupe e-mails","saisonId":%d,"membres":[
                  {"nom":"Dulac","prenom":"Anis","aptitude":"N2","email":"anis@exemple.fr"},
                  {"nom":"Perrot","prenom":"Sonia","aptitude":"N1","email":"sonia@exemple.fr"},
                  {"nom":"Sansmail","prenom":"Paul","aptitude":"N1"},
                  {"nom":"Absente","prenom":"Zoé","aptitude":"N1","email":"zoe@exemple.fr"}]}"""
                .formatted(saisonId), 200);
        assertThat(groupe.get("membres").get(0).get("email").asText()).isEqualTo("anis@exemple.fr");
        long groupeId = groupe.get("id").asLong();

        // Pas encore de fiche : rien à envoyer.
        envoyer("POST", "/api/groupes-plongeurs/" + groupeId + "/envoi-parametres", dt,
                "{\"sortieId\":" + sortie + "}", 422);

        long dpId = -1;
        for (JsonNode m : envoyer("GET", "/api/admin/moniteurs", admin, null, 200)) {
            if ("e3@club.fr".equals(m.get("email").asText())) dpId = m.get("id").asLong();
        }
        String anis = "{\"nom\":\"Dulac\",\"prenom\":\"Anis\",\"aptitude\":\"N2\",\"fonction\":\"GUIDE_PALANQUEE\"}";
        String sonia = "{\"nom\":\"Perrot\",\"prenom\":\"Sonia\",\"aptitude\":\"N1\",\"fonction\":\"PLONGEUR\"}";
        String paul = "{\"nom\":\"Sansmail\",\"prenom\":\"Paul\",\"aptitude\":\"N1\",\"fonction\":\"PLONGEUR\"}";
        // Plongée 1 : Anis et Sonia ensemble ; plongée 2 : Anis avec Paul, Sonia seule dans une autre palanquée.
        envoyer("PUT", "/api/seances/" + plongees.get(0) + "/fiche-securite", dt, """
                {"dpId":%d,"palanquees":[{"numero":1,"membres":[%s,%s]}]}""".formatted(dpId, anis, sonia), 200);
        envoyer("PUT", "/api/seances/" + plongees.get(1) + "/fiche-securite", dt, """
                {"dpId":%d,"palanquees":[{"numero":1,"membres":[%s,%s]},{"numero":2,"membres":[%s]}]}"""
                .formatted(dpId, anis, paul, sonia), 200);
        envoyer("PUT", "/api/seances/" + plongees.get(2) + "/fiche-securite", dt, """
                {"dpId":%d,"palanquees":[{"numero":1,"membres":[%s]}]}""".formatted(dpId, anis), 200);

        JsonNode bilan = envoyer("POST", "/api/groupes-plongeurs/" + groupeId + "/envoi-parametres", dt,
                "{\"sortieId\":" + sortie + "}", 200);
        assertThat(bilan.get("envoyes")).hasSize(2);
        for (JsonNode d : bilan.get("envoyes")) {
            if (d.get("email").asText().equals("anis@exemple.fr")) assertThat(d.get("nombrePlongees").asInt()).isEqualTo(3);
            else assertThat(d.get("nombrePlongees").asInt()).isEqualTo(2);
        }
        assertThat(bilan.get("sansEmail").get(0).asText()).isEqualTo("Paul Sansmail");
        assertThat(bilan.get("sansPlongee").get(0).asText()).isEqualTo("Zoé Absente");
    }

    @Test
    @DisplayName("Un moniteur consulte les sorties mais ne les gère pas")
    void droits() throws Exception {
        String e1 = jeton("e1@club.fr");
        JsonNode sorties = envoyer("GET", "/api/sorties", e1, null, 200);
        assertThat(sorties).extracting(s -> s.get("nom").asText()).contains("Week-end à Blaisy");
        envoyer("POST", "/api/sorties", e1, """
                {"nom":"Pirate","dateDebut":"%s"}""".formatted(AUJOURDHUI), 403);
    }
}
