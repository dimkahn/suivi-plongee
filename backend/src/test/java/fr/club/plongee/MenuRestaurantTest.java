package fr.club.plongee;

import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le menu d'un restaurant du séjour (demande du club, 2026) : l'organisateur
 * importe le fichier Excel du menu (fabriqué par une IA à partir d'une photo
 * du menu), chaque participant y choisit ce qu'il veut, l'organisateur lit la
 * commande complète.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(FraisParticipantsTest.BoiteAuxLettres.class)
class MenuRestaurantTest {

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

    private JsonNode importer(String base, String jeton, String nomFichier, byte[] contenu, String jour, String repas,
                              int attendu) throws Exception {
        String reponse = mvc.perform(multipart(base + "/menus")
                        .file(new MockMultipartFile("fichier", nomFichier, "application/octet-stream", contenu))
                        .param("jour", jour).param("repas", repas).param("restaurant", "Le Sémaphore")
                        .header("Authorization", jeton))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    /** Un classeur au format donné par le prompt : Catégorie, Plat, Description, Prix. */
    private static byte[] classeur(Workbook w, String[]... lignes) throws Exception {
        try (w) {
            Sheet feuille = w.createSheet("Menu");
            for (int i = 0; i < lignes.length; i++) {
                Row r = feuille.createRow(i);
                for (int j = 0; j < lignes[i].length; j++) {
                    String v = lignes[i][j];
                    if (i > 0 && j == 3 && !v.isEmpty() && v.matches("[0-9.]+")) r.createCell(j).setCellValue(Double.parseDouble(v));
                    else r.createCell(j).setCellValue(v);
                }
            }
            var sortie = new ByteArrayOutputStream();
            w.write(sortie);
            return sortie.toByteArray();
        }
    }

    private static byte[] menuXlsx() throws Exception {
        return classeur(new XSSFWorkbook(),
                new String[]{"Catégorie", "Plat", "Description", "Prix"},
                new String[]{"Entrée", "Soupe de poissons", "Rouille et croûtons", "9.5"},
                new String[]{"Plat", "Daurade grillée", "Légumes du jour", "21"},
                new String[]{"Plat", "Risotto aux champignons", "", "17"},
                new String[]{"", "", "", ""},
                new String[]{"Dessert", "Tarte au citron", "", "7,50 €"});
    }

    private JsonNode participant(JsonNode sejour, String prenom) {
        for (JsonNode p : sejour.get("participants")) if (p.get("prenom").asText().equals(prenom)) return p;
        throw new AssertionError(prenom + " absent du séjour");
    }

    private long eleveCamille(String jeton) throws Exception {
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", jeton, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) return p.get("eleveId").asLong();
        }
        throw new AssertionError("Camille introuvable");
    }

