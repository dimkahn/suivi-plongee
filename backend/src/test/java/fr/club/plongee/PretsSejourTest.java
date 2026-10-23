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
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le matériel emprunté au club, déclaré depuis le séjour par ceux qui l'ont
 * emprunté, comme les frais : dans l'appli, ou par le lien et le code reçus
 * par e-mail. Chaque déclaration est un vrai prêt du matériel, avec ses
 * contrôles (déjà prêté, échéances, désinfection des détendeurs).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(PretsSejourTest.BoiteAuxLettres.class)
class PretsSejourTest {

    record Courriel(String adresse, String corps) {}

    static final List<Courriel> COURRIELS = new ArrayList<>();

    @TestConfiguration
    static class BoiteAuxLettres {
        @Bean @Primary
        ServiceNotification notificationDeTest() {
            return new ServiceNotification() {
                @Override public void envoyerLienReinitialisation(Utilisateur u, String jeton) {}
                @Override public void envoyerLienInvitation(Utilisateur u, String jeton) {}
                @Override public boolean envoyerCourriel(String adresse, String sujet, String corps) {
                    synchronized (COURRIELS) { COURRIELS.add(new Courriel(adresse, corps)); }
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

    /** {@code jeton} : « Bearer … » pour un compte, sinon le jeton du lien (en-tête X-Jeton-Sejour). */
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

    private String dernierPour(String adresse) {
        synchronized (COURRIELS) {
            for (int i = COURRIELS.size() - 1; i >= 0; i--) {
                if (COURRIELS.get(i).adresse().equals(adresse)) return COURRIELS.get(i).corps();
            }
        }
        throw new AssertionError("Aucun courriel pour " + adresse);
    }

    private static String extraire(String texte, String motif) {
        Matcher m = Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }

    /** Le jeton du lien pour ce participant : code demandé, reçu par e-mail, puis connexion. */
    private String entrerParLeLien(String pub, String email) throws Exception {
        envoyer("POST", pub + "/code", null, "{\"email\":\"%s\"}".formatted(email), 204);
        String chiffres = extraire(dernierPour(email), "(\\d{6})");
        return envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"%s\",\"code\":\"%s\"}".formatted(email, chiffres), 200).get("jeton").asText();
    }

    private long creerEquipement(String dt, String type, String reference) throws Exception {
        return envoyer("POST", "/api/materiel/equipements", dt,
                "{\"type\":\"%s\",\"reference\":\"%s\",\"marque\":\"Aqualung\"}".formatted(type, reference), 201)
                .get("id").asLong();
    }

    private static String declaration(long participant, LocalDate jour, Boolean desinfecte, long... equipements) {
        StringBuilder ids = new StringBuilder();
        for (long id : equipements) ids.append(ids.isEmpty() ? "" : ",").append(id);
        return "{\"participantId\":%d,\"datePret\":\"%s\",\"equipementIds\":[%s]%s}".formatted(participant, jour, ids,
                desinfecte == null ? "" : ",\"detendeursDesinfectes\":" + desinfecte);
    }

    private static boolean contient(JsonNode liste, long id) {
        for (JsonNode n : liste) if (n.get("id").asLong() == id) return true;
        return false;
    }

    @Test
    @DisplayName("Chacun déclare le matériel qu'il a emprunté depuis le séjour ; l'organisateur et les moniteurs pour les autres")
    void declarerSesEmprunts() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate aujourdhui = LocalDate.now(ZoneId.of("Europe/Paris"));
        LocalDate debut = aujourdhui.plusDays(3);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour prêts","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;

        long flora = 0, anis = 0;
        for (JsonNode c : envoyer("GET", "/api/plongeurs-connus", dt, null, 200)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
            if (c.get("prenom").asText().equals("Anis") && c.hasNonNull("eleveId")) anis = c.get("eleveId").asLong();
        }
        long pFlora = ajouter(base, dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora));
        long pPaul = ajouter(base, dt, """
                {"nom":"Invité","prenom":"Paul","plongeur":true,"email":"paul.prets@exemple.fr"}""");
        long pAnis = ajouter(base, dt, """
                {"eleveId":%d,"nom":"Dulac","prenom":"Anis","plongeur":true,"email":"anis.prets@exemple.fr"}"""
                .formatted(anis));

        String suffixe = UUID.randomUUID().toString().substring(0, 6);
        long gilet = creerEquipement(dt, "GILET", "G-SEJ-" + suffixe);
        long detendeur = creerEquipement(dt, "DETENDEUR", "D-SEJ-" + suffixe);

        envoyer("POST", base + "/invitations", dt, null, 200);
        String code = extraire(dernierPour("paul.prets@exemple.fr"), "/sejour/([A-Za-z0-9_-]+)");
        String pub = "/api/public/sejour/" + code;
        String jetonPaul = entrerParLeLien(pub, "paul.prets@exemple.fr");

        // Paul, invité par le lien : il déclare pour lui-même et choisit dans le matériel disponible.
        JsonNode vuePaul = envoyer("GET", pub + "/prets", jetonPaul, null, 200);
        assertThat(vuePaul.get("droits").get("peutDeclarer").asBoolean()).isTrue();
        assertThat(vuePaul.get("droits").get("pourLesAutres").asBoolean()).isFalse();
        assertThat(vuePaul.get("droits").get("moiId").asLong()).isEqualTo(pPaul);
        assertThat(contient(vuePaul.get("disponibles"), gilet)).isTrue();
        // Un détendeur lui est proposé aussi : sa désinfection s'atteste au retour (detendeurDesinfecteAuRetour).
        assertThat(contient(vuePaul.get("disponibles"), detendeur)).isTrue();

        JsonNode refus = envoyer("POST", pub + "/prets", jetonPaul, declaration(pFlora, aujourdhui, null, gilet), 422);
        assertThat(refus.get("detail").asText()).isEqualTo("Vous ne déclarez que le matériel que vous avez emprunté "
                + "vous-même ; pour un autre, passez par un moniteur du séjour.");

        vuePaul = envoyer("POST", pub + "/prets", jetonPaul, declaration(pPaul, aujourdhui, null, gilet), 200);
        assertThat(vuePaul.get("prets")).hasSize(1);
        JsonNode pretGilet = vuePaul.get("prets").get(0);
        assertThat(pretGilet.get("emprunteur").asText()).isEqualTo("Paul Invité");
        assertThat(pretGilet.get("participantId").asLong()).isEqualTo(pPaul);
        assertThat(pretGilet.get("dateRetourPrevue").asText()).isEqualTo(debut.plusDays(2).toString());
        assertThat(pretGilet.get("annulable").asBoolean()).isTrue();
        assertThat(contient(vuePaul.get("disponibles"), gilet)).isFalse();

        // Déjà prêté : refusé, quel que soit celui qui déclare, sans dire à qui (les emprunteurs peuvent être mineurs).
        String e2 = jeton("e2@club.fr");
        refus = envoyer("POST", base + "/prets", e2, declaration(pAnis, aujourdhui, null, gilet), 422);
        assertThat(refus.get("detail").asText()).contains("G-SEJ-" + suffixe + " : déjà prêté.").doesNotContain("Paul");

        // Un détendeur se désinfecte avant d'être remis : la confirmation est exigée.
        refus = envoyer("POST", base + "/prets", e2, declaration(pAnis, aujourdhui, false, detendeur), 422);
        assertThat(refus.get("detail").asText()).contains("confirmez la désinfection");

        // Flora, moniteur du séjour, déclare pour Anis (élève).
        JsonNode vueFlora = envoyer("POST", base + "/prets", e2, declaration(pAnis, aujourdhui, true, detendeur), 200);
        assertThat(vueFlora.get("droits").get("pourLesAutres").asBoolean()).isTrue();
        assertThat(vueFlora.get("prets")).hasSize(2);

        // C'est un vrai prêt du matériel, rattaché à la sortie, visible du directeur technique.
        boolean vuParLeDt = false;
        for (JsonNode p : envoyer("GET", "/api/materiel/prets", dt, null, 200)) {
            if (p.get("equipements").get(0).get("id").asLong() == detendeur) {
                vuParLeDt = true;
                assertThat(p.get("emprunteur").asText()).isEqualTo("Anis Dulac");
                assertThat(p.get("sortieId").asLong()).isEqualTo(sortie);
                assertThat(p.get("remarques").asText()).isEqualTo("Déclaré depuis le séjour par Flora Vasseur.");
            }
        }
        assertThat(vuParLeDt).isTrue();

        // Anis, élève, ne voit que ce qu'il a emprunté ; Paul aussi.
        String jetonAnis = entrerParLeLien(pub, "anis.prets@exemple.fr");
        JsonNode vueAnis = envoyer("GET", pub + "/prets", jetonAnis, null, 200);
        assertThat(vueAnis.get("prets")).hasSize(1);
        assertThat(vueAnis.get("prets").get(0).get("emprunteur").asText()).isEqualTo("Anis Dulac");
        assertThat(vueAnis.get("prets").get(0).get("annulable").asBoolean()).isFalse();
        assertThat(envoyer("GET", pub + "/prets", jetonPaul, null, 200).get("prets")).hasSize(1);

        // Un encadrant hors du séjour lit tout, mais ne déclare rien.
        String e1 = jeton("e1@club.fr");
        JsonNode vueE1 = envoyer("GET", base + "/prets", e1, null, 200);
        assertThat(vueE1.get("prets")).hasSize(2);
        assertThat(vueE1.get("droits").get("peutDeclarer").asBoolean()).isFalse();
        refus = envoyer("POST", base + "/prets", e1, declaration(pFlora, aujourdhui, null, gilet), 422);
        assertThat(refus.get("detail").asText()).isEqualTo("Seuls les participants du séjour déclarent le matériel emprunté.");

        // Chacun annule ce qu'il a déclaré, tant que le matériel n'est pas rendu ; pas ce qu'un autre a déclaré.
        long pretDetendeur = 0;
        for (JsonNode p : vueFlora.get("prets")) {
            if (p.get("participantId").asLong() == pAnis) pretDetendeur = p.get("id").asLong();
        }
        refus = envoyer("DELETE", pub + "/prets/" + pretDetendeur, jetonAnis, null, 422);
        assertThat(refus.get("detail").asText()).isEqualTo("Seul celui qui a déclaré ce prêt, ou l'organisateur, l'annule.");
        assertThat(envoyer("DELETE", pub + "/prets/" + pretGilet.get("id").asLong(), jetonPaul, null, 200)
                .get("prets")).isEmpty();
        assertThat(envoyer("DELETE", base + "/prets/" + pretDetendeur, dt, null, 200).get("prets")).isEmpty();

        envoyer("GET", pub + "/prets", null, null, 403);
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un participant déclare lui-même son détendeur ; sa désinfection s'atteste au retour, par celui qui le reçoit")
    void detendeurDesinfecteAuRetour() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate aujourdhui = LocalDate.now(ZoneId.of("Europe/Paris"));
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour détendeur","dateDebut":"%s","dateFin":"%s"}""".formatted(aujourdhui, aujourdhui.plusDays(1)),
                201).get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long pZoe = ajouter(base, dt, """
                {"nom":"Invitée","prenom":"Zoé","plongeur":true,"email":"zoe.detendeur@exemple.fr"}""");
        long detendeur = creerEquipement(dt, "DETENDEUR", "D-RET-" + UUID.randomUUID().toString().substring(0, 6));

