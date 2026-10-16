package fr.club.plongee;

import fr.club.plongee.notification.service.ServiceNotification;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.sejour.LecteurNote;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lecture du montant total et de la date sur la photo d'une note, pour
 * pré-remplir une dépense. Le service de lecture est remplacé par un faux
 * (pas de réseau en test), qu'on allume ou éteint comme le ferait la clé
 * d'accès d'une installation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(LectureNoteTest.FauxLecteur.class)
class LectureNoteTest {

    static volatile boolean lecteurActif = true;

    /** Le dernier courriel parti vers chaque adresse, pour y lire le lien et le code. */
    static final Map<String, String> COURRIELS = new ConcurrentHashMap<>();

    @TestConfiguration
    static class FauxLecteur {
        @Bean @Primary
        ServiceNotification notificationDeTest() {
            return new ServiceNotification() {
                @Override public void envoyerLienReinitialisation(Utilisateur u, String jeton) {}
                @Override public void envoyerLienInvitation(Utilisateur u, String jeton) {}
                @Override public boolean envoyerCourriel(String adresse, String sujet, String corps) {
                    COURRIELS.put(adresse, corps);
                    return true;
                }
            };
        }

        @Bean @Primary
        LecteurNote lecteurNoteDeTest() {
            return new LecteurNote() {
                @Override public boolean actif() { return lecteurActif; }
                @Override public NoteLue lire(byte[] image, String type) {
                    return new NoteLue(4580L, LocalDate.of(2027, 6, 12));
                }
            };
        }
    }

    /** Une image PNG minimale : la signature suffit au contrôle du serveur. */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @AfterEach
    void rallumer() {
        lecteurActif = true;
    }

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = methode.equals("POST") ? post(url) : get(url);
        String reponse = mvc.perform(requete.header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private JsonNode lireNote(String base, String jeton, int attendu) throws Exception {
        String reponse = mvc.perform(multipart(base + "/depenses/lecture-note")
                        .file(new MockMultipartFile("fichier", "note.png", "image/png", PNG))
                        .header("Authorization", jeton))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    /** Un séjour où Flora (e2, moniteur) et Camille (élève, eleve@club.fr) sont inscrites. */
    private String sejour() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(270);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour notes","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long flora = 0, camille = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
            if (c.get("prenom").asText().equals("Camille") && c.hasNonNull("eleveId")) camille = c.get("eleveId").asLong();
        }
        envoyer("POST", base + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora), 200);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(camille), 200);
        return base;
    }

    @Test
    @DisplayName("Un moniteur du séjour fait lire le montant total et la date sur la photo de la note")
    void unMoniteurDuSejourFaitLireLaNote() throws Exception {
        String base = sejour();
        String e2 = jeton("e2@club.fr");

        assertThat(envoyer("GET", base, e2, null, 200).get("frais").get("droits").get("lireNotes").asBoolean())
                .isTrue();
        JsonNode lue = lireNote(base, e2, 200);
        assertThat(lue.get("montantCentimes").asLong()).isEqualTo(4580);
        assertThat(lue.get("jour").asText()).isEqualTo("2027-06-12");
    }

    @Test
    @DisplayName("Qui ne peut pas saisir de dépense ne fait pas lire de note : élève, encadrant hors du séjour")
    void quiNeSaisitPasNeFaitPasLire() throws Exception {
        String base = sejour();
        String eleve = jeton("eleve@club.fr");

        assertThat(envoyer("GET", base, eleve, null, 200).get("frais").get("droits").get("lireNotes").asBoolean())
                .isFalse();
        assertThat(lireNote(base, eleve, 422).get("detail").asText()).contains("passent par un moniteur");
        lireNote(base, jeton("e1@club.fr"), 422);
    }

    @Test
    @DisplayName("Un invité entré par le lien et le code fait lire sa note ; sans connexion, refus")
    void unInviteParLienFaitLireSaNote() throws Exception {
        String base = sejour();
        String dt = jeton("e3@club.fr");
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Invité","prenom":"Hugo","plongeur":false,"email":"hugo.note@exemple.fr"}""", 200);
        envoyer("POST", base + "/invitations", dt, null, 200);
        Matcher lien = Pattern.compile("/sejour/([A-Za-z0-9_-]+)").matcher(COURRIELS.get("hugo.note@exemple.fr"));
        assertThat(lien.find()).isTrue();
        String pub = "/api/public/sejour/" + lien.group(1);
        mvc.perform(post(pub + "/code").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"hugo.note@exemple.fr\"}")).andExpect(status().isNoContent());
        Matcher code = Pattern.compile("(\\d{6})").matcher(COURRIELS.get("hugo.note@exemple.fr"));
        assertThat(code.find()).isTrue();
        String jetonHugo = json.readTree(mvc.perform(post(pub + "/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"hugo.note@exemple.fr\",\"code\":\"%s\"}".formatted(code.group(1))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("jeton").asText();

        var photo = new MockMultipartFile("fichier", "note.png", "image/png", PNG);
        String lue = mvc.perform(multipart(pub + "/depenses/lecture-note").file(photo).header("X-Jeton-Sejour", jetonHugo))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(lue).get("montantCentimes").asLong()).isEqualTo(4580);
        mvc.perform(multipart(pub + "/depenses/lecture-note").file(photo)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Sans service de lecture réglé pour l'installation, rien n'est proposé et la demande est refusée")
    void sansServiceDeLectureRienNEstPropose() throws Exception {
        String base = sejour();
        String e2 = jeton("e2@club.fr");
        lecteurActif = false;

        assertThat(envoyer("GET", base, e2, null, 200).get("frais").get("droits").get("lireNotes").asBoolean())
                .isFalse();
        assertThat(lireNote(base, e2, 422).get("detail").asText()).contains("pas activée");
    }
}
