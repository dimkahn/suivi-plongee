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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Les fiches de sécurité d'un séjour, gérées depuis sa page : la liste de
 * ses plongées avec l'état de leur fiche, l'ajout et la suppression d'une
 * plongée par les organisateurs. Chaque test prend ses propres dates.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FichesSecuriteSejourTest {

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

    /** Un séjour de deux jours, créé par le directeur technique, qui en est donc l'organisateur. */
    private long sejour(String dt, String nom, LocalDate samedi) throws Exception {
        return envoyer("POST", "/api/sorties", dt, """
                {"nom":"%s","lieu":"Blaisy","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(nom, samedi, samedi.plusDays(1)), 201).get("id").asLong();
    }

    private long moniteurId(String admin, String email) throws Exception {
        for (JsonNode m : envoyer("GET", "/api/admin/moniteurs", admin, null, 200)) {
            if (email.equals(m.get("email").asText())) return m.get("id").asLong();
        }
        throw new AssertionError(email + " introuvable");
    }

    private JsonNode plongee(JsonNode liste, long seanceId) {
        for (JsonNode p : liste.get("plongees")) if (p.get("seanceId").asLong() == seanceId) return p;
        throw new AssertionError("Plongée " + seanceId + " absente du séjour");
    }

    @Test
    @DisplayName("L'organisateur ajoute une plongée au séjour ; sa fiche s'y lit une fois établie")
    void ajouterUnePlongee() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(70).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        long id = sejour(dt, "Séjour fiches 1", samedi);
        String base = "/api/sejours/" + id;

        JsonNode vide = envoyer("GET", base + "/fiches-securite", dt, null, 200);
        assertThat(vide.get("plongees")).isEmpty();
        assertThat(vide.get("peutAjouter").asBoolean()).isTrue();

        JsonNode liste = envoyer("POST", base + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL","lieu":"Blaisy","site":"La Roche","profondeurMax":20}"""
                .formatted(samedi.plusDays(1)), 200);
        assertThat(liste.get("plongees")).hasSize(1);
        JsonNode p = liste.get("plongees").get(0);
        assertThat(p.get("date").asText()).isEqualTo(samedi.plusDays(1).toString());
        assertThat(p.get("site").asText()).isEqualTo("La Roche");
        assertThat(p.get("fiche").asBoolean()).isFalse();
        assertThat(p.get("supprimable").asBoolean()).isTrue();
        long seance = p.get("seanceId").asLong();

        // La plongée fait bien partie de la sortie : elle est au programme du séjour.
        JsonNode sortie = envoyer("GET", "/api/sorties/" + id, dt, null, 200);
        assertThat(sortie.get("nombrePlongees").asInt()).isEqualTo(1);

        // Une seconde plongée le même jour prend le n° suivant.
        liste = envoyer("POST", base + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL","lieu":"Blaisy"}""".formatted(samedi.plusDays(1)), 200);
        assertThat(liste.get("plongees")).hasSize(2);
        assertThat(liste.get("plongees").get(1).get("ordre").asInt())
                .isEqualTo(liste.get("plongees").get(0).get("ordre").asInt() + 1);

        long dp = moniteurId(jeton("presidente@club.fr"), "e3@club.fr");
        envoyer("PUT", "/api/seances/" + seance + "/fiche-securite", dt, """
                {"dpId":%d,"palanquees":[{"numero":1,"profondeurPrevue":20,"dureePrevue":40,"membres":[
                  {"nom":"Dulac","prenom":"Anis","aptitude":"N2","fonction":"GUIDE_PALANQUEE"},
                  {"nom":"Perrot","prenom":"Sonia","aptitude":"N1","fonction":"PLONGEUR"}]}]}"""
                .formatted(dp), 200);
        JsonNode avecFiche = plongee(envoyer("GET", base + "/fiches-securite", dt, null, 200), seance);
        assertThat(avecFiche.get("fiche").asBoolean()).isTrue();
        assertThat(avecFiche.get("signee").asBoolean()).isFalse();
        assertThat(avecFiche.get("dpId").asLong()).isEqualTo(dp);
        assertThat(avecFiche.get("palanquees").asInt()).isEqualTo(1);
        assertThat(avecFiche.get("plongeurs").asInt()).isEqualTo(2);
        assertThat(avecFiche.get("supprimable").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("Une plongée hors des dates du séjour ne s'y ajoute pas")
    void plongeeHorsDates() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(77).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        long id = sejour(dt, "Séjour fiches 2", samedi);
        JsonNode refus = envoyer("POST", "/api/sejours/" + id + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL"}""".formatted(samedi.plusDays(2)), 422);
        assertThat(refus.get("detail").asText()).contains("hors des dates du séjour");
    }

    @Test
    @DisplayName("Un encadrant qui n'organise pas lit les fiches du séjour sans ajouter ni supprimer de plongée ; un élève ne les lit pas")
    void droits() throws Exception {
        String dt = jeton("e3@club.fr");
        String e1 = jeton("e1@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(84).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        long id = sejour(dt, "Séjour fiches 3", samedi);
        String base = "/api/sejours/" + id;
        long seance = envoyer("POST", base + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL"}""".formatted(samedi), 200)
                .get("plongees").get(0).get("seanceId").asLong();

        JsonNode lue = envoyer("GET", base + "/fiches-securite", e1, null, 200);
        assertThat(lue.get("plongees")).hasSize(1);
        assertThat(lue.get("peutAjouter").asBoolean()).isFalse();
        assertThat(lue.get("peutEtablir").asBoolean()).isFalse();
        envoyer("POST", base + "/plongees", e1, """
                {"date":"%s","milieu":"NATUREL"}""".formatted(samedi), 403);
        envoyer("DELETE", base + "/plongees/" + seance, e1, null, 403);
        envoyer("GET", base + "/fiches-securite", jeton("eleve@club.fr"), null, 403);
    }

    @Test
    @DisplayName("Une plongée du séjour se supprime tant qu'elle n'a pas de fiche de sécurité")
    void supprimerUnePlongee() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(91).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        long id = sejour(dt, "Séjour fiches 4", samedi);
        String base = "/api/sejours/" + id;
        JsonNode liste = envoyer("POST", base + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL"}""".formatted(samedi), 200);
        liste = envoyer("POST", base + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL"}""".formatted(samedi), 200);
        long avecFiche = liste.get("plongees").get(0).get("seanceId").asLong();
        long sansFiche = liste.get("plongees").get(1).get("seanceId").asLong();

        long dp = moniteurId(jeton("presidente@club.fr"), "e3@club.fr");
        envoyer("PUT", "/api/seances/" + avecFiche + "/fiche-securite", dt, """
                {"dpId":%d,"palanquees":[{"numero":1,"membres":[
                  {"nom":"Dulac","prenom":"Anis","aptitude":"N2","fonction":"GUIDE_PALANQUEE"}]}]}"""
                .formatted(dp), 200);
        JsonNode refus = envoyer("DELETE", base + "/plongees/" + avecFiche, dt, null, 422);
        assertThat(refus.get("detail").asText()).contains("fiche de sécurité");

        liste = envoyer("DELETE", base + "/plongees/" + sansFiche, dt, null, 200);
        assertThat(liste.get("plongees")).extracting(p -> p.get("seanceId").asLong()).containsExactly(avecFiche);
        // La séance elle-même a disparu, pas seulement son rattachement au séjour.
        envoyer("PUT", "/api/seances/" + sansFiche, dt, """
                {"dateSeance":"%s","milieu":"NATUREL"}""".formatted(samedi), 404);
    }

    @Test
    @DisplayName("Une plongée d'une autre sortie ne se supprime pas depuis ce séjour")
    void plongeeDUneAutreSortie() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate samedi = AUJOURDHUI.plusDays(98).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        long premier = sejour(dt, "Séjour fiches 5", samedi);
        long second = sejour(dt, "Séjour fiches 6", samedi.plusDays(7));
        long seance = envoyer("POST", "/api/sejours/" + second + "/plongees", dt, """
                {"date":"%s","milieu":"NATUREL"}""".formatted(samedi.plusDays(7)), 200)
                .get("plongees").get(0).get("seanceId").asLong();
        envoyer("DELETE", "/api/sejours/" + premier + "/plongees/" + seance, dt, null, 404);
        assertThat(envoyer("GET", "/api/sejours/" + second + "/fiches-securite", dt, null, 200).get("plongees"))
                .hasSize(1);
    }
}
