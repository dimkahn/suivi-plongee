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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le séjour modifié sans réseau : le téléphone garde chaque modification et
 * la rejoue au retour du réseau. Une création envoyée deux fois (la réponse
 * s'est perdue en route) porte la même référence client ({@code
 * X-Reference-Client}) et n'est faite qu'une fois.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SejourHorsLigneTest {

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

    private JsonNode envoyer(String methode, String url, String jeton, String reference, String corps, int attendu)
            throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        if (reference != null) requete.header("X-Reference-Client", reference);
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    /** Envoie deux fois la même création, avec la même référence ; rend la seconde réponse. */
    private JsonNode deuxFois(String url, String jeton, String corps) throws Exception {
        String reference = UUID.randomUUID().toString();
        envoyer("POST", url, jeton, reference, corps, 200);
        return envoyer("POST", url, jeton, reference, corps, 200);
    }

    private long nouveauSejour(String dt) throws Exception {
        LocalDate debut = AUJOURDHUI.plusDays(150);
        return envoyer("POST", "/api/sorties", dt, null, """
                {"nom":"Séjour hors ligne","lieu":"Hyères","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(2)), 201).get("id").asLong();
    }

    @Test
    @DisplayName("Un participant, une voiture, un logement, un rendez-vous rejoués avec la même référence ne sont créés qu'une fois")
    void creationsDuSejourRejouees() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = "/api/sejours/" + nouveauSejour(dt);
        LocalDate jour = AUJOURDHUI.plusDays(150);

        JsonNode s = deuxFois(base + "/participants", dt, """
                {"nom":"Morel","prenom":"Lou","plongeur":true}""");
        assertThat(s.get("participants")).hasSize(1);

        s = deuxFois(base + "/voitures", dt, """
                {"nom":"Clio","places":5,"passagerIds":[]}""");
        assertThat(s.get("voitures")).hasSize(1);

        s = deuxFois(base + "/logements", dt, """
                {"nom":"Gîte","chambres":[{"nom":"Ch. 1","couchages":2,"occupantIds":[]}]}""");
        assertThat(s.get("logements")).hasSize(1);

        s = deuxFois(base + "/evenements", dt, """
                {"jour":"%s","titre":"Apéritif"}""".formatted(jour));
        assertThat(s.get("evenements")).hasSize(1);

        // Deux créations distinctes (deux références) font bien deux voitures.
        s = envoyer("POST", base + "/voitures", dt, UUID.randomUUID().toString(), """
                {"nom":"Kangoo","places":7,"passagerIds":[]}""", 200);
        assertThat(s.get("voitures")).hasSize(2);
    }

    @Test
    @DisplayName("Une dépense rejouée avec la même référence n'est comptée qu'une fois, et garde son numéro")
    void depenseRejouee() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = "/api/sejours/" + nouveauSejour(dt);
        envoyer("POST", base + "/participants", dt, null, """
                {"nom":"Morel","prenom":"Lou","plongeur":true}""", 200);
        JsonNode s = envoyer("POST", base + "/participants", dt, null, """
                {"nom":"Petit","prenom":"Noé","plongeur":true}""", 200);
        long lou = s.get("participants").get(0).get("id").asLong();
        long noe = s.get("participants").get(1).get("id").asLong();

        String reference = UUID.randomUUID().toString();
        String corps = """
                {"libelle":"Restaurant","categorie":"REPAS","montantCentimes":6000,"payeurId":%d,
                 "parts":[{"participantId":%d,"parts":1},{"participantId":%d,"parts":1}]}""".formatted(lou, lou, noe);
        JsonNode premiere = envoyer("POST", base + "/depenses", dt, reference, corps, 200);
        JsonNode seconde = envoyer("POST", base + "/depenses", dt, reference, corps, 200);
        assertThat(seconde.get("depenseId").asLong()).isEqualTo(premiere.get("depenseId").asLong());
        assertThat(seconde.get("sejour").get("frais").get("depenses")).hasSize(1);

        s = deuxFois(base + "/versements", dt, """
                {"deId":%d,"aId":%d,"montantCentimes":3000}""".formatted(noe, lou));
        assertThat(s.get("frais").get("versements")).hasSize(1);
    }

    @Test
    @DisplayName("Une création refusée (422) ne garde pas sa référence : corrigée, elle passe")
    void creationRefuseeNeGardePasSaReference() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = "/api/sejours/" + nouveauSejour(dt);
        String reference = UUID.randomUUID().toString();
        envoyer("POST", base + "/participants", dt, null, """
                {"nom":"Morel","prenom":"Lou","plongeur":true}""", 200);

        envoyer("POST", base + "/participants", dt, reference, """
                {"nom":"morel","prenom":"lou","plongeur":true}""", 422);
        JsonNode s = envoyer("POST", base + "/participants", dt, reference, """
                {"nom":"Morel","prenom":"Louise","plongeur":true}""", 200);
        assertThat(s.get("participants")).hasSize(2);
    }

    @Test
    @DisplayName("Rejouer une création ne contourne pas les droits : un moniteur qui n'organise pas reste refusé")
    void rejeuSansDroit() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = "/api/sejours/" + nouveauSejour(dt);
        String reference = UUID.randomUUID().toString();
        envoyer("POST", base + "/voitures", dt, reference, """
                {"nom":"Clio","places":5,"passagerIds":[]}""", 200);
        envoyer("POST", base + "/voitures", jeton("e1@club.fr"), reference, """
                {"nom":"Clio","places":5,"passagerIds":[]}""", 403);
    }
}
