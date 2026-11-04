package fr.club.plongee.sejour;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Export Excel des frais d'un séjour, au format du classeur du club (2026) :
 * « Soldes », « Dépenses », « Remboursements ». Le trésorier y corrige une
 * dépense ou ajoute un remboursement, et les soldes suivent : « A payé » et
 * les remboursements sont des formules qui retrouvent chacun <b>par son nom</b>,
 * d'où un nom unique par ligne. « Sa part » reste un nombre, calculé par
 * {@link FraisSejour}. Chaque formule porte aussi sa valeur, pour les
 * aperçus de téléphone qui ne recalculent pas.
 */
@Service
public class FraisExcelService {

    private static final String LE_CLUB = "Le club";
    private static final String JUSTIFICATIF = "📎";

    private static final String ARGENT = "#,##0.00\" €\";\\-#,##0.00\" €\";\\-";
    private static final String ARGENT_SIGNE = "\\+#,##0.00\" €\";\\-#,##0.00\" €\";0.00\" €\"";
    private static final String ARGENT_ZERO = "#,##0.00\" €\";\\-#,##0.00\" €\";0.00\" €\"";
    private static final String DATE = "dd/mm/yyyy";

    private static final byte[] BLANC = {(byte) 0xff, (byte) 0xff, (byte) 0xff};
    private static final byte[] NOIR = {0, 0, 0};
    private static final byte[] VERT = {0, (byte) 0x80, 0};
    private static final byte[] BLEU = {0, 0, (byte) 0xff};
    private static final byte[] GRIS_TEXTE = {(byte) 0x80, (byte) 0x80, (byte) 0x80};
    private static final byte[] GRIS_BORD = {(byte) 0xbf, (byte) 0xbf, (byte) 0xbf};
    private static final byte[] FOND_ENTETE = {0x30, 0x54, (byte) 0x96};
    private static final byte[] FOND_TOTAL = {(byte) 0xd9, (byte) 0xe1, (byte) 0xf2};
    private static final byte[] FOND_ALTERNE = {(byte) 0xf2, (byte) 0xf2, (byte) 0xf2};
    private static final byte[] ROUGE_SOLDE = {(byte) 0xc0, 0, 0};
    private static final byte[] FOND_ROUGE_SOLDE = {(byte) 0xfc, (byte) 0xe4, (byte) 0xe4};
    private static final byte[] VERT_SOLDE = {0x2e, 0x7d, 0x32};
    private static final byte[] FOND_VERT_SOLDE = {(byte) 0xe2, (byte) 0xef, (byte) 0xda};

    private final FraisService frais;
    private final NamedParameterJdbcTemplate jdbc;

    public FraisExcelService(FraisService frais, NamedParameterJdbcTemplate jdbc) {
        this.frais = frais;
        this.jdbc = jdbc;
    }

    /** {@code acteur} : un organisateur, le seul à lire toutes les lignes que les formules additionnent. */
    @Transactional(readOnly = true)
    public byte[] generer(Long sortieId, FraisService.ActeurFrais acteur) {
        FraisService.FraisVue vue = frais.lire(sortieId, acteur);
        Map<Long, String> noms = noms(sortieId);
        try (XSSFWorkbook classeur = new XSSFWorkbook()) {
            Styles styles = new Styles(classeur);
            XSSFSheet soldes = classeur.createSheet("Soldes");
            XSSFSheet depenses = classeur.createSheet("Dépenses");
            XSSFSheet remboursements = classeur.createSheet("Remboursements");
            int totalSoldes = ecrireSoldes(soldes, vue, noms, styles);
            ecrireDepenses(depenses, vue, noms, totalSoldes, styles);
            ecrireRemboursements(remboursements, vue, noms, styles);
            classeur.setForceFormulaRecalculation(true);
            ByteArrayOutputStream sortie = new ByteArrayOutputStream();
            classeur.write(sortie);
            return sortie.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Échec de la génération de l'export Excel des frais", e);
        }
    }

