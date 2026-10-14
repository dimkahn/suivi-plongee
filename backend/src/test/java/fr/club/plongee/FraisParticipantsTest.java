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
import org.springframework.mock.web.MockMultipartFile;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Les frais saisis par les participants : moniteur du séjour, élève qui
 * passe par lui, invité sans compte entré par le lien et le code reçu par
 * e-mail, photos des notes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(FraisParticipantsTest.BoiteAuxLettres.class)
class FraisParticipantsTest {

    /** Les courriels partis, pour y lire le lien et le code. */
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

    /** Une image PNG minimale : la signature suffit au contrôle du serveur. */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

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
            case "PUT" -> put(url);
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

    private long ajouter(String base, String dt, String corps) throws Exception {
        JsonNode s = envoyer("POST", base + "/participants", dt, corps, 200);
        long max = 0;
        for (JsonNode p : s.get("participants")) max = Math.max(max, p.get("id").asLong());
        return max;
    }

    private Courriel dernierPour(String adresse) {
        synchronized (COURRIELS) {
            for (int i = COURRIELS.size() - 1; i >= 0; i--) {
                if (COURRIELS.get(i).adresse().equals(adresse)) return COURRIELS.get(i);
            }
        }
        throw new AssertionError("Aucun courriel pour " + adresse);
    }

    private static String extraire(String texte, String motif) {
        Matcher m = Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }

    private String depense(String libelle, long payeur, long... parts) {
        StringBuilder p = new StringBuilder();
        for (long id : parts) p.append(p.isEmpty() ? "" : ",").append("{\"participantId\":%d,\"parts\":1}".formatted(id));
        return """
               {"libelle":"%s","categorie":"REPAS","montantCentimes":4000,"payeurId":%d,"parts":[%s]}"""
                .formatted(libelle, payeur, p);
    }

    @Test
    @DisplayName("Moniteur du séjour, élève, invité par lien et code : chacun ses droits sur les frais")
    void fraisDesParticipants() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(260);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour frais","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;