        envoyer("POST", base + "/invitations", dt, null, 200);
        String pub = "/api/public/sejour/" + extraire(dernierPour("zoe.detendeur@exemple.fr"), "/sejour/([A-Za-z0-9_-]+)");
        String jetonZoe = entrerParLeLien(pub, "zoe.detendeur@exemple.fr");

        // Le détendeur lui est proposé, et elle le déclare sans rien attester.
        assertThat(contient(envoyer("GET", pub + "/prets", jetonZoe, null, 200).get("disponibles"), detendeur)).isTrue();
        long pret = envoyer("POST", pub + "/prets", jetonZoe, declaration(pZoe, aujourdhui, null, detendeur), 200)
                .get("prets").get(0).get("id").asLong();

        // Personne n'a attesté sa désinfection à la remise : rien au journal, elle est due au retour.
        JsonNode fiche = envoyer("GET", "/api/materiel/equipements/" + detendeur, dt, null, 200);
        for (JsonNode i : fiche.get("journal")) assertThat(i.get("type").asText()).isNotEqualTo("DESINFECTION");
        assertThat(fiche.get("prets").get(0).get("desinfectionAuRetour").asBoolean()).isTrue();

        String retour = "{\"dateRetour\":\"%s\"%s}";
        JsonNode refus = envoyer("POST", "/api/materiel/prets/" + pret + "/retour", dt,
                retour.formatted(aujourdhui, ""), 422);
        assertThat(refus.get("detail").asText()).isEqualTo("Ce détendeur a été déclaré par son emprunteur : "
                + "confirmez sa désinfection au retour (Code du sport, art. A322-81).");

