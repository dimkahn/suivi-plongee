package fr.club.plongee;

import fr.club.plongee.sejour.TrombinoscopeSejourService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le trombinoscope d'un séjour : les participants avec leur groupe de
 * plongeurs, pour les encadrants seulement, et jamais une photo sans le
 * droit à l'image.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(FraisParticipantsTest.BoiteAuxLettres.class)
class TrombinoscopeSejourTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TrombinoscopeSejourService trombinoscope;

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 0};

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

    /** Le dernier courriel parti vers cette adresse (boîte de test de {@link FraisParticipantsTest}). */
    private String dernierPour(String adresse) {
        synchronized (FraisParticipantsTest.COURRIELS) {
            for (int i = FraisParticipantsTest.COURRIELS.size() - 1; i >= 0; i--) {
                var c = FraisParticipantsTest.COURRIELS.get(i);
                if (c.adresse().equals(adresse)) return c.corps();
            }
        }
        throw new AssertionError("Aucun courriel pour " + adresse);
    }

    private static String extraire(String texte, String motif) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }

    private JsonNode ligneDe(JsonNode trombinoscope, String prenom) {
        for (JsonNode l : trombinoscope) if (l.get("prenom").asText().equals(prenom)) return l;
        throw new AssertionError(prenom + " absent du trombinoscope");
    }

    private void autorisationImage(String admin, long eleve, boolean valeur) throws Exception {
        envoyer("PUT", "/api/eleves/" + eleve + "/autorisation-image", admin,
                "{\"autorisationImage\":" + valeur + "}", 200);
    }

    @Test
    @DisplayName("Un encadrant voit le trombinoscope du séjour par groupe de plongeurs, photo seulement avec le droit à l'image")
    void trombinoscopeParGroupe() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr");
        String marque = UUID.randomUUID().toString().substring(0, 8);

        // Un élève avec photo et droit à l'image, un autre sans droit à l'image.
        long lou = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Visage%s","prenom":"Lou","autorisationLegale":true}""".formatted(marque), 201)
                .get("id").asLong();
        autorisationImage(admin, lou, true);
        mvc.perform(multipart("/api/eleves/" + lou + "/photo")
                        .file(new MockMultipartFile("fichier", "lou.png", MediaType.IMAGE_PNG_VALUE, PNG))
                        .header("Authorization", admin))
                .andExpect(status().isNoContent());
        long noe = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Visage%s","prenom":"Noé","autorisationLegale":true}""".formatted(marque), 201)
                .get("id").asLong();

        JsonNode saison = null;
        for (JsonNode x : envoyer("GET", "/api/saisons", dt, null, 200)) if (x.get("ouverte").asBoolean()) saison = x;
        assertThat(saison).isNotNull();
        LocalDate debut = LocalDate.parse(saison.get("dateFin").asText()).minusDays(5);
        long groupe = envoyer("POST", "/api/groupes-plongeurs", dt, """
                {"nom":"Palmes %s","saisonId":%d,"membres":[
                  {"eleveId":%d,"nom":"Visage%s","prenom":"Lou","aptitude":"PE20"},
                  {"eleveId":%d,"nom":"Visage%s","prenom":"Noé","aptitude":"PE40"}]}"""
                .formatted(marque, saison.get("id").asLong(), lou, marque, noe, marque), 200).get("id").asLong();
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour trombinoscope","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(2)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants/groupe", dt, "{\"groupeId\":" + groupe + "}", 200);
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Accompagne%s","prenom":"Sam","plongeur":false}""".formatted(marque), 200);

        JsonNode trombinoscope = envoyer("GET", base + "/trombinoscope", jeton("e1@club.fr"), null, 200);
        assertThat(trombinoscope).hasSize(3);
        JsonNode ligneLou = ligneDe(trombinoscope, "Lou");
        assertThat(ligneLou.get("groupe").asText()).isEqualTo("Palmes " + marque);
        assertThat(ligneLou.get("aptitude").asText()).isEqualTo("PE20");
        assertThat(ligneLou.get("aPhoto").asBoolean()).isTrue();
        assertThat(ligneDe(trombinoscope, "Noé").get("aPhoto").asBoolean()).isFalse();
        JsonNode ligneSam = ligneDe(trombinoscope, "Sam");
        assertThat(ligneSam.get("groupe").isNull()).isTrue();
        assertThat(ligneSam.get("plongeur").asBoolean()).isFalse();

        String photoLou = base + "/participants/" + ligneLou.get("participantId").asLong() + "/photo";
        mvc.perform(get(photoLou).header("Authorization", dt))
                .andExpect(status().isOk()).andExpect(content().bytes(PNG));
        mvc.perform(get(base + "/participants/" + ligneSam.get("participantId").asLong() + "/photo")
                        .header("Authorization", dt))
                .andExpect(status().isNotFound());

        // Le droit à l'image retiré : plus de photo, ni signalée ni renvoyée.
        autorisationImage(admin, lou, false);
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Lou").get("aPhoto").asBoolean())
                .isFalse();
        mvc.perform(get(photoLou).header("Authorization", dt)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Le refus du droit à l'image dans le dossier élève l'emporte sur la photo du compte lié")
    void refusDuDossierEleveLEmporte() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr");
        String marque = UUID.randomUUID().toString().substring(0, 8);
        // Un moniteur stagiaire : compte avec photo et droit à l'image, dossier élève sans droit à l'image.
        long compte = envoyer("POST", "/api/admin/moniteurs", admin, """
                {"email":"stagiaire-%s@club.fr","nom":"Stagiaire%s","prenom":"Lina","niveauEncadrement":"E1"}"""
                .formatted(marque, marque), 201).get("id").asLong();
        envoyer("PUT", "/api/admin/moniteurs/" + compte + "/autorisation-image", admin, "{\"autorisationImage\":true}", 200);
        mvc.perform(multipart("/api/admin/moniteurs/" + compte + "/photo")
                        .file(new MockMultipartFile("fichier", "lina.png", MediaType.IMAGE_PNG_VALUE, PNG))
                        .header("Authorization", admin))
                .andExpect(status().isNoContent());
        long dossier = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Stagiaire%s","prenom":"Lina","autorisationLegale":true}""".formatted(marque), 201)
                .get("id").asLong();

        LocalDate debut = LocalDate.now().plusDays(160);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour du stagiaire","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(2)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long lina = envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"utilisateurId":%d,"nom":"Stagiaire%s","prenom":"Lina","plongeur":true}"""
                .formatted(dossier, compte, marque), 200).get("participants").get(0).get("id").asLong();

        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Lina").get("aPhoto").asBoolean())
                .isFalse();
        mvc.perform(get(base + "/participants/" + lina + "/photo").header("Authorization", dt))
                .andExpect(status().isNotFound());

        // Ni par un autre séjour, ni pour un séjour qui n'existe pas.
        long autre = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Autre séjour","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(1)), 201).get("id").asLong();
        envoyer("PUT", "/api/eleves/" + dossier + "/autorisation-image", admin, "{\"autorisationImage\":true}", 200);
        mvc.perform(get("/api/sejours/" + autre + "/participants/" + lina + "/photo").header("Authorization", dt))
                .andExpect(status().isNotFound());
        envoyer("GET", "/api/sejours/999999999/trombinoscope", dt, null, 404);
    }

    private long sejour(String dt, String nom, int dans) throws Exception {
        LocalDate debut = LocalDate.now().plusDays(dans);
        return envoyer("POST", "/api/sorties", dt, """
                {"nom":"%s","dateDebut":"%s","dateFin":"%s"}""".formatted(nom, debut, debut.plusDays(2)), 201)
                .get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions deposer(String url, String jeton, String accord)
            throws Exception {
        var requete = multipart(url).file(new MockMultipartFile("fichier", "invite.png", MediaType.IMAGE_PNG_VALUE, PNG))
                .header("Authorization", jeton);
        return mvc.perform(accord == null ? requete : requete.param("accord", accord));
    }

    @Test
    @DisplayName("Un organisateur ajoute la photo d'un invité, avec son accord, puis la retire")
    void photoDUnInvite() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = "/api/sejours/" + sejour(dt, "Séjour avec invité", 170);
        long sam = envoyer("POST", base + "/participants", dt, """
                {"nom":"Invité","prenom":"Sam","plongeur":true}""", 200).get("participants").get(0).get("id").asLong();
        String photo = base + "/participants/" + sam + "/photo";
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Sam").get("invite").asBoolean())
                .isTrue();

        deposer(photo, dt, "true").andExpect(status().isNoContent());
        JsonNode ligne = ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Sam");
        assertThat(ligne.get("aPhoto").asBoolean()).isTrue();
        // L'accord donné pour un invité vaut pour les participants du séjour.
        assertThat(ligne.get("visibleParticipants").asBoolean()).isTrue();
        mvc.perform(get(photo).header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isOk()).andExpect(content().bytes(PNG));

        mvc.perform(delete(photo).header("Authorization", dt)).andExpect(status().isNoContent());
        ligne = ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Sam");
        assertThat(ligne.get("aPhoto").asBoolean()).isFalse();
        assertThat(ligne.get("visibleParticipants").asBoolean()).isFalse();
        mvc.perform(get(photo).header("Authorization", dt)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Pas de photo d'invité sans son accord, ni pour qui a un dossier, ni par un encadrant qui n'organise pas")
    void photoDUnInviteRefusee() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr");
        String base = "/api/sejours/" + sejour(dt, "Séjour sans accord", 175);
        long sam = envoyer("POST", base + "/participants", dt, """
                {"nom":"Invité","prenom":"Sam","plongeur":true}""", 200).get("participants").get(0).get("id").asLong();
        String photo = base + "/participants/" + sam + "/photo";

        String detail = deposer(photo, dt, null).andExpect(status().isUnprocessableEntity())
                .andReturn().getResponse().getContentAsString();
        assertThat(detail).contains("accord");
        deposer(photo, dt, "false").andExpect(status().isUnprocessableEntity());
        deposer(photo, jeton("e1@club.fr"), "true").andExpect(status().isForbidden());
        deposer(photo, admin, "true").andExpect(status().isForbidden());

        // Un élève du club : sa photo se dépose dans son dossier, pas dans le séjour.
        long eleve = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Dossier%s","prenom":"Eva","autorisationLegale":true}"""
                .formatted(UUID.randomUUID().toString().substring(0, 8)), 201).get("id").asLong();
        JsonNode s = envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Dossier","prenom":"Eva","plongeur":true}""".formatted(eleve), 200);
        long eva = 0;
        for (JsonNode p : s.get("participants")) if (p.get("prenom").asText().equals("Eva")) eva = p.get("id").asLong();
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Eva").get("invite").asBoolean())
                .isFalse();
        String refus = deposer(base + "/participants/" + eva + "/photo", dt, "true")
                .andExpect(status().isUnprocessableEntity()).andReturn().getResponse().getContentAsString();
        assertThat(refus).contains("dossier").doesNotContain("Eva");
    }

    @Test
    @DisplayName("La photo d'un invité est supprimée dès qu'il est lié à un dossier élève, directement ou par son groupe")
    void photoDUnInviteSupprimeeQuandIlEstLie() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr");
        String marque = UUID.randomUUID().toString().substring(0, 8);
        long dossier = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Lie%s","prenom":"Tom","autorisationLegale":true}""".formatted(marque), 201).get("id").asLong();
        String base = "/api/sejours/" + sejour(dt, "Séjour lié au dossier", 185);

        // Lié directement à son dossier, puis délié : la photo du séjour ne revient pas.
        long tom = envoyer("POST", base + "/participants", dt, """
                {"nom":"Lie%s","prenom":"Tom","plongeur":true}""".formatted(marque), 200)
                .get("participants").get(0).get("id").asLong();
        deposer(base + "/participants/" + tom + "/photo", dt, "true").andExpect(status().isNoContent());
        envoyer("PUT", base + "/participants/" + tom, dt, """
                {"eleveId":%d,"nom":"Lie%s","prenom":"Tom","plongeur":true}""".formatted(dossier, marque), 200);
        envoyer("PUT", base + "/participants/" + tom, dt, """
                {"nom":"Lie%s","prenom":"Tom","plongeur":true}""".formatted(marque), 200);
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Tom").get("aPhoto").asBoolean())
                .isFalse();

        // Lié à un plongeur de groupe qui a un dossier : ce n'est plus un invité.
        JsonNode saison = null;
        for (JsonNode x : envoyer("GET", "/api/saisons", dt, null, 200)) if (x.get("ouverte").asBoolean()) saison = x;
        String base2 = "/api/sejours/" + envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour lié au groupe","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(LocalDate.parse(saison.get("dateFin").asText()).minusDays(4),
                        LocalDate.parse(saison.get("dateFin").asText()).minusDays(2)), 201).get("id").asLong();
        long membre = envoyer("POST", "/api/groupes-plongeurs", dt, """
                {"nom":"Groupe %s","saisonId":%d,"membres":[{"eleveId":%d,"nom":"Lie%s","prenom":"Tom"}]}"""
                .formatted(marque, saison.get("id").asLong(), dossier, marque), 200)
                .get("membres").get(0).get("id").asLong();
        long tom2 = envoyer("POST", base2 + "/participants", dt, """
                {"nom":"Lie%s","prenom":"Tom","plongeur":true}""".formatted(marque), 200)
                .get("participants").get(0).get("id").asLong();
        deposer(base2 + "/participants/" + tom2 + "/photo", dt, "true").andExpect(status().isNoContent());
        envoyer("PUT", base2 + "/participants/" + tom2, dt, """
                {"nom":"Lie%s","prenom":"Tom","plongeur":true,"membreGroupeId":%d}""".formatted(marque, membre), 200);
        JsonNode ligne = ligneDe(envoyer("GET", base2 + "/trombinoscope", dt, null, 200), "Tom");
        assertThat(ligne.get("invite").asBoolean()).isFalse();
        assertThat(ligne.get("aPhoto").asBoolean()).isFalse();
        deposer(base2 + "/participants/" + tom2 + "/photo", dt, "true").andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("La photo d'un invité est effacée le lendemain de la fin du séjour")
    void photoDUnInviteEffaceeApresLeSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = "/api/sejours/" + sejour(dt, "Séjour qui finit", 180);
        long sam = envoyer("POST", base + "/participants", dt, """
                {"nom":"Invité","prenom":"Sam","plongeur":true}""", 200).get("participants").get(0).get("id").asLong();
        deposer(base + "/participants/" + sam + "/photo", dt, "true").andExpect(status().isNoContent());
        LocalDate fin = LocalDate.now().plusDays(182);

        trombinoscope.effacerApresLeSejour(fin);
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Sam").get("aPhoto").asBoolean())
                .isTrue();
        trombinoscope.effacerApresLeSejour(fin.plusDays(1));
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Sam").get("aPhoto").asBoolean())
                .isFalse();
    }

    private long participant(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p.get("id").asLong();
        throw new AssertionError(prenom + " absent du séjour");
    }

    private long eleveAvecPhoto(String admin, String prenom, String marque) throws Exception {
        long id = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Vu%s","prenom":"%s","autorisationLegale":true}""".formatted(marque, prenom), 201)
                .get("id").asLong();
        autorisationImage(admin, id, true);
        mvc.perform(multipart("/api/eleves/" + id + "/photo")
                        .file(new MockMultipartFile("fichier", "p.png", MediaType.IMAGE_PNG_VALUE, PNG))
                        .header("Authorization", admin))
                .andExpect(status().isNoContent());
        return id;
    }

    private JsonNode parLien(String methode, String url, String jetonLien, String corps, int attendu) throws Exception {
        var requete = "PUT".equals(methode) ? put(url) : "POST".equals(methode) ? post(url) : get(url);
        if (jetonLien != null) requete = requete.header("X-Jeton-Sejour", jetonLien);
        String reponse = mvc.perform(requete.contentType(MediaType.APPLICATION_JSON).content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    @Test
    @DisplayName("Tous les participants voient le trombinoscope, avec les seules photos qu'un organisateur a rendues visibles")
    void trombinoscopeDesParticipants() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr"), camille = jeton("eleve@club.fr");
        String marque = UUID.randomUUID().toString().substring(0, 8);
        long lou = eleveAvecPhoto(admin, "Lou", marque), noe = eleveAvecPhoto(admin, "Noé", marque);
        long dossierCamille = 0;
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) dossierCamille = p.get("eleveId").asLong();
        }
        String base = "/api/sejours/" + sejour(dt, "Séjour partagé", 190);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Vu%s","prenom":"Lou","plongeur":true}""".formatted(lou, marque), 200);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Vu%s","prenom":"Noé","plongeur":true}""".formatted(noe, marque), 200);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(dossierCamille), 200);
        JsonNode s = envoyer("POST", base + "/participants", dt, """
                {"nom":"Invité","prenom":"Paul","plongeur":false,"email":"paul-%s@club.fr"}""".formatted(marque), 200);
        long pLou = participant(s, "Lou"), pNoe = participant(s, "Noé");

        // Avant tout accord, Camille voit les noms, aucune photo.
        JsonNode vu = envoyer("GET", base + "/trombinoscope", camille, null, 200);
        assertThat(vu).hasSize(4);
        assertThat(ligneDe(vu, "Lou").get("aPhoto").asBoolean()).isFalse();
        assertThat(ligneDe(vu, "Lou").get("invite").asBoolean()).isFalse();

        // Montrer la photo de Lou aux participants : l'accord est exigé, et seul un organisateur le fait.
        String visible = base + "/participants/" + pLou + "/photo-visible";
        assertThat(envoyer("PUT", visible, dt, "{\"visible\":true}", 422).get("detail").asText()).contains("accord");
        envoyer("PUT", visible, jeton("e1@club.fr"), "{\"visible\":true,\"accord\":true}", 403);
        envoyer("PUT", visible, dt, "{\"visible\":true,\"accord\":true}", 204);

        vu = envoyer("GET", base + "/trombinoscope", camille, null, 200);
        assertThat(ligneDe(vu, "Lou").get("aPhoto").asBoolean()).isTrue();
        assertThat(ligneDe(vu, "Noé").get("aPhoto").asBoolean()).isFalse();
        mvc.perform(get(base + "/participants/" + pLou + "/photo").header("Authorization", camille))
                .andExpect(status().isOk()).andExpect(content().bytes(PNG));
        mvc.perform(get(base + "/participants/" + pNoe + "/photo").header("Authorization", camille))
                .andExpect(status().isNotFound());

        // Les encadrants voient toujours tout ; « comme un participant », ce que voit Camille.
        JsonNode encadrant = envoyer("GET", base + "/trombinoscope", jeton("e1@club.fr"), null, 200);
        assertThat(ligneDe(encadrant, "Noé").get("aPhoto").asBoolean()).isTrue();
        assertThat(ligneDe(encadrant, "Lou").get("visibleParticipants").asBoolean()).isTrue();
        assertThat(ligneDe(encadrant, "Noé").get("visibleParticipants").asBoolean()).isFalse();
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope?commeParticipant=true", dt, null, 200), "Noé")
                .get("aPhoto").asBoolean()).isFalse();

        // Paul, invité, par le lien et le code reçus par e-mail.
        envoyer("POST", base + "/invitations", dt, "{\"participantIds\":[%d]}".formatted(participant(s, "Paul")), 200);
        String courriel = dernierPour("paul-" + marque + "@club.fr");
        String pub = "/api/public/sejour/" + extraire(courriel, "/sejour/([A-Za-z0-9_-]+)");
        parLien("POST", pub + "/code", null, "{\"email\":\"paul-%s@club.fr\"}".formatted(marque), 204);
        String chiffres = extraire(dernierPour("paul-" + marque + "@club.fr"), "(\\d{6})");
        String jetonPaul = parLien("POST", pub + "/connexion", null,
                "{\"email\":\"paul-%s@club.fr\",\"code\":\"%s\"}".formatted(marque, chiffres), 200).get("jeton").asText();
        JsonNode parLeLien = parLien("GET", pub + "/trombinoscope", jetonPaul, null, 200);
        assertThat(ligneDe(parLeLien, "Lou").get("aPhoto").asBoolean()).isTrue();
        assertThat(ligneDe(parLeLien, "Noé").get("aPhoto").asBoolean()).isFalse();
        mvc.perform(get(pub + "/trombinoscope/" + pLou + "/photo").header("X-Jeton-Sejour", jetonPaul))
                .andExpect(status().isOk());
        mvc.perform(get(pub + "/trombinoscope/" + pNoe + "/photo").header("X-Jeton-Sejour", jetonPaul))
                .andExpect(status().isNotFound());
        parLien("GET", pub + "/trombinoscope", null, null, 403);

        // L'organisateur ne la montre plus : elle disparaît pour les participants.
        envoyer("PUT", visible, dt, "{\"visible\":false}", 204);
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", camille, null, 200), "Lou").get("aPhoto").asBoolean())
                .isFalse();
    }

    @Test
    @DisplayName("Rattacher un participant à un autre dossier retire sa photo de la vue des participants")
    void rattacherAilleursRetireLAccord() throws Exception {
        String dt = jeton("e3@club.fr"), admin = jeton("presidente@club.fr"), camille = jeton("eleve@club.fr");
        String marque = UUID.randomUUID().toString().substring(0, 8);
        long lou = eleveAvecPhoto(admin, "Lou", marque), zoe = eleveAvecPhoto(admin, "Zoé", marque);
        long dossierCamille = 0;
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) dossierCamille = p.get("eleveId").asLong();
        }
        String base = "/api/sejours/" + sejour(dt, "Séjour rattaché", 195);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(dossierCamille), 200);
        long pLou = participant(envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Vu%s","prenom":"Lou","plongeur":true}""".formatted(lou, marque), 200), "Lou");
        envoyer("PUT", base + "/participants/" + pLou + "/photo-visible", dt, "{\"visible\":true,\"accord\":true}", 204);

        // La ligne est corrigée : c'était Zoé. Son accord à elle n'a pas été donné.
        envoyer("PUT", base + "/participants/" + pLou, dt, """
                {"eleveId":%d,"nom":"Vu%s","prenom":"Zoé","plongeur":true}""".formatted(zoe, marque), 200);
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", camille, null, 200), "Zoé").get("aPhoto").asBoolean())
                .isFalse();
        mvc.perform(get(base + "/participants/" + pLou + "/photo").header("Authorization", camille))
                .andExpect(status().isNotFound());
        assertThat(ligneDe(envoyer("GET", base + "/trombinoscope", dt, null, 200), "Zoé")
                .get("visibleParticipants").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("Un élève qui ne participe pas au séjour ne voit ni son trombinoscope ni les photos")
    void eleveRefuse() throws Exception {
        String dt = jeton("e3@club.fr"), eleve = jeton("eleve@club.fr");
        LocalDate debut = LocalDate.now().plusDays(150);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour sans trombinoscope","dateDebut":"%s","dateFin":"%s"}"""
                .formatted(debut, debut.plusDays(2)), 201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long participant = envoyer("POST", base + "/participants", dt, """
                {"nom":"Inconnu","prenom":"Max","plongeur":true}""", 200).get("participants").get(0).get("id").asLong();

        envoyer("GET", base + "/trombinoscope", eleve, null, 403);
        envoyer("GET", base + "/participants/" + participant + "/photo", eleve, null, 403);
    }
}