    /**
     * Le nom de chacun, dans l'ordre des soldes, le club en dernier (clé null). SUMIFS ne distingue pas
     * les majuscules : « Jean Paul / Martin » et « Jean / Paul Martin » additionneraient leurs lignes.
     */
    private Map<Long, String> noms(Long sortieId) {
        Map<Long, String> noms = new LinkedHashMap<>();
        Set<String> pris = new HashSet<>(Set.of(LE_CLUB.toLowerCase(Locale.ROOT)));
        jdbc.query("""
                SELECT id, prenom, nom FROM sejour_participant WHERE sortie_id = :id
                 ORDER BY LOWER(nom), LOWER(prenom), id""", new MapSqlParameterSource("id", sortieId), rs -> {
            String nom = (rs.getString("prenom") + " " + rs.getString("nom")).trim();
            String unique = nom;
            for (int n = 2; !pris.add(unique.toLowerCase(Locale.ROOT)); n++) unique = nom + " (" + n + ")";
            noms.put(rs.getLong("id"), unique);
        });
        noms.put(null, LE_CLUB);
        return noms;
    }

    /** Renvoie le numéro de ligne Excel du total, que le contrôle de l'onglet « Dépenses » relit. */
    private static int ecrireSoldes(XSSFSheet feuille, FraisService.FraisVue vue, Map<Long, String> noms, Styles s) {
        largeurs(feuille, 30, 14, 14, 15, 15, 15);
        entete(feuille, s, "Participant", "A payé", "Sa part", "Remb. versés", "Remb. reçus", "Solde");
        feuille.createFreezePane(0, 1);

        Map<Long, FraisSejour.Solde> parId = new HashMap<>();
        vue.comptes().soldes().forEach(x -> parId.put(x.participantId(), x));
        Map<Long, Long> verses = new HashMap<>();
        Map<Long, Long> recus = new HashMap<>();
        for (FraisSejour.Versement v : vue.versements()) {
            verses.merge(v.deId(), v.montantCentimes(), Long::sum);
            recus.merge(v.aId(), v.montantCentimes(), Long::sum);
        }

        long[] totaux = new long[5];
        int indice = 1;
        for (Map.Entry<Long, String> personne : noms.entrySet()) {
            FraisSejour.Solde solde = parId.getOrDefault(personne.getKey(), new FraisSejour.Solde(personne.getKey(), 0, 0, 0));
            long verse = verses.getOrDefault(personne.getKey(), 0L);
            long recu = recus.getOrDefault(personne.getKey(), 0L);
            Row ligne = feuille.createRow(indice);
            int n = ++indice;
            texte(ligne, 0, personne.getValue(), s.nom);
            formule(ligne, 1, "SUMIFS(Dépenses!$D:$D,Dépenses!$C:$C,A%d)".formatted(n), solde.payeCentimes(), s.argentVert);
            nombre(ligne, 2, solde.duCentimes(), s.argentBleu);
            formule(ligne, 3, "SUMIFS(Remboursements!$C:$C,Remboursements!$A:$A,A%d)".formatted(n), verse, s.argent);
            formule(ligne, 4, "SUMIFS(Remboursements!$C:$C,Remboursements!$B:$B,A%d)".formatted(n), recu, s.argent);
            formule(ligne, 5, "ROUND(B%1$d-C%1$d+D%1$d-E%1$d,2)".formatted(n), solde.soldeCentimes(), s.argentSigne);
            totaux[0] += solde.payeCentimes();
            totaux[1] += solde.duCentimes();
            totaux[2] += verse;
            totaux[3] += recu;
            totaux[4] += solde.soldeCentimes();
        }
        int derniere = indice;
        couleursDuSolde(feuille, new CellRangeAddress(1, derniere - 1, 5, 5));

        Row total = feuille.createRow(indice);
        texte(total, 0, "Total", s.totalTexte);
        for (int colonne = 1; colonne <= 4; colonne++) {
            char c = (char) ('A' + colonne);
            formule(total, colonne, "SUM(%1$c2:%1$c%2$d)".formatted(c, derniere), totaux[colonne - 1], s.totalArgent);
        }
        formule(total, 5, "ROUND(SUM(F2:F%d),2)".formatted(derniere), totaux[4], s.totalSolde);

        note(feuille, indice + 2, 0, "Solde = A payé − Sa part + Remb. versés − Remb. reçus. Le total des soldes doit valoir 0.", s);
        note(feuille, indice + 3, 0, "« A payé » est calculé depuis l'onglet « Dépenses » (en vert). « Sa part » en bleu : "
                + "calculée par l'appli d'après le partage de chaque dépense. Les remboursements se saisissent "
                + "dans l'onglet « Remboursements ».", s);
        return derniere + 1;
    }