        long flora = 0, camille = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
            if (c.get("prenom").asText().equals("Camille") && c.hasNonNull("eleveId")) camille = c.get("eleveId").asLong();
        }
        long pFlora = ajouter(base, dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora));
        long pCamille = ajouter(base, dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true,
                 "email":"camille.sejour@exemple.fr"}""".formatted(camille));
        long pPaul = ajouter(base, dt, """
                {"nom":"Invité","prenom":"Paul","plongeur":false,"email":"paul@exemple.fr"}""");
        long pLina = ajouter(base, dt, """
                {"eleveId":null,"nom":"Sanscompte","prenom":"Lina","plongeur":true,"email":"Lina@Exemple.fr"}""");

        // Flora, moniteur inscrite au séjour, saisit la note de Camille (élève) : c'est par elle que ça passe.
        String e2 = jeton("e2@club.fr");
        JsonNode creee = envoyer("POST", base + "/depenses", e2, depense("Glaces", pCamille, pCamille, pFlora), 200);
        long glaces = creee.get("depenseId").asLong();
        assertThat(creee.get("sejour").get("frais").get("droits").get("depensesModifiables").toString())
                .contains(String.valueOf(glaces));
        // Camille elle-même ne saisit rien ; un moniteur hors du séjour non plus.
        JsonNode refus = envoyer("POST", base + "/depenses", jeton("eleve@club.fr"),
                depense("Bonbons", pCamille, pCamille), 422);
        assertThat(refus.get("detail").asText()).contains("passent par un moniteur");
        envoyer("POST", base + "/depenses", jeton("e1@club.fr"), depense("Café", pFlora, pFlora), 422);

        // Photo de la note, ajoutée par celle qui a saisi la dépense, lue par l'élève.
        mvc.perform(multipart(base + "/depenses/" + glaces + "/photos")
                        .file(new MockMultipartFile("fichier", "note.png", "image/png", PNG))
                        .header("Authorization", e2))
                .andExpect(status().isOk());
        JsonNode lu = envoyer("GET", base, jeton("eleve@club.fr"), null, 200);
        long photo = lu.get("frais").get("depenses").get(0).get("photos").get(0).asLong();
        mvc.perform(get(base + "/depenses/" + glaces + "/photos/" + photo).header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", "image/png"));

        // L'organisateur demande à chacun ses informations : la moniteur dans l'appli, les autres par le lien.
        JsonNode bilan = envoyer("POST", base + "/invitations", dt, null, 200);
        assertThat(bilan.get("envoyes").toString()).contains("Paul Invité").contains("Lina Sanscompte")
                .contains("Flora Vasseur").contains("Camille Berthier");
        String courrielFlora = dernierPour("e2@club.fr").corps();
        assertThat(courrielFlora).contains("/sejours/" + sortie).doesNotContain("/sejour/");
        String code = extraire(dernierPour("paul@exemple.fr").corps(), "/sejour/([A-Za-z0-9_-]+)");
        assertThat(dernierPour("camille.sejour@exemple.fr").corps()).contains("/sejour/" + code);
        String pub = "/api/public/sejour/" + code;
        assertThat(envoyer("GET", pub, null, null, 200).get("nom").asText()).isEqualTo("Séjour frais");

        // Flora est moniteur : elle n'entre pas par le lien (aucun code envoyé), elle a l'appli.
        int avantFlora = COURRIELS.size();
        envoyer("POST", pub + "/code", null, "{\"email\":\"e2@club.fr\"}", 204);
        assertThat(COURRIELS).hasSize(avantFlora);

        // Un e-mail inconnu : même réponse, et aucun courriel.
        int avant = COURRIELS.size();
        envoyer("POST", pub + "/code", null, "{\"email\":\"inconnu@exemple.fr\"}", 204);
        assertThat(COURRIELS).hasSize(avant);

        // Paul demande son code, se trompe, puis entre.
        envoyer("POST", pub + "/code", null, "{\"email\":\"Paul@exemple.fr \"}", 204);
        String chiffres = extraire(dernierPour("paul@exemple.fr").corps(), "(\\d{6})");
        String faux = chiffres.equals("000000") ? "111111" : "000000";
        envoyer("POST", pub + "/connexion", null, "{\"email\":\"paul@exemple.fr\",\"code\":\"%s\"}".formatted(faux), 422);
        String jetonPaul = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"paul@exemple.fr\",\"code\":\"%s\"}".formatted(chiffres), 200).get("jeton").asText();
        // Le code ne sert qu'une fois.
        envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"paul@exemple.fr\",\"code\":\"%s\"}".formatted(chiffres), 422);

        JsonNode vuePaul = envoyer("GET", pub + "/frais", jetonPaul, null, 200);
        assertThat(vuePaul.get("moi").get("id").asLong()).isEqualTo(pPaul);
        assertThat(vuePaul.get("frais").get("droits").get("peutAjouter").asBoolean()).isTrue();
        assertThat(vuePaul.get("frais").get("depenses")).hasSize(1);

        // Paul renseigne ses informations : son vol, son régime ; un départ avant l'arrivée est refusé.
        assertThat(envoyer("GET", pub + "/moi", jetonPaul, null, 200).get("moi").get("prenom").asText())
                .isEqualTo("Paul");
        envoyer("PUT", pub + "/moi", jetonPaul, """
                {"arrivee":{"date":"%s"},"depart":{"date":"%s"}}""".formatted(debut.plusDays(2), debut), 422);
        JsonNode infos = envoyer("PUT", pub + "/moi", jetonPaul, """
                {"telephone":"0612345678","regimes":["VEGETARIEN"],"urgenceNom":"Marie","urgenceTelephone":"0600000001",
                 "arrivee":{"date":"%s","heure":"10:35","transport":"AVION","numero":"AF7520","lieu":"Toulon",
                            "heureDepart":"09:05","lieuDepart":"Paris-Orly"}}"""
                .formatted(debut), 200);
        assertThat(infos.get("moi").get("arrivee").get("numero").asText()).isEqualTo("AF7520");
        assertThat(infos.get("moi").get("arrivee").get("lieuDepart").asText()).isEqualTo("Paris-Orly");
        // Avec le programme du séjour, pour son encart « Aujourd'hui ».
        assertThat(infos.get("programme").has("evenements")).isTrue();
        assertThat(infos.get("programme").get("plongees").isArray()).isTrue();
        // L'organisateur le voit ; le nom n'a pas changé.
        JsonNode vuDt = envoyer("GET", base, dt, null, 200);
        for (JsonNode p : vuDt.get("participants")) {
            if (p.get("id").asLong() == pPaul) {
                assertThat(p.get("regimes").toString()).contains("VEGETARIEN");
                assertThat(p.get("nom").asText()).isEqualTo("Invité");
                assertThat(p.get("email").asText()).isEqualTo("paul@exemple.fr");
            }
        }

        // Paul saisit ce qu'il a payé, avec la photo ; pas pour un autre, ni la dépense de Flora.
        envoyer("POST", pub + "/depenses", jetonPaul, depense("Pain", pFlora, pPaul), 422);
        long pain = envoyer("POST", pub + "/depenses", jetonPaul, depense("Pain", pPaul, pPaul, pFlora), 200)
                .get("depenseId").asLong();
        mvc.perform(multipart(pub + "/depenses/" + pain + "/photos")
                        .file(new MockMultipartFile("fichier", "pain.png", "image/png", PNG))
                        .header("X-Jeton-Sejour", jetonPaul))
                .andExpect(status().isOk());
        envoyer("DELETE", pub + "/depenses/" + glaces, jetonPaul, null, 422);
        // Flora lui rembourse sa part ; Paul note le remboursement reçu.
        envoyer("POST", pub + "/versements", jetonPaul,
                "{\"deId\":%d,\"aId\":%d,\"montantCentimes\":2000}".formatted(pFlora, pPaul), 200);

        // Sans jeton, ou avec un faux : refusé.
        envoyer("GET", pub + "/frais", null, null, 403);
        envoyer("GET", pub + "/frais", "faux-jeton", null, 403);

        // Lina, invitée : l'e-mail est reconnu sans tenir compte de la casse.
        envoyer("POST", pub + "/code", null, "{\"email\":\"lina@exemple.fr\"}", 204);
        String codeLina = extraire(dernierPour("Lina@Exemple.fr").corps(), "(\\d{6})");
        String jetonLina = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"lina@exemple.fr\",\"code\":\"%s\"}".formatted(codeLina), 200).get("jeton").asText();
        assertThat(envoyer("GET", pub + "/frais", jetonLina, null, 200).get("frais").get("depenses")).hasSize(2);

        // Anis, élève sans compte : il entre par le lien pour lire, mais passe par un moniteur pour saisir.
        long anis = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Anis") && c.hasNonNull("eleveId")) anis = c.get("eleveId").asLong();
        }
        long pAnis = ajouter(base, dt, """
                {"eleveId":%d,"nom":"Dulac","prenom":"Anis","plongeur":true,"email":"anis.sejour@exemple.fr"}"""
                .formatted(anis));
        envoyer("POST", pub + "/code", null, "{\"email\":\"anis.sejour@exemple.fr\"}", 204);
        String codeAnis = extraire(dernierPour("anis.sejour@exemple.fr").corps(), "(\\d{6})");
        String jetonAnis = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"anis.sejour@exemple.fr\",\"code\":\"%s\"}".formatted(codeAnis), 200).get("jeton").asText();
        assertThat(envoyer("GET", pub + "/frais", jetonAnis, null, 200).get("frais").get("droits")
                .get("peutAjouter").asBoolean()).isFalse();
        envoyer("POST", pub + "/depenses", jetonAnis, depense("Glace", pAnis, pAnis), 422);

        // Se déconnecter supprime le jeton.
        envoyer("POST", pub + "/deconnexion", jetonLina, null, 204);
        envoyer("GET", pub + "/frais", jetonLina, null, 403);

        // Camille, élève avec un compte : elle entre aussi par le lien (pas moniteur), en lecture seule pour les frais.
        envoyer("POST", pub + "/code", null, "{\"email\":\"camille.sejour@exemple.fr\"}", 204);
        String codeCamille = extraire(dernierPour("camille.sejour@exemple.fr").corps(), "(\\d{6})");
        String jetonCamille = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"camille.sejour@exemple.fr\",\"code\":\"%s\"}".formatted(codeCamille), 200)
                .get("jeton").asText();
        assertThat(envoyer("GET", pub + "/frais", jetonCamille, null, 200).get("frais").get("droits")
                .get("peutAjouter").asBoolean()).isFalse();
        // Dans l'appli, elle complète aussi ses informations ; un moniteur hors du séjour ne le peut pas.
        envoyer("PUT", base + "/mes-informations", jeton("eleve@club.fr"), """
                {"regimes":["SANS_PORC"],"remarques":"Arrive avec ses parents"}""", 200);
        envoyer("PUT", base + "/mes-informations", jeton("e1@club.fr"), "{}", 422);

        // Une demande à un seul participant.
        envoyer("POST", base + "/invitations?participantId=" + pFlora, dt, null, 200);

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
