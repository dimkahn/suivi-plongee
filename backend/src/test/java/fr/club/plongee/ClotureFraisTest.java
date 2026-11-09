package fr.club.plongee;

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
import java.time.ZoneId;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La fin des comptes d'un séjour (demande du club, 2026) : l'organisateur
 * clôt les frais (plus aucune dépense ne change), envoie à chacun son
 * décompte par e-mail, et chacun envoie la preuve de son virement, que le
 * bénéficiaire ou un organisateur confirme.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(FraisParticipantsTest.BoiteAuxLettres.class)
class ClotureFraisTest {

    private static final byte[] PDF = "%PDF-1.4\n%fausse preuve\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
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

    /** La preuve d'un virement : le fichier, à qui (vide : au club) et combien. */
    private JsonNode preuve(String url, String jeton, Long aId, long centimes, byte[] contenu, String type, int attendu)
            throws Exception {
        var requete = multipart(url).file(new MockMultipartFile("fichier", "virement", type, contenu))
                .param("montantCentimes", String.valueOf(centimes));
        if (aId != null) requete.param("aId", String.valueOf(aId));
        requete.header(jeton.startsWith("Bearer ") ? "Authorization" : "X-Jeton-Sejour", jeton);
        String reponse = mvc.perform(requete).andExpect(status().is(attendu))
                .andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long ajouter(String base, String dt, String corps) throws Exception {
        JsonNode s = envoyer("POST", base + "/participants", dt, corps, 200);
        long max = 0;
        for (JsonNode p : s.get("participants")) max = Math.max(max, p.get("id").asLong());
        return max;
    }

    private static String depense(String libelle, long centimes, Long payeur, long... parts) {
        StringBuilder p = new StringBuilder();
        for (long id : parts) p.append(p.isEmpty() ? "" : ",").append("{\"participantId\":%d,\"parts\":1}".formatted(id));
        return """
               {"libelle":"%s","categorie":"HEBERGEMENT","montantCentimes":%d,"payeurId":%s,"parts":[%s]}"""
                .formatted(libelle, centimes, payeur, p);
    }

    private static String extraire(String texte, String motif) {
        Matcher m = Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }

    private FraisParticipantsTest.Courriel dernierPour(String adresse) {
        synchronized (FraisParticipantsTest.COURRIELS) {
            for (int i = FraisParticipantsTest.COURRIELS.size() - 1; i >= 0; i--) {
                if (FraisParticipantsTest.COURRIELS.get(i).adresse().equals(adresse)) {
                    return FraisParticipantsTest.COURRIELS.get(i);
                }
            }
        }
        throw new AssertionError("Aucun courriel pour " + adresse);
    }

    /** Un séjour du DT (e3) : Flora (moniteur, compte e2), Paul (invité) et Lina (invitée), chacun avec e-mail. */
    private record Sejour(String base, long flora, long paul, long lina) {}

    private Sejour sejour(String dt, String nom, String emailPaul, String emailLina) throws Exception {
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(270);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"%s","dateDebut":"%s","dateFin":"%s"}""".formatted(nom, debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long flora = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
        }
        long pFlora = ajouter(base, dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora));
        long pPaul = ajouter(base, dt, """
                {"nom":"Invité","prenom":"Paul","plongeur":false,"email":"%s"}""".formatted(emailPaul));
        long pLina = ajouter(base, dt, """
                {"nom":"Invitée","prenom":"Lina","plongeur":true,"email":"%s"}""".formatted(emailLina));
        return new Sejour(base, pFlora, pPaul, pLina);
    }

    /** L'adresse de l'API de la page du lien, et le jeton de l'invité. */
    private record Entree(String pub, String jeton) {}

    /** Le jeton du lien d'un invité : la demande d'informations, puis le code reçu par e-mail. */
    private Entree entrer(String dt, Sejour s, String email) throws Exception {
        envoyer("POST", s.base() + "/invitations", dt, null, 200);
        String code = extraire(dernierPour(email).corps(), "/sejour/([A-Za-z0-9_-]+)");
        String pub = "/api/public/sejour/" + code;
        envoyer("POST", pub + "/code", null, "{\"email\":\"%s\"}".formatted(email), 204);
        String chiffres = extraire(dernierPour(email).corps(), "(\\d{6})");
        return new Entree(pub, envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"%s\",\"code\":\"%s\"}".formatted(email, chiffres), 200).get("jeton").asText());
    }

    @Test
    @DisplayName("Frais clos : plus personne ne touche aux dépenses, organisateur compris, jusqu'à leur réouverture")
    void fraisClos() throws Exception {
        String dt = jeton("e3@club.fr"), flora = jeton("e2@club.fr");
        Sejour s = sejour(dt, "Séjour clos", "paul.clos@exemple.fr", "lina.clos@exemple.fr");
        long gite = envoyer("POST", s.base() + "/depenses", dt,
                depense("Gîte", 30000, s.flora(), s.flora(), s.paul(), s.lina()), 200).get("depenseId").asLong();

        // Un moniteur du séjour ne clôt pas : réservé aux organisateurs.
        envoyer("PUT", s.base() + "/frais/cloture", flora, "{\"clos\":true}", 403);
        JsonNode vue = envoyer("PUT", s.base() + "/frais/cloture", dt, "{\"clos\":true}", 200).get("frais");
        assertThat(vue.get("closLe").isNull()).isFalse();
        assertThat(vue.get("droits").get("peutAjouter").asBoolean()).isFalse();
        assertThat(vue.get("droits").get("depensesModifiables")).isEmpty();
        assertThat(vue.get("droits").get("clore").asBoolean()).isTrue();

        String refus = envoyer("POST", s.base() + "/depenses", dt,
                depense("Oubli", 1000, s.flora(), s.flora()), 422).get("detail").asText();
        assertThat(refus).contains("clos");
        envoyer("PUT", s.base() + "/depenses/" + gite, dt, depense("Gîte", 31000, s.flora(), s.flora()), 422);
        envoyer("DELETE", s.base() + "/depenses/" + gite, flora, null, 422);
        mvc.perform(multipart(s.base() + "/depenses/" + gite + "/photos")
                        .file(new MockMultipartFile("fichier", "note.png", "image/png", PNG))
                        .header("Authorization", dt))
                .andExpect(status().is(422));
        // Les remboursements restent possibles : c'est le but de la clôture.
        envoyer("POST", s.base() + "/versements", dt,
                "{\"deId\":%d,\"aId\":%d,\"montantCentimes\":10000}".formatted(s.paul(), s.flora()), 200);

        vue = envoyer("PUT", s.base() + "/frais/cloture", dt, "{\"clos\":false}", 200).get("frais");
        assertThat(vue.get("closLe").isNull()).isTrue();
        envoyer("PUT", s.base() + "/depenses/" + gite, dt,
                depense("Gîte", 31000, s.flora(), s.flora(), s.paul(), s.lina()), 200);
    }

    @Test
    @DisplayName("Frais clos, l'organisateur envoie à chacun son décompte : ses dépenses, sa part, à qui verser combien")
    void decompte() throws Exception {
        String dt = jeton("e3@club.fr");
        Sejour s = sejour(dt, "Séjour décompte", "paul.decompte@exemple.fr", "lina.decompte@exemple.fr");
        envoyer("POST", s.base() + "/depenses", dt,
                depense("Gîte", 30000, s.flora(), s.flora(), s.paul(), s.lina()), 200);
        envoyer("POST", s.base() + "/depenses", dt, depense("Bateau", 6000, null, s.paul(), s.lina()), 200);
        envoyer("POST", s.base() + "/depenses", dt, depense("Glaces", 1500, s.lina(), s.lina()), 200);

        // Pas avant la clôture : le montant pourrait encore changer. Pas par un moniteur qui n'organise pas.
        assertThat(envoyer("POST", s.base() + "/envoi-decompte", dt, null, 422).get("detail").asText())
                .contains("Clôturez");
        envoyer("PUT", s.base() + "/frais/cloture", dt, "{\"clos\":true}", 200);
        envoyer("POST", s.base() + "/envoi-decompte", jeton("e2@club.fr"), null, 403);

        JsonNode bilan = envoyer("POST", s.base() + "/envoi-decompte", dt, null, 200);
        assertThat(bilan.get("envoyes").toString()).contains("Paul Invité").contains("Lina Invitée")
                .contains("Flora Vasseur");
        String paul = dernierPour("paul.decompte@exemple.fr").corps();
        assertThat(paul).contains("Gîte").contains("300,00 €").contains("100,00 €")
                .contains("Bateau").contains("30,00 €")
                .contains("Votre part : 130,00 €")
                .contains("À verser à Flora Vasseur : 130,00 €")
                .doesNotContain("Glaces")
                .containsPattern("/sejour/[A-Za-z0-9_-]+");
        assertThat(dernierPour("paul.decompte@exemple.fr").sujet()).contains("Séjour décompte");
        // Lina doit au club et à Flora ; elle a payé ses glaces, qu'elle seule partage.
        assertThat(dernierPour("lina.decompte@exemple.fr").corps()).contains("Glaces")
                .contains("À verser au club : 60,00 €").contains("À verser à Flora Vasseur : 70,00 €");
        // Flora, encadrante, est attendue dans l'appli ; on lui doit de l'argent.
        String flora = dernierPour("e2@club.fr").corps();
        assertThat(flora).contains("/sejours/").contains("Paul Invité vous doit 130,00 €");
    }

    @Test
    @DisplayName("Un participant qui a envoyé une preuve de virement en attente ne se retire pas du séjour")
    void preuveEnAttenteRetientLeParticipant() throws Exception {
        String dt = jeton("e3@club.fr");
        Sejour s = sejour(dt, "Séjour retrait", "paul.retrait@exemple.fr", "lina.retrait@exemple.fr");
        Entree paul = entrer(dt, s, "paul.retrait@exemple.fr");
        preuve(paul.pub() + "/preuves-virement", paul.jeton(), s.flora(), 2000, PDF, "application/pdf", 200);
        assertThat(envoyer("DELETE", s.base() + "/participants/" + s.paul(), dt, null, 422).get("detail").asText())
                .contains("frais");
        envoyer("DELETE", s.base() + "/participants/" + s.lina(), dt, null, 200);
    }

    private static JsonNode preuveDe(JsonNode frais, long deId) {
        for (JsonNode p : frais.get("preuves")) if (p.get("deId").asLong() == deId) return p;
        throw new AssertionError("Pas de preuve de " + deId + " dans " + frais.get("preuves"));
    }

    private static long solde(JsonNode frais, Long participantId) {
        for (JsonNode s : frais.get("comptes").get("soldes")) {
            if (participantId == null ? s.get("participantId").isNull()
                    : s.get("participantId").asLong() == participantId) return s.get("soldeCentimes").asLong();
        }
        return 0;
    }

    @Test
    @DisplayName("La preuve d'un virement : lue par qui l'envoie, le bénéficiaire et les organisateurs ; confirmée, "
            + "elle note le remboursement")
    void preuveDeVirement() throws Exception {
        String dt = jeton("e3@club.fr"), flora = jeton("e2@club.fr");
        Sejour s = sejour(dt, "Séjour preuves", "paul.preuve@exemple.fr", "lina.preuve@exemple.fr");
        envoyer("POST", s.base() + "/depenses", dt,
                depense("Gîte", 30000, s.flora(), s.flora(), s.paul(), s.lina()), 200);
        envoyer("POST", s.base() + "/depenses", dt, depense("Bateau", 6000, null, s.paul(), s.lina()), 200);
        Entree entreePaul = entrer(dt, s, "paul.preuve@exemple.fr");
        String paul = entreePaul.jeton(), pub = entreePaul.pub();
        String lina = entrer(dt, s, "lina.preuve@exemple.fr").jeton();

        // Paul envoie la preuve de son virement à Flora : à confirmer, elle ne compte pas encore.
        preuve(pub + "/preuves-virement", paul, s.flora(), 10000, "du texte".getBytes(), "application/pdf", 422);
        JsonNode vue = preuve(pub + "/preuves-virement", paul, s.flora(), 10000, PDF, "application/pdf", 200).get("frais");
        JsonNode p = preuveDe(vue, s.paul());
        long preuveId = p.get("id").asLong();
        assertThat(p.get("versementId").isNull()).isTrue();
        assertThat(p.get("aId").asLong()).isEqualTo(s.flora());
        assertThat(solde(vue, s.paul())).isEqualTo(-13000);
        assertThat(vue.get("droits").get("preuvesConfirmables")).isEmpty();
        assertThat(vue.get("droits").get("preuvesRetirables").toString()).contains(String.valueOf(preuveId));

        // Lina ne la voit ni ne la lit ; un encadrant qui n'organise pas non plus : pour eux, elle n'existe pas.
        assertThat(envoyer("GET", pub + "/frais", lina, null, 200).get("frais").get("preuves")).isEmpty();
        mvc.perform(get(pub + "/preuves-virement/" + preuveId).header("X-Jeton-Sejour", lina))
                .andExpect(status().isNotFound());
        mvc.perform(get(s.base() + "/preuves-virement/" + preuveId).header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isNotFound());
        mvc.perform(get(pub + "/preuves-virement/" + preuveId).header("X-Jeton-Sejour", paul))
                .andExpect(status().isOk());

        // Paul ne confirme pas son propre virement ; Flora, qui le reçoit, le lit et le confirme.
        envoyer("POST", pub + "/preuves-virement/" + preuveId + "/confirmation", paul, null, 422);
        JsonNode vueFlora = envoyer("GET", s.base(), flora, null, 200).get("frais");
        assertThat(vueFlora.get("droits").get("preuvesConfirmables").toString()).contains(String.valueOf(preuveId));
        mvc.perform(get(s.base() + "/preuves-virement/" + preuveId).header("Authorization", flora))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Cache-Control", "no-store"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().bytes(PDF));
        vueFlora = envoyer("POST", s.base() + "/preuves-virement/" + preuveId + "/confirmation", flora, null, 200)
                .get("frais");
        assertThat(solde(vueFlora, s.paul())).isEqualTo(-3000);
        assertThat(preuveDe(vueFlora, s.paul()).get("versementId").isNull()).isFalse();
        envoyer("POST", s.base() + "/preuves-virement/" + preuveId + "/confirmation", flora, null, 422);

        // Lina paie le club : un moniteur du séjour qui n'organise pas ne la voit pas, l'organisateur la confirme.
        vue = preuve(pub + "/preuves-virement", lina, null, 3000, PNG, "image/png", 200).get("frais");
        long auClub = preuveDe(vue, s.lina()).get("id").asLong();
        envoyer("POST", s.base() + "/preuves-virement/" + auClub + "/confirmation", flora, null, 404);
        vue = envoyer("POST", s.base() + "/preuves-virement/" + auClub + "/confirmation", dt, null, 200).get("frais");
        assertThat(solde(vue, null)).isEqualTo(3000);

        // Une preuve refusée (montant faux) disparaît, sans rien noter.
        vue = preuve(pub + "/preuves-virement", lina, s.flora(), 99900, PNG, "image/png", 200).get("frais");
        long fausse = -1;
        for (JsonNode x : vue.get("preuves")) if (x.get("montantCentimes").asLong() == 99900) fausse = x.get("id").asLong();
        envoyer("DELETE", pub + "/preuves-virement/" + fausse, paul, null, 404);
        vue = envoyer("DELETE", s.base() + "/preuves-virement/" + fausse, flora, null, 200).get("frais");
        assertThat(vue.get("preuves").toString()).doesNotContain("99900");
        assertThat(solde(vue, s.lina())).isEqualTo(-10000);
    }
}
