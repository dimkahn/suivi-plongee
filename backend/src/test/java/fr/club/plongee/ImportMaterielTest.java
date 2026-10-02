package fr.club.plongee;

import org.apache.poi.ss.usermodel.*;
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

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reprise du classeur Excel du matériel (« Historique Blocs ») : un
 * classeur fabriqué ici au même format (titres, cases « VENDU », dates au
 * mois près, prévisions de requalification), avec des numéros qu'aucun
 * autre test n'utilise.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ImportMaterielTest {

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

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode equipement(JsonNode inventaire, String reference) {
        for (JsonNode e : inventaire) if (e.get("reference").asText().equals(reference)) return e;
        throw new AssertionError("Équipement absent : " + reference);
    }

    /** Une case par valeur : LocalDate (au jour), String, Number ; « MOIS: » + date = date au mois près. */
    private static void ligne(Sheet s, Workbook wb, int numero, Object... valeurs) {
        CreationHelper aide = wb.getCreationHelper();
        CellStyle jour = wb.createCellStyle();
        jour.setDataFormat(aide.createDataFormat().getFormat("m/d/yy"));
        CellStyle mois = wb.createCellStyle();
        mois.setDataFormat(aide.createDataFormat().getFormat("mmm-yy"));
        Row r = s.createRow(numero);
        for (int i = 0; i < valeurs.length; i++) {
            Object v = valeurs[i];
            if (v == null) continue;
            Cell c = r.createCell(i);
            if (v instanceof LocalDate d) {
                c.setCellValue(d);
                c.setCellStyle(jour);
            } else if (v instanceof String t && t.startsWith("MOIS:")) {
                c.setCellValue(LocalDate.parse(t.substring(5)));
                c.setCellStyle(mois);
            } else if (v instanceof Number n) {
                c.setCellValue(n.doubleValue());
            } else {
                c.setCellValue(v.toString());
            }
        }
    }

    private byte[] classeur() throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream sortie = new ByteArrayOutputStream()) {
            int anneeCourante = AUJOURDHUI.getYear();
            LocalDate derniereVisite = AUJOURDHUI.minusMonths(2);
            LocalDate requalif = AUJOURDHUI.minusYears(2).withDayOfMonth(1);
            LocalDate prevision = requalif.plusYears(6);

            Sheet blocs = wb.createSheet("Blocs Global");
            List<Object> titres = new ArrayList<>(List.of("Numéro", "Club", "Ancien N°", "Constructeur", "Marque", "N°",
                    "Cpté", "PE", "PS", "Marque Robinet", "N° robinet", "Première Epreuve", "Dernière Requalif",
                    "Date de dernière visite TIV", "Requalif " + (anneeCourante - 2),
                    "Requalif " + (anneeCourante + 4) + "\n(6 ans)", "Visite 2004", "Visite 2005", "commentaires"));
            ligne(blocs, wb, 0, titres.toArray());
            // Bloc du club suivi, historique complet, prévision de requalification à ignorer.
            ligne(blocs, wb, 1, 90, "CPPJVO", 12, "ROTH", "SPIRO", "AA10579", 12, 300, 200, "Aqualung", 579,
                    "MOIS:1989-01-01", "MOIS:" + requalif, derniereVisite, "MOIS:" + requalif, "MOIS:" + prevision,
                    LocalDate.of(2004, 5, 22), "Requalif", null);
            // Bloc d'un membre, volume écrit avec une virgule, une case « Oubli ».
            ligne(blocs, wb, 2, 91, "BRUNET", null, "ROTH", "V.PLONGEUR", "2005/67414", "13,5", 348, 232, null, "???",
                    "MOIS:2005-04-01", "MOIS:" + requalif, derniereVisite, "Oubli", null, "*", "neuf 2005", null);
            // Bloc vendu : au rebut à la date du commentaire.
            ligne(blocs, wb, 3, 92, "CPPJVO", 25, "ROTH", "SPIRO", "86AA8842", 12, 264, 176, null, "VENDU",
                    "MOIS:1986-02-01", "VENDU", "VENDU", "VENDU", "VENDU", LocalDate.of(2004, 5, 22), "VENDU",
                    "Reprise Vieux Plongeur le 30/04/05 suite nouvel achat");

            Sheet stabs = wb.createSheet("Stabs");
            ligne(stabs, wb, 0, "N°", "old", "FABRICANT", "TYPE", "TAILLE", "Date ACHAT");
            ligne(stabs, wb, 1, "XL9", 30, "SCUBAPRO", "T-ONE", "XL", "MOIS:2014-11-01");
            ligne(stabs, wb, 2, "S9", 8, "VIEUX PLONGEUR", null, null, "?");

            wb.write(sortie);
            return sortie.toByteArray();
        }
    }

    private JsonNode importer(String jeton, byte[] contenu) throws Exception {
        MockMultipartFile fichier = new MockMultipartFile("fichier", "materiel.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contenu);
        return json.readTree(mvc.perform(multipart("/api/materiel/import").file(fichier).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    @DisplayName("Le classeur du matériel entre dans l'inventaire avec son historique, sans doublon s'il est réimporté")
    void importClasseur() throws Exception {
        String dt = jeton("e3@club.fr");
        byte[] contenu = classeur();

        JsonNode rapport = importer(dt, contenu);
        assertThat(rapport.get("blocs").asInt()).isEqualTo(3);
        assertThat(rapport.get("gilets").asInt()).isEqualTo(2);
        assertThat(rapport.get("auRebut").asInt()).isEqualTo(1);
        assertThat(rapport.get("remarques").toString()).contains("B-91 : Requalif " + (AUJOURDHUI.getYear() - 2) + " : « Oubli »");

        JsonNode inventaire = lire("/api/materiel/equipements", dt);
        JsonNode b90 = equipement(inventaire, "B-90");
        assertThat(b90.get("statut").asText()).isEqualTo("DISPONIBLE");
        assertThat(b90.get("proprietaire").isNull()).isTrue();
        assertThat(b90.get("constructeur").asText()).isEqualTo("ROTH");
        assertThat(b90.get("marque").asText()).isEqualTo("SPIRO");
        assertThat(b90.get("ancienneReference").asText()).isEqualTo("12");
        assertThat(b90.get("robinetterie").asText()).isEqualTo("Aqualung");
        assertThat(b90.get("numeroRobinet").asText()).isEqualTo("579");
        assertThat(b90.get("pressionEpreuveBar").asInt()).isEqualTo(300);
        assertThat(b90.get("datePremiereEpreuve").asText()).isEqualTo("1989-01-01");
        // La requalification prévue dans six ans n'est pas une requalification faite.
        LocalDate requalif = AUJOURDHUI.minusYears(2).withDayOfMonth(1);
        assertThat(b90.get("derniereRequalification").asText()).isEqualTo(requalif.toString());
        assertThat(b90.get("prochaineRequalification").asText()).isEqualTo(requalif.plusYears(6).toString());
        assertThat(b90.get("derniereInspection").asText()).isEqualTo(AUJOURDHUI.minusMonths(2).toString());

        JsonNode b91 = equipement(inventaire, "B-91");
        assertThat(b91.get("proprietaire").asText()).isEqualTo("BRUNET");
        assertThat(b91.get("volumeLitres").asDouble()).isEqualTo(13.5);
        assertThat(b91.get("numeroRobinet").isNull()).isTrue();
        assertThat(b91.get("remarques").asText()).contains("Oubli");

        JsonNode b92 = equipement(inventaire, "B-92");
        assertThat(b92.get("statut").asText()).isEqualTo("REBUTE");
        assertThat(b92.get("dateRebut").asText()).isEqualTo("2005-04-30");
        assertThat(b92.get("motifRebut").asText()).startsWith("Vendu : Reprise Vieux Plongeur");

        JsonNode journal = lire("/api/materiel/equipements/" + b90.get("id").asLong(), dt).get("journal");
        assertThat(journal).hasSize(3);
        assertThat(journal.toString()).contains("seul le mois y est noté").contains("2004-05-22");

        JsonNode gilet = equipement(inventaire, "G-XL9");
        assertThat(gilet.get("type").asText()).isEqualTo("GILET");
        assertThat(gilet.get("marque").asText()).isEqualTo("SCUBAPRO");
        assertThat(gilet.get("modele").asText()).isEqualTo("T-ONE");
        assertThat(gilet.get("ancienneReference").asText()).isEqualTo("30");
        assertThat(gilet.get("dateAchat").asText()).isEqualTo("2014-11-01");
        JsonNode s9 = equipement(inventaire, "G-S9");
        assertThat(s9.get("taille").asText()).isEqualTo("S");
        assertThat(s9.get("dateAchat").isNull()).isTrue();

        JsonNode second = importer(dt, contenu);
        assertThat(second.get("blocs").asInt()).isZero();
        assertThat(second.get("gilets").asInt()).isZero();
        assertThat(second.get("dejaPresents").toString()).contains("B-90", "B-92", "G-XL9");
    }

    /** Le texte d'une case, chiffres sans « .0 ». */
    private static String valeur(Cell c) {
        if (c == null) return "";
        return c.getCellType() == CellType.NUMERIC
                ? java.math.BigDecimal.valueOf(c.getNumericCellValue()).stripTrailingZeros().toPlainString()
                : c.getStringCellValue();
    }

    @Test
    @DisplayName("L'export suit le format du classeur : réimporté sous d'autres numéros, il redonne les mêmes fiches")
    void exportReimportable() throws Exception {
        String dt = jeton("e3@club.fr");
        importer(dt, classeur());

        byte[] export = mvc.perform(get("/api/materiel/export.xlsx").header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        mvc.perform(get("/api/materiel/export.xlsx").header("Authorization", jeton("e2@club.fr")))
                .andExpect(status().isForbidden());

        // Mêmes lignes renumérotées : 90 → 190, XL9 → RXL9 ; le reste est déjà dans l'inventaire.
        byte[] renumerote;
        try (Workbook wb = WorkbookFactory.create(new java.io.ByteArrayInputStream(export));
             ByteArrayOutputStream sortie = new ByteArrayOutputStream()) {
            Sheet blocs = wb.getSheet("Blocs");
            assertThat(valeur(blocs.getRow(0).getCell(0))).isEqualTo("Numéro");
            int trouves = 0;
            for (Row r : blocs) {
                String numero = valeur(r.getCell(0));
                if (List.of("90", "91", "92").contains(numero)) {
                    r.getCell(0).setCellValue("1" + numero);
                    trouves++;
                }
            }
            assertThat(trouves).isEqualTo(3);
            for (Row r : wb.getSheet("Stabs")) {
                String numero = valeur(r.getCell(0));
                if (List.of("XL9", "S9").contains(numero)) r.getCell(0).setCellValue("R" + numero);
            }
            wb.write(sortie);
            renumerote = sortie.toByteArray();
        }

        JsonNode rapport = importer(dt, renumerote);
        assertThat(rapport.get("blocs").asInt()).isEqualTo(3);
        assertThat(rapport.get("gilets").asInt()).isEqualTo(2);
        assertThat(rapport.get("auRebut").asInt()).isEqualTo(1);

        JsonNode inventaire = lire("/api/materiel/equipements", dt);
        List<String> champs = List.of("statut", "proprietaire", "ancienneReference", "constructeur", "marque",
                "modele", "numeroSerie", "taille", "volumeLitres", "pressionEpreuveBar", "pressionServiceBar",
                "robinetterie", "numeroRobinet", "datePremiereEpreuve", "dateAchat", "derniereRequalification",
                "prochaineRequalification", "derniereInspection", "dateRebut", "motifRebut", "remarques");
        for (String[] paire : new String[][] {{"B-90", "B-190"}, {"B-91", "B-191"}, {"B-92", "B-192"},
                {"G-XL9", "G-RXL9"}, {"G-S9", "G-RS9"}}) {
            JsonNode avant = equipement(inventaire, paire[0]);
            JsonNode apres = equipement(inventaire, paire[1]);
            for (String champ : champs) {
                assertThat(String.valueOf(apres.get(champ))).as(paire[1] + " " + champ)
                        .isEqualTo(String.valueOf(avant.get(champ)));
            }
            JsonNode journalAvant = lire("/api/materiel/equipements/" + avant.get("id").asLong(), dt).get("journal");
            JsonNode journalApres = lire("/api/materiel/equipements/" + apres.get("id").asLong(), dt).get("journal");
            assertThat(journalApres).as(paire[1] + " journal").hasSize(journalAvant.size());
            for (int i = 0; i < journalAvant.size(); i++) {
                for (String champ : List.of("type", "dateIntervention", "resultat", "description")) {
                    assertThat(String.valueOf(journalApres.get(i).get(champ))).as(paire[1] + " journal " + champ)
                            .isEqualTo(String.valueOf(journalAvant.get(i).get(champ)));
                }
            }
        }
    }

    @Test
    @DisplayName("Un fichier qui n'est pas le classeur du matériel est refusé, et l'import reste réservé au DT")
    void refus() throws Exception {
        mvc.perform(multipart("/api/materiel/import")
                        .file(new MockMultipartFile("fichier", "notes.txt", "text/plain", "bonjour".getBytes()))
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("n'a pas pu être lu")));

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream sortie = new ByteArrayOutputStream()) {
            ligne(wb.createSheet("Autre"), wb, 0, "Nom", "Prénom", "Âge");
            wb.write(sortie);
            mvc.perform(multipart("/api/materiel/import")
                            .file(new MockMultipartFile("fichier", "autre.xlsx", "application/octet-stream",
                                    sortie.toByteArray()))
                            .header("Authorization", jeton("e3@club.fr")))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("ni feuille de blocs")));
        }

        mvc.perform(multipart("/api/materiel/import")
                        .file(new MockMultipartFile("fichier", "materiel.xlsx", "application/octet-stream", classeur()))
                        .header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isForbidden());
    }
}
