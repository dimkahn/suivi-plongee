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

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * L'entrée dans son séjour depuis la page de connexion, sans le lien reçu
 * par e-mail : on donne son e-mail, on reçoit le code à 6 chiffres, et le
 * bon code ouvre le séjour (son adresse secrète et le jeton).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(EntreeSejourSansLienTest.BoiteAuxLettres.class)
class EntreeSejourSansLienTest {

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

    /** {@code jeton} : « Bearer … » pour un compte, sinon le jeton du lien (en-tête X-Jeton-Sejour), ou null. */
    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        if (jeton != null) {
            requete = jeton.startsWith("Bearer ") ? requete.header("Authorization", jeton)
                    : requete.header("X-Jeton-Sejour", jeton);
        }
        String reponse = mvc.perform(requete.contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private List<Courriel> pour(String adresse) {
        synchronized (COURRIELS) {
            return COURRIELS.stream().filter(c -> c.adresse().equals(adresse)).toList();
        }
    }

    private static String extraire(String texte, String motif) {
        Matcher m = Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }

    /** Un séjour dans {@code dans} jours, avec un invité de cet e-mail, à qui l'on a envoyé la demande d'informations. */
    private long sejourAvecInvite(String dt, String nom, int dans, String email) throws Exception {
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(dans);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"%s","dateDebut":"%s","dateFin":"%s"}""".formatted(nom, debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        envoyer("POST", "/api/sejours/" + sortie + "/participants", dt, """
                {"nom":"Sanslien","prenom":"Léo","plongeur":false,"email":"%s"}""".formatted(email), 200);
        envoyer("POST", "/api/sejours/" + sortie + "/invitations", dt, "{}", 200);
        return sortie;
    }

    @Test
    @DisplayName("Sans le lien, un invité reçoit le code par son e-mail et entre dans son séjour le plus proche")
    void entreSansLeLien() throws Exception {
        String dt = jeton("e3@club.fr");
        String email = "leo.sanslien@exemple.fr";
        long loin = sejourAvecInvite(dt, "Séjour lointain sans lien", 320, email);
        long proche = sejourAvecInvite(dt, "Séjour proche sans lien", 300, email);
        String lienProche = extraire(pour(email).getLast().corps(), "/sejour/([A-Za-z0-9_-]+)");

        envoyer("POST", "/api/public/sejours/code", null, "{\"email\":\" Leo.Sanslien@exemple.fr \"}", 204);
        Courriel code = pour(email).getLast();
        assertThat(code.sujet()).contains("Séjour proche sans lien");

        JsonNode entree = envoyer("POST", "/api/public/sejours/connexion", null,
                "{\"email\":\"%s\",\"code\":\"%s\"}".formatted(email, extraire(code.corps(), "(\\d{6})")), 200);
        assertThat(entree.get("sejour").asText()).isEqualTo(lienProche);
        String jetonLeo = entree.get("jeton").asText();
        assertThat(envoyer("GET", "/api/public/sejour/" + lienProche + "/moi", jetonLeo, null, 200)
                .get("sejour").get("nom").asText()).isEqualTo("Séjour proche sans lien");

        envoyer("DELETE", "/api/sorties/" + proche, dt, null, 204);
        envoyer("DELETE", "/api/sorties/" + loin, dt, null, 204);
    }

    @Test
    @DisplayName("Sans le lien, un mauvais code reçoit la même réponse que l'e-mail soit celui d'un participant ou non")
    void mauvaisCodeSansIndice() throws Exception {
        String dt = jeton("e3@club.fr");
        String email = "lou.sanslien@exemple.fr";
        long sortie = sejourAvecInvite(dt, "Séjour du mauvais code", 330, email);
        envoyer("POST", "/api/public/sejours/code", null, "{\"email\":\"%s\"}".formatted(email), 204);
        String bon = extraire(pour(email).getLast().corps(), "(\\d{6})");
        String faux = bon.equals("000000") ? "111111" : "000000";

        String participant = envoyer("POST", "/api/public/sejours/connexion", null,
                "{\"email\":\"%s\",\"code\":\"%s\"}".formatted(email, faux), 422).get("detail").asText();
        String inconnu = envoyer("POST", "/api/public/sejours/connexion", null,
                "{\"email\":\"inconnu.sanslien@exemple.fr\",\"code\":\"%s\"}".formatted(faux), 422).get("detail").asText();
        assertThat(participant).isEqualTo(inconnu);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Sans le lien, la réponse ne dit pas qui participe : rien n'est envoyé à un inconnu ni à un encadrant")
    void inconnuOuEncadrant() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(310);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour des encadrants sans lien","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(2)), 201).get("id").asLong();
        long flora = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
        }
        envoyer("POST", "/api/sejours/" + sortie + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora), 200);
        envoyer("POST", "/api/sejours/" + sortie + "/invitations", dt, "{}", 200);
        int avant = pour("e2@club.fr").size();

        envoyer("POST", "/api/public/sejours/code", null, "{\"email\":\"e2@club.fr\"}", 204);
        envoyer("POST", "/api/public/sejours/code", null, "{\"email\":\"personne.sanslien@exemple.fr\"}", 204);
        assertThat(pour("e2@club.fr")).hasSize(avant);
        assertThat(pour("personne.sanslien@exemple.fr")).isEmpty();
        JsonNode refus = envoyer("POST", "/api/public/sejours/connexion", null,
                "{\"email\":\"personne.sanslien@exemple.fr\",\"code\":\"123456\"}", 422);
        assertThat(refus.get("detail").asText()).contains("Code incorrect ou expiré");

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