    private static void ecrireDepenses(XSSFSheet feuille, FraisService.FraisVue vue, Map<Long, String> noms,
                                       int totalSoldes, Styles s) {
        // « Partagé entre » à droite : les formules de « Soldes » lisent les colonnes C et D.
        largeurs(feuille, 6, 30, 30, 14, 13, 50);
        entete(feuille, s, "N°", "Dépense", "Payé par", "Montant", "Justificatif", "Partagé entre");
        feuille.createFreezePane(0, 1);

        List<FraisSejour.Depense> depenses = vue.depenses();
        for (int i = 0; i < depenses.size(); i++) {
            FraisSejour.Depense d = depenses.get(i);
            boolean alterne = i % 2 == 1;
            Row ligne = feuille.createRow(i + 1);
            Cell numero = ligne.createCell(0);
            numero.setCellValue(i + 1);
            numero.setCellStyle(alterne ? s.numeroAlterne : s.numero);
            texte(ligne, 1, d.libelle(), alterne ? s.saisieAlterne : s.saisie);
            texte(ligne, 2, noms.get(d.payeurId()), alterne ? s.saisieAlterne : s.saisie);
            nombre(ligne, 3, d.montantCentimes(), alterne ? s.argentBleuAlterne : s.argentBleu);
            texte(ligne, 4, d.photos().isEmpty() ? "" : JUSTIFICATIF, alterne ? s.justificatifAlterne : s.justificatif);
            texte(ligne, 5, partage(d, noms), alterne ? s.partageAlterne : s.partage);
        }

        // Sans dépense, une ligne vide : les plages des formules ne remontent pas sur l'en-tête.
        int derniere = Math.max(depenses.size(), 1) + 1;
        long montantTotal = depenses.stream().mapToLong(FraisSejour.Depense::montantCentimes).sum();
        String compte = "COUNTA(B2:B%d)".formatted(derniere);
        Row total = feuille.createRow(derniere);
        texte(total, 0, "", s.totalVide);
        texte(total, 1, "Total", s.totalTexte);
        Cell nombreDepenses = total.createCell(2);
        nombreDepenses.setCellFormula("%1$s&IF(%1$s>1,\" dépenses\",\" dépense\")".formatted(compte));
        nombreDepenses.setCellValue(depenses.size() + (depenses.size() > 1 ? " dépenses" : " dépense"));
        nombreDepenses.setCellStyle(s.totalTexte);
        formule(total, 3, "SUM(D2:D%d)".formatted(derniere), montantTotal, s.totalArgent);
        texte(total, 4, "", s.totalVide);
        texte(total, 5, "", s.totalVide);

        Row controle = feuille.createRow(derniere + 2);
        texte(controle, 1, "Contrôle : écart avec le total « A payé » de l'onglet Soldes", s.note);
        formule(controle, 3, "ROUND(D%d-Soldes!B%d,2)".formatted(derniere + 1, totalSoldes), 0, s.controle);
        note(feuille, derniere + 3, 1, JUSTIFICATIF + " = justificatif joint. Le « Payé par » doit être écrit exactement "
                + "comme dans l'onglet Soldes. "
                + "« × 2 » = deux parts. « Partagé entre » est indicatif : le changer ne recalcule pas « Sa part ».", s);
    }

