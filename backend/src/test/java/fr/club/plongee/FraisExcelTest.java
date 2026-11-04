package fr.club.plongee;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * L'export Excel des frais d'un séjour, au format du classeur du club : onglets
 * « Soldes », « Dépenses » et « Remboursements », liés par des formules.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FraisExcelTest {

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

    private JsonNode poster(String url, String jeton, String corps) throws Exception {
        String reponse = mvc.perform(post(url).header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    /** Un séjour neuf de {@code e3@club.fr}, qui en est donc l'organisatrice. */
    private String sejour(String jeton, int dans) throws Exception {
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(dans);
        long sortie = poster("/api/sorties", jeton, """
                {"nom":"Séjour export","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)))
                .get("id").asLong();
        return "/api/sejours/" + sortie;
    }

    private long participant(String base, String jeton, String prenom, String nom) throws Exception {
        JsonNode s = poster(base + "/participants", jeton, """
                {"nom":"%s","prenom":"%s","plongeur":true}""".formatted(nom, prenom));
        long dernier = 0;
        for (JsonNode p : s.get("participants")) dernier = Math.max(dernier, p.get("id").asLong());
        return dernier;
    }

    private long depense(String base, String jeton, String libelle, long centimes, Long payeur, long... parts) throws Exception {
        List<String> lignes = new ArrayList<>();
        for (long id : parts) lignes.add("{\"participantId\":%d,\"parts\":1}".formatted(id));
        return poster(base + "/depenses", jeton, """
                {"libelle":"%s","categorie":"AUTRE","montantCentimes":%d,"payeurId":%s,"parts":[%s]}"""
                .formatted(libelle, centimes, payeur, String.join(",", lignes))).get("depenseId").asLong();
    }

    private XSSFWorkbook exporter(String base, String jeton) throws Exception {
        byte[] contenu = mvc.perform(get(base + "/frais.xlsx").header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        return new XSSFWorkbook(new ByteArrayInputStream(contenu));
    }

    private static List<String> ligneTexte(Sheet feuille, int ligne) {
        List<String> textes = new ArrayList<>();
        for (Cell c : feuille.getRow(ligne)) textes.add(c.getStringCellValue());
        return textes;
    }

    /** Les montants d'une ligne de « Soldes » : A payé, Sa part, Remb. versés, Remb. reçus, Solde. */
    private static double[] montants(Row ligne) {
        double[] m = new double[5];
        for (int i = 0; i < 5; i++) m[i] = ligne.getCell(i + 1).getNumericCellValue();
        return m;
    }

    @Test
    @DisplayName("L'export reprend le format du club : trois onglets, soldes par formules, justificatifs et remboursements")
    void formatDuClub() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 300);
        long alice = participant(base, dt, "Alice", "Durand");
        long bruno = participant(base, dt, "Bruno", "Petit");
        long gite = depense(base, dt, "Gîte", 10000, alice, alice, bruno);
        depense(base, dt, "Bateau", 6000, null, alice, bruno);
        mvc.perform(multipart(base + "/depenses/" + gite + "/photos")
                        .file(new MockMultipartFile("fichier", "note.png", "image/png", PNG))
                        .header("Authorization", dt))
                .andExpect(status().isOk());
        poster(base + "/versements", dt, """
                {"deId":%d,"aId":null,"montantCentimes":3000,"jour":"2027-03-15"}""".formatted(bruno));

        try (XSSFWorkbook classeur = exporter(base, dt)) {
            assertThat(classeur.getNumberOfSheets()).isEqualTo(3);
            assertThat(classeur.getSheetName(0)).isEqualTo("Soldes");
            assertThat(classeur.getSheetName(1)).isEqualTo("Dépenses");
            assertThat(classeur.getSheetName(2)).isEqualTo("Remboursements");

            Sheet soldes = classeur.getSheet("Soldes");
            assertThat(ligneTexte(soldes, 0))
                    .containsExactly("Participant", "A payé", "Sa part", "Remb. versés", "Remb. reçus", "Solde");
            assertThat(soldes.getRow(1).getCell(0).getStringCellValue()).isEqualTo("Alice Durand");
            assertThat(soldes.getRow(2).getCell(0).getStringCellValue()).isEqualTo("Bruno Petit");
            assertThat(soldes.getRow(3).getCell(0).getStringCellValue()).isEqualTo("Le club");
            assertThat(soldes.getRow(4).getCell(0).getStringCellValue()).isEqualTo("Total");
            assertThat(montants(soldes.getRow(1))).containsExactly(100, 80, 0, 0, 20);
            assertThat(montants(soldes.getRow(2))).containsExactly(0, 80, 30, 0, -50);
            assertThat(montants(soldes.getRow(3))).containsExactly(60, 0, 0, 30, 30);
            assertThat(montants(soldes.getRow(4))).containsExactly(160, 160, 30, 30, 0);
            // « A payé » et les remboursements restent calculés : corriger un onglet met les soldes à jour.
            assertThat(soldes.getRow(1).getCell(1).getCellFormula())
                    .isEqualTo("SUMIFS(Dépenses!$D:$D,Dépenses!$C:$C,A2)");
            assertThat(soldes.getRow(2).getCell(3).getCellFormula())
                    .isEqualTo("SUMIFS(Remboursements!$C:$C,Remboursements!$A:$A,A3)");
            assertThat(soldes.getRow(1).getCell(2).getCellType()).isEqualTo(CellType.NUMERIC);

            Sheet depenses = classeur.getSheet("Dépenses");
            assertThat(ligneTexte(depenses, 0)).containsExactly("N°", "Dépense", "Payé par", "Montant", "Justificatif", "Partagé entre");
            Row premiere = depenses.getRow(1);
            assertThat(premiere.getCell(0).getNumericCellValue()).isEqualTo(1);
            assertThat(premiere.getCell(1).getStringCellValue()).isEqualTo("Gîte");
            assertThat(premiere.getCell(2).getStringCellValue()).isEqualTo("Alice Durand");
            assertThat(premiere.getCell(3).getNumericCellValue()).isEqualTo(100);
            assertThat(premiere.getCell(4).getStringCellValue()).isEqualTo("📎");
            Row seconde = depenses.getRow(2);
            assertThat(seconde.getCell(2).getStringCellValue()).isEqualTo("Le club");
            assertThat(seconde.getCell(4).getStringCellValue()).isEmpty();
            Row total = depenses.getRow(3);
            assertThat(total.getCell(1).getStringCellValue()).isEqualTo("Total");
            assertThat(total.getCell(2).getStringCellValue()).isEqualTo("2 dépenses");
            assertThat(total.getCell(3).getNumericCellValue()).isEqualTo(160);
            assertThat(depenses.getRow(5).getCell(3).getNumericCellValue()).isZero();

            Sheet remboursements = classeur.getSheet("Remboursements");
            assertThat(ligneTexte(remboursements, 0)).containsExactly("De", "À", "Montant", "Date");
            Row r = remboursements.getRow(1);
            assertThat(r.getCell(0).getStringCellValue()).isEqualTo("Bruno Petit");
            assertThat(r.getCell(1).getStringCellValue()).isEqualTo("Le club");
            assertThat(r.getCell(2).getNumericCellValue()).isEqualTo(30);
            assertThat(r.getCell(3).getLocalDateTimeCellValue().toLocalDate()).isEqualTo(LocalDate.of(2027, 3, 15));
        }
    }

    @Test
    @DisplayName("Chaque dépense dit par qui elle est partagée : tout le monde, ou les noms, avec les parts inégales")
    void partageDesDepenses() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 305);
        long anne = participant(base, dt, "Anne", "Arnaud");
        long basile = participant(base, dt, "Basile", "Bernard");
        long chloe = participant(base, dt, "Chloé", "Colin");
        depense(base, dt, "Gîte", 9000, anne, anne, basile, chloe);
        depense(base, dt, "Bateau", 4000, anne, anne, chloe);
        poster(base + "/depenses", dt, """
                {"libelle":"Chambre","categorie":"AUTRE","montantCentimes":3000,"payeurId":%d,
                 "parts":[{"participantId":%d,"parts":2},{"participantId":%d,"parts":1}]}""".formatted(anne, basile, chloe));
        poster(base + "/depenses", dt, """
                {"libelle":"Tout le monde, en parts inégales","categorie":"AUTRE","montantCentimes":4000,"payeurId":%d,
                 "parts":[{"participantId":%d,"parts":2},{"participantId":%d,"parts":1},{"participantId":%d,"parts":1}]}"""
                .formatted(anne, anne, basile, chloe));

        try (XSSFWorkbook classeur = exporter(base, dt)) {
            Sheet depenses = classeur.getSheet("Dépenses");
            assertThat(depenses.getRow(1).getCell(5).getStringCellValue()).isEqualTo("Tout le monde");
            assertThat(depenses.getRow(2).getCell(5).getStringCellValue()).isEqualTo("Anne Arnaud, Chloé Colin");
            assertThat(depenses.getRow(3).getCell(5).getStringCellValue()).isEqualTo("Basile Bernard × 2, Chloé Colin");
            assertThat(depenses.getRow(4).getCell(5).getStringCellValue())
                    .isEqualTo("Anne Arnaud × 2, Basile Bernard, Chloé Colin");
            // Colonne ajoutée à droite : celles que lisent les formules ne bougent pas.
            assertThat(classeur.getSheet("Soldes").getRow(1).getCell(1).getNumericCellValue()).isEqualTo(200);
        }
    }

    @Test
    @DisplayName("Les formules du classeur retrouvent les soldes calculés par l'appli, centimes de partage compris")
    void formulesEtAppliDAccord() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 310);
        long a = participant(base, dt, "Anne", "Trois");
        long b = participant(base, dt, "Basile", "Trois");
        long c = participant(base, dt, "Chloé", "Trois");
        depense(base, dt, "Repas", 10000, a, a, b, c);
        depense(base, dt, "Essence", 3301, b, a, b, c);

        try (XSSFWorkbook classeur = exporter(base, dt)) {
            classeur.setForceFormulaRecalculation(false);
            var calcul = classeur.getCreationHelper().createFormulaEvaluator();
            Sheet soldes = classeur.getSheet("Soldes");
            for (int ligne = 1; ligne <= 5; ligne++) {
                for (int colonne = 1; colonne <= 5; colonne++) {
                    Cell cellule = soldes.getRow(ligne).getCell(colonne);
                    if (cellule.getCellType() != CellType.FORMULA) continue;
                    assertThat(calcul.evaluate(cellule).getNumberValue())
                            .as("%s", cellule.getAddress())
                            .isCloseTo(cellule.getNumericCellValue(), within(0.001));
                }
            }
        }
    }

    @Test
    @DisplayName("Deux noms complets identiques gardent chacun leur solde : les formules trouvent chacun par son nom")
    void nomsCompletsIdentiques() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 320);
        // Le séjour refuse mêmes nom et prénom, pas le même nom complet découpé autrement.
        long un = participant(base, dt, "Jean Paul", "Martin");
        long deux = participant(base, dt, "Jean", "Paul Martin");
        depense(base, dt, "Courses", 5000, deux, un, deux);

        try (XSSFWorkbook classeur = exporter(base, dt)) {
            Sheet soldes = classeur.getSheet("Soldes");
            String payeur = classeur.getSheet("Dépenses").getRow(1).getCell(2).getStringCellValue();
            List<String> noms = List.of(soldes.getRow(1).getCell(0).getStringCellValue(),
                    soldes.getRow(2).getCell(0).getStringCellValue());
            assertThat(noms).doesNotHaveDuplicates().contains(payeur);
            var calcul = classeur.getCreationHelper().createFormulaEvaluator();
            int lignePayeur = noms.indexOf(payeur) + 1;
            assertThat(calcul.evaluate(soldes.getRow(lignePayeur).getCell(1)).getNumberValue()).isEqualTo(50);
            assertThat(calcul.evaluate(soldes.getRow(3 - lignePayeur).getCell(1)).getNumberValue()).isZero();
        }
    }

    @Test
    @DisplayName("Un séjour sans dépense s'exporte quand même, avec des totaux à zéro")
    void sansDepense() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 330);
        participant(base, dt, "Solo", "Seul");

        try (XSSFWorkbook classeur = exporter(base, dt)) {
            Row total = classeur.getSheet("Dépenses").getRow(2);
            assertThat(total.getCell(1).getStringCellValue()).isEqualTo("Total");
            assertThat(total.getCell(2).getStringCellValue()).isEqualTo("0 dépense");
            assertThat(total.getCell(3).getNumericCellValue()).isZero();
            assertThat(total.getCell(2).getCellFormula()).doesNotContain("B1");
        }
    }

    @Test
    @DisplayName("Seul un organisateur exporte les frais : ni un moniteur ou un élève inscrits, ni un ADMIN, ni sans connexion")
    void reserveAuxOrganisateurs() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 340);
        long flora = 0, camille = 0;
        String connus = mvc.perform(get("/api/plongeurs-connus").header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        for (JsonNode c : json.readTree(connus)) {
            if (c.get("prenom").asText().equals("Flora") && c.hasNonNull("utilisateurId")) flora = c.get("utilisateurId").asLong();
            if (c.get("prenom").asText().equals("Camille") && c.hasNonNull("eleveId")) camille = c.get("eleveId").asLong();
        }
        poster(base + "/participants", dt, """
                {"utilisateurId":%d,"nom":"Vasseur","prenom":"Flora","plongeur":true}""".formatted(flora));
        poster(base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(camille));

        for (String compte : List.of("e2@club.fr", "eleve@club.fr", "presidente@club.fr")) {
            mvc.perform(get(base + "/frais.xlsx").header("Authorization", jeton(compte)))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get(base + "/frais.xlsx")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Les lignes d'une addition de restaurant sont dans l'export : le total des dépenses reste celui des soldes")
    void additionDuRestaurant() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(360);
        long sortie = poster("/api/sorties", dt, """
                {"nom":"Séjour addition","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(2)))
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        long alice = participant(base, dt, "Alice", "Durand");

        byte[] menu;
        try (XSSFWorkbook w = new XSSFWorkbook()) {
            Sheet feuille = w.createSheet("Menu");
            Row titres = feuille.createRow(0);
            titres.createCell(0).setCellValue("Catégorie");
            titres.createCell(1).setCellValue("Plat");
            titres.createCell(2).setCellValue("Description");
            titres.createCell(3).setCellValue("Prix");
            Row plat = feuille.createRow(1);
            plat.createCell(0).setCellValue("Plat");
            plat.createCell(1).setCellValue("Daurade");
            plat.createCell(3).setCellValue(21);
            var sortieFichier = new java.io.ByteArrayOutputStream();
            w.write(sortieFichier);
            menu = sortieFichier.toByteArray();
        }
        String importe = mvc.perform(multipart(base + "/menus")
                        .file(new MockMultipartFile("fichier", "menu.xlsx", "application/octet-stream", menu))
                        .param("jour", debut.toString()).param("repas", "DINER").param("restaurant", "Le Sémaphore")
                        .header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode lu = json.readTree(importe).get("menus").get(0);
        long menuId = lu.get("id").asLong();
        mvc.perform(put(base + "/menus/" + menuId + "/choix/" + alice).header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platIds\":[%d]}".formatted(lu.get("plats").get(0).get("id").asLong())))
                .andExpect(status().isOk());
        poster(base + "/menus/" + menuId + "/reglement", dt, "{\"payeurId\":null}");

        try (XSSFWorkbook classeur = exporter(base, dt)) {
            Sheet depenses = classeur.getSheet("Dépenses");
            assertThat(depenses.getRow(1).getCell(1).getStringCellValue()).contains("Le Sémaphore");
            assertThat(depenses.getRow(1).getCell(3).getNumericCellValue()).isEqualTo(21);
            assertThat(depenses.getRow(2).getCell(3).getNumericCellValue()).isEqualTo(21);
            assertThat(montants(classeur.getSheet("Soldes").getRow(2))).containsExactly(21, 0, 0, 0, 21);
        }
    }

    @Test
    @DisplayName("L'écran ne propose l'export qu'à l'organisateur, et pas quand il voit le séjour comme un participant")
    void droitAffiche() throws Exception {
        String dt = jeton("e3@club.fr");
        String base = sejour(dt, 350);

        assertThat(lireExporter(base, dt, "")).isTrue();
        assertThat(lireExporter(base, dt, "?commeParticipant=true")).isFalse();
        assertThat(lireExporter(base, jeton("e2@club.fr"), "")).isFalse();
    }

    private boolean lireExporter(String base, String jeton, String parametres) throws Exception {
        String reponse = mvc.perform(get(base + parametres).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("frais").get("droits").get("exporter").asBoolean();
    }
}