    /** Un séjour du 1er au 3 août 2031, créé (donc organisé) par e3, avec Camille (compte élève) et Léo (sans compte). */
    private String sejour(String dt, String emailLeo) throws Exception {
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour menu","lieu":"Porquerolles","dateDebut":"2031-08-01","dateFin":"2031-08-03"}""", 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(eleveCamille(dt)), 200);
        envoyer("POST", base + "/participants", dt, """
                {"nom":"Durand","prenom":"Léo","plongeur":false,"email":"%s"}""".formatted(emailLeo), 200);
        return base;
    }

    private static long plat(JsonNode menu, String nom) {
        for (JsonNode p : menu.get("plats")) if (p.get("nom").asText().equals(nom)) return p.get("id").asLong();
        throw new AssertionError(nom + " absent du menu");
    }

    private static List<String> noms(JsonNode plats) {
        List<String> noms = new ArrayList<>();
        plats.forEach(p -> noms.add(p.get("nom").asText()));
        return noms;
    }

    @Test
    @DisplayName("L'organisateur importe le menu Excel d'un restaurant : plats, catégories et prix, repas pris au restaurant")
    void importerUnMenu() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu1@exemple.fr");

        JsonNode menus = importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 200).get("menus");
        assertThat(menus).hasSize(1);
        JsonNode menu = menus.get(0);
        assertThat(menu.get("jour").asText()).isEqualTo("2031-08-02");
        assertThat(menu.get("repas").asText()).isEqualTo("DINER");
        assertThat(menu.get("restaurant").asText()).isEqualTo("Le Sémaphore");
        // La ligne vide est ignorée, l'ordre du fichier gardé.
        assertThat(noms(menu.get("plats")))
                .containsExactly("Soupe de poissons", "Daurade grillée", "Risotto aux champignons", "Tarte au citron");
        JsonNode soupe = menu.get("plats").get(0);
        assertThat(soupe.get("categorie").asText()).isEqualTo("Entrée");
        assertThat(soupe.get("description").asText()).isEqualTo("Rouille et croûtons");
        assertThat(soupe.get("prixCentimes").asInt()).isEqualTo(950);
        assertThat(menu.get("plats").get(3).get("prixCentimes").asInt()).isEqualTo(750);

        // Le repas compte désormais comme pris au restaurant (liste de courses).
        JsonNode repas = envoyer("GET", base + "/repas", dt, null, 200).get("auRestaurant");
        assertThat(repas).hasSize(1);
        assertThat(repas.get(0).get("repas").asText()).isEqualTo("DINER");
    }

    @Test
    @DisplayName("Un menu au format .xls (Excel 97) s'importe aussi")
    void importerUnXls() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu2@exemple.fr");
        byte[] xls = classeur(new HSSFWorkbook(),
                new String[]{"Categorie", "Plat", "Description", "Prix (€)"},
                new String[]{"Boisson", "Eau gazeuse", "", "3"});
        JsonNode menu = importer(base, dt, "menu.xls", xls, "2031-08-01", "DEJEUNER", 200).get("menus").get(0);
        assertThat(noms(menu.get("plats"))).containsExactly("Eau gazeuse");
        assertThat(menu.get("plats").get(0).get("prixCentimes").asInt()).isEqualTo(300);
    }

    @Test
    @DisplayName("Un fichier sans colonne « Plat » ou qui n'est pas un classeur est refusé avec un message clair")
    void fichierIllisible() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu3@exemple.fr");
        byte[] sansPlat = classeur(new XSSFWorkbook(), new String[]{"Nom", "Tarif"}, new String[]{"Pizza", "12"});
        assertThat(importer(base, dt, "menu.xlsx", sansPlat, "2031-08-01", "DINER", 422).get("detail").asText())
                .isEqualTo("Le fichier n'a pas de colonne « Plat » : utilisez le prompt proposé pour le fabriquer.");
        assertThat(importer(base, dt, "menu.xlsx", "pas un classeur".getBytes(), "2031-08-01", "DINER", 422)
                .get("detail").asText())
                .isEqualTo("Ce fichier n'est pas un classeur Excel lisible (.xlsx ou .xls).");
    }

    @Test
    @DisplayName("Un menu hors des dates du séjour est refusé")
    void menuHorsDuSejour() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu4@exemple.fr");
        assertThat(importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-04", "DINER", 422).get("detail").asText())
                .isEqualTo("Le 04/08/2031 n'est pas un jour du séjour (du 01/08/2031 au 03/08/2031).");
    }

    @Test
    @DisplayName("Un encadrant qui n'organise pas le séjour n'importe pas de menu et ne lit pas la commande complète")
    void encadrantNonOrganisateur() throws Exception {
        String dt = jeton("e3@club.fr"), e1 = jeton("e1@club.fr");
        String base = sejour(dt, "leo.menu5@exemple.fr");
        importer(base, e1, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 403);
        importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 200);
        JsonNode menu = envoyer("GET", base + "/menus", e1, null, 200).get("menus").get(0);
        assertThat(menu.get("plats")).hasSize(4);
        assertThat(menu.get("commande").isNull()).isTrue();
        envoyer("DELETE", base + "/menus/" + menu.get("id").asLong(), e1, null, 403);
    }

    @Test
    @DisplayName("Chaque participant choisit dans le menu, l'organisateur lit la commande complète")
    void choisirEtLireLaCommande() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr");
        String base = sejour(dt, "leo.menu6@exemple.fr");
        JsonNode menu = importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 200).get("menus").get(0);
        String choix = base + "/menus/" + menu.get("id").asLong() + "/choix/";
        JsonNode sejour = envoyer("GET", base, dt, null, 200);
        long pCamille = participant(sejour, "Camille").get("id").asLong();
        long pLeo = participant(sejour, "Léo").get("id").asLong();

        // Camille choisit pour elle-même ; sa vue ne montre que son choix, pas la commande.
        JsonNode vue = envoyer("PUT", choix + pCamille, camille, """
                {"platIds":[%d,%d]}""".formatted(plat(menu, "Soupe de poissons"), plat(menu, "Daurade grillée")), 200);
        assertThat(vue.get("participantId").asLong()).isEqualTo(pCamille);
        assertThat(vue.get("menus").get(0).get("monChoix")).hasSize(2);
        assertThat(vue.get("menus").get(0).get("commande").isNull()).isTrue();

        // Elle ne choisit pas pour Léo.
        envoyer("PUT", choix + pLeo, camille, "{\"platIds\":[%d]}".formatted(plat(menu, "Tarte au citron")), 403);

        // L'organisateur choisit pour Léo (sans compte).
        envoyer("PUT", choix + pLeo, dt, """
                {"platIds":[%d,%d]}""".formatted(plat(menu, "Daurade grillée"), plat(menu, "Tarte au citron")), 200);

        JsonNode commande = envoyer("GET", base + "/menus", dt, null, 200).get("menus").get(0).get("commande");
        assertThat(commande.get("totalCentimes").asInt()).isEqualTo(950 + 2100 + 2100 + 750);
        JsonNode daurade = null;
        for (JsonNode l : commande.get("plats")) if (l.get("platId").asLong() == plat(menu, "Daurade grillée")) daurade = l;
        assertThat(daurade.get("nombre").asInt()).isEqualTo(2);
        assertThat(commande.get("participants")).hasSize(2);
        JsonNode leo = commande.get("participants").get(1);
        assertThat(leo.get("prenom").asText()).isEqualTo("Léo");
        assertThat(leo.get("totalCentimes").asInt()).isEqualTo(2850);

        // Un plat d'un autre menu est refusé.
        JsonNode autre = importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-03", "DEJEUNER", 200).get("menus").get(1);
        assertThat(envoyer("PUT", choix + pCamille, camille, "{\"platIds\":[%d]}".formatted(plat(autre, "Tarte au citron")), 422)
                .get("detail").asText()).isEqualTo("Ce plat n'est pas dans ce menu.");

        // Réimporter le menu remplace les plats : les choix sont à refaire.
        menu = importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 200).get("menus").get(0);
        assertThat(menu.get("commande").get("participants")).isEmpty();
        assertThat(menu.get("commande").get("sansChoix")).hasSize(2);
    }

    /** Le menu du dîner du 2 août, avec le choix de Camille (soupe et daurade, 30,50 €) et, si demandé, de Léo (risotto, 17 €). */
    private JsonNode menuChoisi(String dt, String base, boolean leoChoisit) throws Exception {
        JsonNode menu = importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 200).get("menus").get(0);
        String choix = base + "/menus/" + menu.get("id").asLong() + "/choix/";
        JsonNode sejour = envoyer("GET", base, dt, null, 200);
        envoyer("PUT", choix + participant(sejour, "Camille").get("id").asLong(), dt, """
                {"platIds":[%d,%d]}""".formatted(plat(menu, "Soupe de poissons"), plat(menu, "Daurade grillée")), 200);
        if (leoChoisit) {
            envoyer("PUT", choix + participant(sejour, "Léo").get("id").asLong(), dt,
                    "{\"platIds\":[%d]}".formatted(plat(menu, "Risotto aux champignons")), 200);
        }
        return menu;
    }

    @Test
    @DisplayName("Quand tout le monde a choisi, l'organisateur paie l'addition : une dépense par personne, à son montant")
    void reglerLAddition() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu8@exemple.fr");
        JsonNode menu = menuChoisi(dt, base, true);
        long leo = participant(envoyer("GET", base, dt, null, 200), "Léo").get("id").asLong();

        // Léo paie l'addition pour tout le monde.
        JsonNode vue = envoyer("POST", base + "/menus/" + menu.get("id").asLong() + "/reglement", dt,
                "{\"payeurId\":%d}".formatted(leo), 200);
        JsonNode reglement = vue.get("menus").get(0).get("reglement");
        assertThat(reglement.get("payeurId").asLong()).isEqualTo(leo);
        assertThat(reglement.get("prenom").asText()).isEqualTo("Léo");

        JsonNode frais = envoyer("GET", base, dt, null, 200).get("frais");
        List<String> lignes = new ArrayList<>();
        for (JsonNode d : frais.get("depenses")) {
            assertThat(d.get("payeurId").asLong()).isEqualTo(leo);
            assertThat(d.get("categorie").asText()).isEqualTo("REPAS");
            assertThat(d.get("jour").asText()).isEqualTo("2031-08-02");
            assertThat(d.get("parts")).hasSize(1);
            lignes.add(d.get("libelle").asText() + " = " + d.get("montantCentimes").asLong());
        }
        assertThat(lignes).containsExactlyInAnyOrder(
                "Restaurant Le Sémaphore, dîner du 02/08 : Camille B. = 3050",
                "Restaurant Le Sémaphore, dîner du 02/08 : Léo D. = 1700");
    }

    @Test
    @DisplayName("Qui paie de son côté n'est pas mis dans les frais, et la commande le dit")
    void payerDeSonCote() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu12@exemple.fr");
        JsonNode menu = menuChoisi(dt, base, true);
        long leo = participant(envoyer("GET", base, dt, null, 200), "Léo").get("id").asLong();

        JsonNode vue = envoyer("POST", base + "/menus/" + menu.get("id").asLong() + "/reglement", dt,
                "{\"payeurId\":null,\"deLeurCote\":[%d]}".formatted(leo), 200);
        JsonNode depenses = envoyer("GET", base, dt, null, 200).get("frais").get("depenses");
        assertThat(depenses).hasSize(1);
        assertThat(depenses.get(0).get("libelle").asText()).endsWith("Camille B.");
        List<String> deSonCote = new ArrayList<>();
        for (JsonNode p : vue.get("menus").get(0).get("commande").get("participants")) {
            if (p.get("payeDeSonCote").asBoolean()) deSonCote.add(p.get("prenom").asText());
        }
        assertThat(deSonCote).containsExactly("Léo");
    }

    @Test
    @DisplayName("L'addition n'est pas payée si tout le monde paie de son côté")
    void toutLeMondeDeSonCote() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu13@exemple.fr");
        JsonNode menu = menuChoisi(dt, base, true);
        JsonNode sejour = envoyer("GET", base, dt, null, 200);
        assertThat(envoyer("POST", base + "/menus/" + menu.get("id").asLong() + "/reglement", dt,
                "{\"payeurId\":null,\"deLeurCote\":[%d,%d]}".formatted(participant(sejour, "Léo").get("id").asLong(),
                        participant(sejour, "Camille").get("id").asLong()), 422).get("detail").asText())
                .isEqualTo("Tout le monde paie de son côté : il n'y a rien à mettre dans les frais.");
    }

    @Test
    @DisplayName("Dans les frais, un participant ne voit de l'addition que sa part : le montant des autres dirait ce qu'ils ont choisi")
    void partDesAutresMasquee() throws Exception {
        String dt = jeton("e3@club.fr"), camille = jeton("eleve@club.fr");
        String base = sejour(dt, "leo.menu11@exemple.fr");
        JsonNode menu = menuChoisi(dt, base, true);
        envoyer("POST", base + "/menus/" + menu.get("id").asLong() + "/reglement", dt, "{\"payeurId\":null}", 200);

        JsonNode frais = envoyer("GET", base, camille, null, 200).get("frais");
        assertThat(frais.get("depenses")).hasSize(1);
        assertThat(frais.get("depenses").get(0).get("libelle").asText()).endsWith("Camille B.");
        // Les comptes restent faits sur toute l'addition : chacun doit sa part au club.
        assertThat(frais.get("comptes").toString()).contains("1700");
    }

    @Test
    @DisplayName("L'addition ne se paie pas tant que quelqu'un n'a pas choisi")
    void reglerAvantQueToutLeMondeAitChoisi() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu9@exemple.fr");
        JsonNode menu = menuChoisi(dt, base, false);
        assertThat(envoyer("POST", base + "/menus/" + menu.get("id").asLong() + "/reglement", dt,
                "{\"payeurId\":null}", 422).get("detail").asText())
                .isEqualTo("Tout le monde n'a pas encore choisi : Léo D.");
        assertThat(envoyer("GET", base, dt, null, 200).get("frais").get("depenses")).isEmpty();
    }

    @Test
    @DisplayName("Seul un organisateur paie l'addition, une seule fois, et les choix ne changent plus ensuite")
    void reglementReserveEtDefinitif() throws Exception {
        String dt = jeton("e3@club.fr"), e1 = jeton("e1@club.fr"), camille = jeton("eleve@club.fr");
        String base = sejour(dt, "leo.menu10@exemple.fr");
        JsonNode menu = menuChoisi(dt, base, true);
        String reglement = base + "/menus/" + menu.get("id").asLong() + "/reglement";
        envoyer("POST", reglement, e1, "{\"payeurId\":null}", 403);
        envoyer("POST", reglement, camille, "{\"payeurId\":null}", 403);

        // Payée par le club : chacun lui doit sa part.
        JsonNode vue = envoyer("POST", reglement, dt, "{\"payeurId\":null}", 200);
        assertThat(vue.get("menus").get(0).get("reglement").get("payeurId").isNull()).isTrue();
        assertThat(envoyer("GET", base, dt, null, 200).get("frais").get("depenses")).hasSize(2);

        assertThat(envoyer("POST", reglement, dt, "{\"payeurId\":null}", 422).get("detail").asText())
                .isEqualTo("L'addition de ce repas est déjà payée : ses frais sont dans l'onglet « Frais ».");
        long pCamille = participant(envoyer("GET", base, dt, null, 200), "Camille").get("id").asLong();
        JsonNode lue = envoyer("GET", base + "/menus", camille, null, 200).get("menus").get(0);
        assertThat(lue.get("reglement").isNull()).isFalse();
        assertThat(envoyer("PUT", base + "/menus/" + menu.get("id").asLong() + "/choix/" + pCamille, camille,
                "{\"platIds\":[%d]}".formatted(plat(menu, "Tarte au citron")), 422).get("detail").asText())
                .isEqualTo("L'addition de ce repas est payée : les choix ne changent plus.");
    }

    @Test
    @DisplayName("Un élève qui ne participe pas au séjour ne lit pas ses menus")
    void eleveNonParticipant() throws Exception {
        String dt = jeton("e3@club.fr");
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour sans Camille","dateDebut":"2031-08-01","dateFin":"2031-08-03"}""", 201).get("id").asLong();
        envoyer("GET", "/api/sejours/" + sortie + "/menus", jeton("eleve@club.fr"), null, 403);
    }

    @Test
    @DisplayName("Un participant entré par le lien choisit dans le menu et retrouve son choix")
    void choisirParLeLien() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, "leo.menu7@exemple.fr");
        JsonNode menu = importer(base, dt, "menu.xlsx", menuXlsx(), "2031-08-02", "DINER", 200).get("menus").get(0);
        envoyer("POST", base + "/invitations", dt, null, 200);
        String code = extraire(dernierPour("leo.menu7@exemple.fr"), "/sejour/([A-Za-z0-9_-]+)");
        String pub = "/api/public/sejour/" + code;
        envoyer("POST", pub + "/code", null, "{\"email\":\"leo.menu7@exemple.fr\"}", 204);
        String chiffres = extraire(dernierPour("leo.menu7@exemple.fr"), "(\\d{6})");
        String leo = envoyer("POST", pub + "/connexion", null,
                "{\"email\":\"leo.menu7@exemple.fr\",\"code\":\"%s\"}".formatted(chiffres), 200).get("jeton").asText();

        JsonNode vue = envoyer("PUT", pub + "/menus/" + menu.get("id").asLong() + "/choix", leo,
                "{\"platIds\":[%d]}".formatted(plat(menu, "Risotto aux champignons")), 200);
        assertThat(vue.get("menus").get(0).get("monChoix").get(0).asLong()).isEqualTo(plat(menu, "Risotto aux champignons"));
        assertThat(vue.get("menus").get(0).get("commande").isNull()).isTrue();
        assertThat(envoyer("GET", pub + "/menus", leo, null, 200).get("menus").get(0).get("monChoix")).hasSize(1);
        envoyer("GET", pub + "/menus", null, null, 403);
    }

    private static String dernierPour(String adresse) {
        synchronized (FraisParticipantsTest.COURRIELS) {
            for (int i = FraisParticipantsTest.COURRIELS.size() - 1; i >= 0; i--) {
                var c = FraisParticipantsTest.COURRIELS.get(i);
                if (c.adresse().equals(adresse)) return c.corps();
            }
        }
        throw new AssertionError("Aucun courriel pour " + adresse);
    }

    private static String extraire(String texte, String motif) {
        Matcher m = Pattern.compile(motif).matcher(texte);
        assertThat(m.find()).as("« %s » dans : %s", motif, texte).isTrue();
        return m.group(1);
    }
}