    /** « Tout le monde » si chacun des participants a une part, sinon les noms ; « × 2 » pour des parts inégales. */
    private static String partage(FraisSejour.Depense d, Map<Long, String> noms) {
        int participants = noms.size() - 1;
        if (participants > 1 && d.parts().size() == participants
                && d.parts().stream().allMatch(p -> p.parts() == 1)) {
            return "Tout le monde";
        }
        return d.parts().stream()
                .map(p -> noms.get(p.participantId()) + (p.parts() > 1 ? " × " + p.parts() : ""))
                .collect(Collectors.joining(", "));
    }

    private static void ecrireRemboursements(XSSFSheet feuille, FraisService.FraisVue vue, Map<Long, String> noms, Styles s) {
        largeurs(feuille, 30, 30, 14, 14);
        entete(feuille, s, "De", "À", "Montant", "Date");
        int indice = 1;
        for (FraisSejour.Versement v : vue.versements()) {
            Row ligne = feuille.createRow(indice++);
            texte(ligne, 0, noms.get(v.deId()), s.saisie);
            texte(ligne, 1, noms.get(v.aId()), s.saisie);
            nombre(ligne, 2, v.montantCentimes(), s.argentBleu);
            Cell jour = ligne.createCell(3);
            jour.setCellValue(v.jour());
            jour.setCellStyle(s.date);
        }
        note(feuille, indice + 1, 0, "Ajoutez une ligne par remboursement (noms identiques à l'onglet Soldes) : "
                + "les soldes se mettent à jour automatiquement.", s);
    }

    // ------------------------------------------------------------------
    //  Cellules
    // ------------------------------------------------------------------

    private static void largeurs(Sheet feuille, int... largeurs) {
        for (int i = 0; i < largeurs.length; i++) feuille.setColumnWidth(i, largeurs[i] * 256);
    }

    private static void entete(Sheet feuille, Styles s, String... titres) {
        Row ligne = feuille.createRow(0);
        for (int i = 0; i < titres.length; i++) texte(ligne, i, titres[i], s.entete);
    }

    private static void texte(Row ligne, int colonne, String valeur, CellStyle style) {
        Cell c = ligne.createCell(colonne);
        if (!valeur.isEmpty()) c.setCellValue(valeur);
        c.setCellStyle(style);
    }

    private static void nombre(Row ligne, int colonne, long centimes, CellStyle style) {
        Cell c = ligne.createCell(colonne);
        c.setCellValue(centimes / 100.0);
        c.setCellStyle(style);
    }

    private static void formule(Row ligne, int colonne, String formule, long centimes, CellStyle style) {
        Cell c = ligne.createCell(colonne);
        c.setCellFormula(formule);
        c.setCellValue(centimes / 100.0);
        c.setCellStyle(style);
    }

    private static void note(Sheet feuille, int indice, int colonne, String texte, Styles s) {
        texte(feuille.createRow(indice), colonne, texte, s.note);
    }

    private static void couleursDuSolde(XSSFSheet feuille, CellRangeAddress plage) {
        var regles = feuille.getSheetConditionalFormatting();
        ConditionalFormattingRule negatif = regles.createConditionalFormattingRule(ComparisonOperator.LT, "0");
        negatif.createFontFormatting().setFontColor(new XSSFColor(ROUGE_SOLDE, null));
        negatif.createPatternFormatting().setFillBackgroundColor(new XSSFColor(FOND_ROUGE_SOLDE, null));
        ConditionalFormattingRule positif = regles.createConditionalFormattingRule(ComparisonOperator.GT, "0");
        positif.createFontFormatting().setFontColor(new XSSFColor(VERT_SOLDE, null));
        positif.createPatternFormatting().setFillBackgroundColor(new XSSFColor(FOND_VERT_SOLDE, null));
        regles.addConditionalFormatting(new CellRangeAddress[]{plage}, negatif, positif);
    }

    // ------------------------------------------------------------------
    //  Styles du classeur du club
    // ------------------------------------------------------------------