        envoyer("POST", "/api/materiel/prets/" + pret + "/retour", dt,
                retour.formatted(aujourdhui, ",\"detendeursDesinfectes\":true"), 200);
        JsonNode apres = envoyer("GET", "/api/materiel/equipements/" + detendeur, dt, null, 200).get("journal").get(0);
        assertThat(apres.get("type").asText()).isEqualTo("DESINFECTION");
        assertThat(apres.get("pretId").asLong()).isEqualTo(pret);
    }

    @Test
    @DisplayName("Un participant dit n'avoir rien emprunté ; déclarer un emprunt efface cette réponse")
    void rienEmprunte() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate aujourdhui = LocalDate.now(ZoneId.of("Europe/Paris"));
        LocalDate debut = aujourdhui.plusDays(5);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour rien emprunté","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(1)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long pLea = ajouter(base, dt, """
                {"nom":"Invitée","prenom":"Léa","plongeur":true,"email":"lea.rien@exemple.fr"}""");
        long pTom = ajouter(base, dt, """
                {"nom":"Invité","prenom":"Tom","plongeur":true}""");
        long gilet = creerEquipement(dt, "GILET", "G-RIEN-" + UUID.randomUUID().toString().substring(0, 6));

        envoyer("POST", base + "/invitations", dt, null, 200);
        String pub = "/api/public/sejour/" + extraire(dernierPour("lea.rien@exemple.fr"), "/sejour/([A-Za-z0-9_-]+)");
        String jetonLea = entrerParLeLien(pub, "lea.rien@exemple.fr");

