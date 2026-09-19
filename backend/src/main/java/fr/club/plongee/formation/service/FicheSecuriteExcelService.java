package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.MembrePalanquee;
import fr.club.plongee.formation.domain.Palanquee;
import fr.club.plongee.formation.domain.Seance;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.function.Function;

/**
 * Export Excel de la fiche de sécurité, même grille que {@link
 * FicheSecuritePdfService} (plongeurs en lignes, palanquées en colonnes,
 * mêmes 7 colonnes et 15 lignes minimales que le modèle papier du club) mais
 * en tableur : utile au club pour reprendre les paramètres d'un séjour dans
 * un calcul (paliers, consommation...) sans ressaisie.
 */
@Service
public class FicheSecuriteExcelService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH:mm");

    public record FicheExcel(byte[] contenu, String nomFichier) {}

    private final String nomClub;

    public FicheSecuriteExcelService(@Value("${app.club.nom}") String nomClub) {
        this.nomClub = nomClub;
    }

    public FicheExcel generer(FicheSecurite f) {
        Seance s = f.getSeance();
        FicheSecuritePdfService.FicheSecuriteGrille grille = FicheSecuritePdfService.FicheSecuriteGrille.depuis(f);

        try (XSSFWorkbook classeur = new XSSFWorkbook()) {
            Sheet feuille = classeur.createSheet("Fiche de sécurité");

            CellStyle styleEntete = styleEntete(classeur);
            CellStyle styleEnteteRotee = styleEnteteRotee(classeur);
            CellStyle styleEnteteRoteeAptitude = styleEnteteRoteeAptitude(classeur);
            CellStyle styleGras = styleGras(classeur);
            CellStyle styleCroix = styleCroix(classeur);
            CellStyle styleEncadrant = styleEncadrant(classeur);
            CellStyle styleEncadrantCroix = styleEncadrantCroix(classeur);

            int ligne = 0;
            ligne = ecrireEntete(feuille, ligne, f, s);
            ligne++; // ligne vide de séparation

            int nbColonnesFixes = 5; // N°, Nom, Prénom, Niveau, Aptitude donnée par le DP
            int nbColonnes = nbColonnesFixes + grille.numerosColonnes().size() + 1; // + Observations

            Row entetes = feuille.createRow(ligne++);
            entetes.setHeightInPoints(46); // laisse la place aux libellés tournés à 45°
            String[] colonnesFixes = {"N°", "Nom", "Prénom"};
            for (int i = 0; i < colonnesFixes.length; i++) {
                cellule(entetes, i, colonnesFixes[i], styleEntete);
            }
            cellule(entetes, 3, "Niveau", styleEnteteRotee);
            cellule(entetes, 4, "Aptitude donnée\npar le DP", styleEnteteRoteeAptitude);
            int colonne = nbColonnesFixes;
            for (int numero : grille.numerosColonnes()) {
                cellule(entetes, colonne++, "Palanquée " + numero, styleEnteteRotee);
            }
            cellule(entetes, colonne, "Observations", styleEnteteRotee);

            int numeroLigne = 1;
            for (MembrePalanquee m : grille.membres()) {
                boolean encadrant = grille.estEncadrant(m);
                Row row = feuille.createRow(ligne++);
                cellule(row, 0, String.valueOf(numeroLigne++), encadrant ? styleEncadrant : null);
                cellule(row, 1, m.getNom(), encadrant ? styleEncadrant : null);
                cellule(row, 2, m.getPrenom(), encadrant ? styleEncadrant : null);
                cellule(row, 3, niveau(m), encadrant ? styleEncadrant : null);
                cellule(row, 4, m.getAptitudeDonneeParDp(), encadrant ? styleEncadrant : null);
                int c = nbColonnesFixes;
                for (int numero : grille.numerosColonnes()) {
                    cellule(row, c++, grille.appartient(numero, m) ? "X" : "",
                            encadrant ? styleEncadrantCroix : styleCroix);
                }
                cellule(row, c, m.getObservations(), encadrant ? styleEncadrant : null);
            }
            for (; numeroLigne <= grille.nbLignesAffichees(); numeroLigne++) {
                Row row = feuille.createRow(ligne++);
                cellule(row, 0, String.valueOf(numeroLigne), null);
            }

            ligne = ligneRecap(feuille, ligne, "Prof prévue (m)", nbColonnesFixes, grille, styleGras,
                    p -> texte(p.getProfondeurPrevue()));
            ligne = ligneRecap(feuille, ligne, "Durée prévue (min)", nbColonnesFixes, grille, styleGras,
                    p -> texte(p.getDureePrevue()));
            ligne = ligneRecap(feuille, ligne, "Heure de départ", nbColonnesFixes, grille, styleGras,
                    p -> texte(p.getHeureImmersion()));
            ligne = ligneRecap(feuille, ligne, "Heure de sortie", nbColonnesFixes, grille, styleGras,
                    p -> texte(p.getHeureSortie()));
            ligne = ligneRecap(feuille, ligne, "Prof réalisée (m)", nbColonnesFixes, grille, styleGras,
                    p -> texte(p.getProfondeurRealisee()));
            ligneRecap(feuille, ligne, "Durée réalisée (min)", nbColonnesFixes, grille, styleGras,
                    p -> texte(p.getDureeRealisee()));

            for (int i = 0; i < nbColonnes; i++) {
                feuille.autoSizeColumn(i);
            }

            ByteArrayOutputStream sortie = new ByteArrayOutputStream();
            classeur.write(sortie);
            return new FicheExcel(sortie.toByteArray(), "fiche-securite-%s.xlsx".formatted(s.getDateSeance()));
        } catch (IOException e) {
            throw new IllegalStateException("Échec de la génération de l'export Excel de la fiche de sécurité", e);
        }
    }

    private int ecrireEntete(Sheet feuille, int ligne, FicheSecurite f, Seance s) {
        cellule(feuille.createRow(ligne++), 0, nomClub, null);
        cellule(feuille.createRow(ligne++), 0, "FICHE DE SÉCURITÉ", null);
        cellule(feuille.createRow(ligne++), 0, "Date : " + s.getDateSeance().format(DATE), null);
        cellule(feuille.createRow(ligne++), 0, "Lieu : " + (s.getLieu() == null ? "" : s.getLieu()), null);
        cellule(feuille.createRow(ligne++), 0, "Plongée n° : " + s.getOrdre(), null);
        cellule(feuille.createRow(ligne++), 0, "Directeur de plongée : " + f.getDp().nomComplet(), null);
        return ligne;
    }

    private int ligneRecap(Sheet feuille, int ligne, String libelle, int nbColonnesFixes,
                           FicheSecuritePdfService.FicheSecuriteGrille grille, CellStyle styleGras,
                           Function<Palanquee, String> valeur) {
        Row row = feuille.createRow(ligne);
        cellule(row, 0, libelle, styleGras);
        int c = nbColonnesFixes;
        for (int numero : grille.numerosColonnes()) {
            Palanquee p = grille.palanquee(numero);
            cellule(row, c++, p == null ? "" : valeur.apply(p), styleGras);
        }
        return ligne + 1;
    }

    private void cellule(Row row, int colonne, String valeur, CellStyle style) {
        Cell cell = row.createCell(colonne);
        cell.setCellValue(valeur == null ? "" : valeur);
        if (style != null) cell.setCellStyle(style);
    }

    private String niveau(MembrePalanquee m) {
        String aptitude = m.getAptitude() == null ? "" : m.getAptitude();
        String qualification = m.getQualificationPreparee() == null || m.getQualificationPreparee().isBlank()
                ? "" : " / " + m.getQualificationPreparee();
        return aptitude + qualification;
    }

    private String texte(Integer v) {
        return v == null ? "" : String.valueOf(v);
    }

    private String texte(LocalTime t) {
        return t == null ? "" : t.format(HEURE);
    }

    private CellStyle styleEntete(Workbook classeur) {
        CellStyle style = classeur.createCellStyle();
        Font police = classeur.createFont();
        police.setBold(true);
        style.setFont(police);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        return style;
    }

    /**
     * En-tête tourné à 45° (Niveau, Aptitude donnée par le DP, Palanquée N,
     * Observations) : ces colonnes n'ont besoin que de leur largeur de
     * contenu, pas de celle du libellé — la rotation garde les colonnes
     * étroites, comme dans l'export PDF.
     */
    private CellStyle styleEnteteRotee(Workbook classeur) {
        CellStyle style = styleEntete(classeur);
        style.setRotation((short) 45);
        style.setVerticalAlignment(VerticalAlignment.BOTTOM);
        return style;
    }

    /**
     * Variante de {@link #styleEnteteRotee} pour "Aptitude donnée par le DP" :
     * libellé plus long que les autres en-têtes tournés, réparti sur deux
     * lignes avec une police plus petite pour rester lisible sans élargir la
     * colonne.
     */
    private CellStyle styleEnteteRoteeAptitude(Workbook classeur) {
        CellStyle style = classeur.createCellStyle();
        Font police = classeur.createFont();
        police.setBold(true);
        police.setFontHeightInPoints((short) 8);
        style.setFont(police);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setRotation((short) 45);
        style.setVerticalAlignment(VerticalAlignment.BOTTOM);
        style.setWrapText(true);
        return style;
    }

    private CellStyle styleGras(Workbook classeur) {
        CellStyle style = classeur.createCellStyle();
        Font police = classeur.createFont();
        police.setBold(true);
        style.setFont(police);
        return style;
    }

    private CellStyle styleCroix(Workbook classeur) {
        CellStyle style = classeur.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    /** Fond jaune sur la ligne d'un encadrant, comme sur le modèle papier du club. */
    private CellStyle styleEncadrant(Workbook classeur) {
        CellStyle style = classeur.createCellStyle();
        style.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle styleEncadrantCroix(Workbook classeur) {
        CellStyle style = styleEncadrant(classeur);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }
}