    private static final class Styles {
        final XSSFWorkbook classeur;
        final XSSFCellStyle entete, nom, argent, argentVert, argentBleu, argentBleuAlterne, argentSigne,
                totalTexte, totalArgent, totalSolde, totalVide, note, controle, numero, numeroAlterne,
                saisie, saisieAlterne, justificatif, justificatifAlterne, partage, partageAlterne, date;

        Styles(XSSFWorkbook classeur) {
            this.classeur = classeur;
            XSSFFont normale = police(false, false, NOIR);
            XSSFFont bleue = police(false, false, BLEU);
            XSSFFont grasse = police(true, false, NOIR);
            XSSFFont parDefaut = classeur.getFontAt(0);
            entete = style(police(true, false, BLANC), FOND_ENTETE, HorizontalAlignment.CENTER, null);
            entete.setBorderTop(BorderStyle.THIN);
            nom = style(normale, null, null, null);
            argent = style(normale, null, null, ARGENT);
            argentVert = style(police(false, false, VERT), null, null, ARGENT);
            argentBleu = style(bleue, null, null, ARGENT);
            argentBleuAlterne = style(bleue, FOND_ALTERNE, null, ARGENT);
            argentSigne = style(normale, null, null, ARGENT_SIGNE);
            totalTexte = total(grasse, null);
            totalArgent = total(grasse, ARGENT);
            totalSolde = total(grasse, ARGENT_ZERO);
            totalVide = total(parDefaut, null);
            note = sansBord(police(false, true, GRIS_TEXTE), null);
            controle = sansBord(police(false, true, NOIR), ARGENT_ZERO);
            numero = style(normale, null, HorizontalAlignment.CENTER, null);
            numeroAlterne = style(normale, FOND_ALTERNE, HorizontalAlignment.CENTER, null);
            saisie = style(bleue, null, null, null);
            saisieAlterne = style(bleue, FOND_ALTERNE, null, null);
            justificatif = style(parDefaut, null, HorizontalAlignment.CENTER, null);
            justificatifAlterne = style(parDefaut, FOND_ALTERNE, HorizontalAlignment.CENTER, null);
            partage = style(normale, null, null, null);
            partage.setWrapText(true);
            partageAlterne = style(normale, FOND_ALTERNE, null, null);
            partageAlterne.setWrapText(true);
            date = style(bleue, null, null, DATE);
        }

        private XSSFFont police(boolean gras, boolean italique, byte[] couleur) {
            XSSFFont police = classeur.createFont();
            police.setFontName("Arial");
            police.setFontHeightInPoints((short) 11);
            police.setBold(gras);
            police.setItalic(italique);
            police.setColor(new XSSFColor(couleur, null));
            return police;
        }

        private XSSFCellStyle sansBord(XSSFFont police, String format) {
            XSSFCellStyle style = classeur.createCellStyle();
            style.setFont(police);
            if (format != null) style.setDataFormat(classeur.createDataFormat().getFormat(format));
            return style;
        }

        private XSSFCellStyle style(XSSFFont police, byte[] fond, HorizontalAlignment alignement, String format) {
            XSSFCellStyle style = sansBord(police, format);
            if (fond != null) {
                style.setFillForegroundColor(new XSSFColor(fond, null));
                style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            if (alignement != null) style.setAlignment(alignement);
            XSSFColor bord = new XSSFColor(GRIS_BORD, null);
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
            style.setTopBorderColor(bord);
            style.setBottomBorderColor(bord);
            style.setLeftBorderColor(bord);
            style.setRightBorderColor(bord);
            return style;
        }

        /** Le filet épais noir au-dessus de la ligne de total. */
        private XSSFCellStyle total(XSSFFont police, String format) {
            XSSFCellStyle style = style(police, FOND_TOTAL, null, format);
            style.setBorderTop(BorderStyle.MEDIUM);
            style.setTopBorderColor(new XSSFColor(NOIR, null));
            return style;
        }
    }
}