        assertThat(envoyer("GET", pub + "/prets", jetonLea, null, 200).get("rienEmprunte").asBoolean()).isFalse();
        JsonNode vue = envoyer("PUT", pub + "/prets/rien-emprunte", jetonLea, "{\"rienEmprunte\":true}", 200);
        assertThat(vue.get("rienEmprunte").asBoolean()).isTrue();
        assertThat(envoyer("GET", pub + "/prets", jetonLea, null, 200).get("rienEmprunte").asBoolean()).isTrue();

        // L'organisateur voit qui n'a rien emprunté, et qui n'a pas encore répondu ; elle, rien des autres.
        JsonNode vueOrga = envoyer("GET", base + "/prets", dt, null, 200);
        assertThat(vueOrga.get("rienEmpruntePar")).extracting(n -> n.get("id").asLong()).containsExactly(pLea);
        assertThat(vueOrga.get("sansReponse")).extracting(n -> n.get("id").asLong()).containsExactly(pTom);
        assertThat(vue.get("rienEmpruntePar")).isEmpty();
        assertThat(vue.get("sansReponse")).isEmpty();

        // Elle se souvient finalement d'un gilet : le déclarer retire « rien emprunté ».
        vue = envoyer("POST", pub + "/prets", jetonLea, declaration(pLea, aujourdhui, null, gilet), 200);
        assertThat(vue.get("rienEmprunte").asBoolean()).isFalse();
        vueOrga = envoyer("GET", base + "/prets", dt, null, 200);
        assertThat(vueOrga.get("rienEmpruntePar")).isEmpty();
        assertThat(vueOrga.get("sansReponse")).extracting(n -> n.get("id").asLong()).containsExactly(pTom);

        // Tant qu'un emprunt est déclaré, elle ne peut pas dire n'avoir rien emprunté.
        JsonNode refus = envoyer("PUT", pub + "/prets/rien-emprunte", jetonLea, "{\"rienEmprunte\":true}", 422);
        assertThat(refus.get("detail").asText()).isEqualTo("Vous avez déclaré du matériel pour ce séjour : "
                + "annulez d'abord la déclaration faite par erreur.");

        // Un encadrant qui n'est pas du séjour n'a pas à répondre.
        refus = envoyer("PUT", base + "/prets/rien-emprunte", dt, "{\"rienEmprunte\":true}", 422);
        assertThat(refus.get("detail").asText()).isEqualTo("Seuls les participants du séjour disent s'ils ont "
                + "emprunté du matériel.");

        envoyer("DELETE", pub + "/prets/" + vue.get("prets").get(0).get("id").asLong(), jetonLea, null, 200);
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
