package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.Palanquee;
import fr.club.plongee.formation.domain.Seance;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.RegionUtil;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import fr.club.plongee.identite.IdentiteStructureService;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;

/**
 * Export Excel de la fiche de sécurité, même feuille que {@link
 * FicheSecuritePdfService} (modèle papier du club « Martinique 2026 », passé
 * en A4 paysage, deux plongées du jour, une colonne par encadrant) mais en
 * tableur : pour la compléter à la main au bord de l'eau ou reprendre les
 * paramètres d'un séjour sans ressaisie. Profondeurs et durées sont des
 * nombres (m, min).
 */
@Service
public class FicheSecuriteExcelService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH:mm");
    /** N°, Nom, Prénom, Niveau, Aptitude définie par DP : les colonnes d'encadrants commencent après. */
    private static final int NB_COLONNES_FIXES = 5;
    private static final byte[] BLEU = {0x11, 0x11, (byte) 0xd3};
    private static final byte[] ROUGE = {(byte) 0xff, 0, 0};
    private static final byte[] JAUNE = {(byte) 0xff, (byte) 0xff, 0};
    private static final byte[] BLEU_CLAIR = {(byte) 0xda, (byte) 0xe3, (byte) 0xf3};
    private static final byte[] GRIS = {(byte) 0xd9, (byte) 0xd9, (byte) 0xd9};
    private static final byte[] GRIS_FONCE = {(byte) 0xae, (byte) 0xaa, (byte) 0xaa};
    private static final byte[] BLEU_GRIS = {(byte) 0xc3, (byte) 0xcd, (byte) 0xe0};
    private static final byte[] BLEU_GRIS_FONCE = {(byte) 0x9b, (byte) 0xa8, (byte) 0xc2};

    public record FicheExcel(byte[] contenu, String nomFichier) {}

    /** Nom et logo de la structure, en-tête de la fiche. */
    private final IdentiteStructureService identite;
    /** Une fiche signée puis modifiée ne s'imprime pas comme signée. */
    private final EmpreinteFicheSecurite empreintes;

    public FicheSecuriteExcelService(IdentiteStructureService identite, EmpreinteFicheSecurite empreintes) {
        this.identite = identite;
        this.empreintes = empreintes;
    }

    /** Une feuille : une plongée, ou deux du même jour (1er et 2e tour). */
    public FicheExcel generer(List<FicheSecurite> tours) {
        try (XSSFWorkbook classeur = classeur(tours)) {
            ByteArrayOutputStream sortie = new ByteArrayOutputStream();
            classeur.write(sortie);
            return new FicheExcel(sortie.toByteArray(),
                    "fiche-securite-%s.xlsx".formatted(tours.get(0).getSeance().getDateSeance()));
        } catch (IOException e) {
            throw new IllegalStateException("Échec de la génération de l'export Excel de la fiche de sécurité", e);
        }
    }

    /**
     * Le classeur de la feuille, que {@link FicheSecuritePdfService} redessine
     * aussi en PDF ({@link ClasseurHtml}) : le PDF est la même feuille.
     */
    XSSFWorkbook classeur(List<FicheSecurite> tours) {
        FeuilleSecurite f = FeuilleSecurite.depuis(tours);
        Seance premiere = tours.get(0).getSeance();
        XSSFWorkbook classeur = new XSSFWorkbook();
        {
            Styles st = new Styles(classeur);
            Sheet feuille = classeur.createSheet("Fiche de sécurité");
            List<FeuilleSecurite.Colonne> colonnes = f.colonnes();
            int obs = NB_COLONNES_FIXES + colonnes.size();

            // En-tête : date, site, titre ; logo, lieux et heures, directeur de plongée et signature.
            // Une seule plongée : une seule ligne de lieu, et pas de 2e tour plus bas.
            boolean deuxTours = f.tours().size() == FeuilleSecurite.NB_TOURS;
            int derniereLigneLieux = deuxTours ? 2 : 1;
            // Hauteurs et largeurs pour une page en paysage : des lignes basses, des colonnes larges.
            Row r0 = ligne(feuille, 0, 40);
            cellule(r0, 0, "DATE :\n" + premiere.getDateSeance().format(DATE), st.etiquette);
            fusion(feuille, 0, 0, 1, 4, "Site : " + texte(premiere.getLieu()), st.etiquette);
            fusion(feuille, 0, 0, NB_COLONNES_FIXES, obs, "FICHE DE SÉCURITÉ\n" + identite.nom(), st.titre);
            if (deuxTours) {
                ligne(feuille, 1, 28);
                ligne(feuille, 2, 28);
                fusion(feuille, 1, 1, 1, 2, "Lieu 1 : " + lieu(f, 0), st.etiquette);
                fusion(feuille, 1, 1, 3, 4, "heure prévue :", st.etiquette);
                fusion(feuille, 2, 2, 1, 2, "Lieu 2 : " + lieu(f, 1), st.etiquette);
                fusion(feuille, 2, 2, 3, 4, "heure prévue :", st.etiquette);
            } else {
                ligne(feuille, 1, 56);
                fusion(feuille, 1, 1, 1, 2, "Lieu : " + lieu(f, 0), st.etiquette);
                fusion(feuille, 1, 1, 3, 4, "heure prévue :", st.etiquette);
            }
            fusion(feuille, 1, derniereLigneLieux, 0, 0, "", st.cadre);
            fusion(feuille, 1, derniereLigneLieux, NB_COLONNES_FIXES, obs,
                    "Directeur de Plongée : " + f.directeursDePlongee() + "\n\n" + f.signatures(empreintes::estIntegre),
                    st.etiquetteCentree);

            // Libellés des colonnes, tournés à 45° ; les encadrants sur fond jaune.
            Row entetes = ligne(feuille, derniereLigneLieux + 1, 95);
            cellule(entetes, 0, "", st.cadre);
            cellule(entetes, 1, "Nom", st.nomColonne);
            cellule(entetes, 2, "Prénom", st.prenomColonne);
            cellule(entetes, 3, "Niveau", st.rotee);
            cellule(entetes, 4, "Aptitude définie par DP", st.rotee);
            for (int c = 0; c < colonnes.size(); c++) {
                cellule(entetes, NB_COLONNES_FIXES + c, colonnes.get(c).nom(),
                        colonnes.get(c).autonomes() ? st.roteeNoire : st.roteeEncadrant);
            }
            // Droite : penchée, la case large d'« Observations » déborderait de la page.
            cellule(entetes, obs, "Observations", st.observationsColonne);

            Row compte = ligne(feuille, derniereLigneLieux + 2, 18);
            Cell nb = compte.createCell(0);
            nb.setCellValue(f.nbEncadrants());
            nb.setCellStyle(st.compte);
            fusion(feuille, derniereLigneLieux + 2, derniereLigneLieux + 2, 1, 4, "<= Nombre d'encadrants", st.libelleCompte);
            for (int c = 0; c < colonnes.size(); c++) {
                cellule(compte, NB_COLONNES_FIXES + c, colonnes.get(c).niveau(),
                        colonnes.get(c).autonomes() ? st.cadre : st.niveauEncadrant);
            }
            cellule(compte, obs, "", st.cadre);

            int ligne = derniereLigneLieux + 3;
            for (int i = 0; i < f.nbLignesAffichees(); i++) {
                FeuilleSecurite.Ligne l = i < f.lignes().size() ? f.lignes().get(i) : null;
                Row row = ligne(feuille, ligne++, 20);
                Cell numero = row.createCell(0);
                numero.setCellValue(i + 1);
                numero.setCellStyle(st.numero);
                cellule(row, 1, l == null ? "" : l.membre().getNom(), st.nom);
                cellule(row, 2, l == null ? "" : l.membre().getPrenom(), st.prenom);
                cellule(row, 3, l == null ? "" : l.niveau(), st.niveau);
                cellule(row, 4, l == null ? "" : l.aptitudeDp(), st.centre);
                for (int c = 0; c < colonnes.size(); c++) {
                    cellule(row, NB_COLONNES_FIXES + c, l == null ? "" : l.cases().get(c),
                            c % 2 == 0 ? st.caseBleue : st.caseBlanche);
                }
                cellule(row, obs, l == null ? "" : l.observations(), st.observation);
            }

            for (int t = 0; t < f.tours().size(); t++) {
                ligne = blocTour(feuille, ligne, f, t, st);
            }
            Row pied = feuille.createRow(ligne + 1);
            cellule(pied, 0, "Fiche à conserver un an par l'établissement (article A322-72 du Code du sport).", null);

            feuille.setColumnWidth(0, 12 * 256);
            feuille.setColumnWidth(1, 24 * 256);
            feuille.setColumnWidth(2, 18 * 256);
            feuille.setColumnWidth(3, 7 * 256);
            feuille.setColumnWidth(4, 9 * 256);
            for (int c = 0; c < colonnes.size(); c++) {
                feuille.setColumnWidth(NB_COLONNES_FIXES + c, 8 * 256);
            }
            feuille.setColumnWidth(obs, 34 * 256);
            placerLogo(classeur, feuille);

            // A4 paysage (demande du club, 2026), toute la feuille sur une page.
            feuille.getPrintSetup().setPaperSize(PrintSetup.A4_PAPERSIZE);
            feuille.getPrintSetup().setLandscape(true);
            feuille.setFitToPage(true);
            feuille.getPrintSetup().setFitWidth((short) 1);
            feuille.getPrintSetup().setFitHeight((short) 1);
            classeur.setPrintArea(0, 0, obs, 0, ligne + 1);
        }
        return classeur;
    }

    /** Les six lignes d'un tour (prévu, heures, réalisé), le nom du tour fusionné à gauche. */
    private int blocTour(Sheet feuille, int debut, FeuilleSecurite f, int t, Styles st) {
        String n = t == 0 ? "1er" : "2e";
        record LigneTour(String libelle, boolean gris, Function<Palanquee, Object> valeur) {}
        List<LigneTour> lignes = List.of(
                new LigneTour("Prof prévue", true, Palanquee::getProfondeurPrevue),
                new LigneTour("Durée prévue", true, Palanquee::getDureePrevue),
                new LigneTour("Heure de départ", false, p -> heure(p.getHeureImmersion())),
                new LigneTour("Heure de sortie", false, p -> heure(p.getHeureSortie())),
                new LigneTour("Prof", true, Palanquee::getProfondeurRealisee),
                new LigneTour("Durée", true, Palanquee::getDureeRealisee));
        int ligne = debut;
        for (LigneTour l : lignes) {
            Row row = ligne(feuille, ligne, 16);
            CellStyle fond = !l.gris() ? st.caseBlanche : t == 0 ? st.caseGrise : st.caseGriseFoncee;
            CellStyle fondPair = !l.gris() ? st.caseBleue : t == 0 ? st.caseBleueGrise : st.caseBleueGriseFoncee;
            fusion(feuille, ligne, ligne, 1, 4, l.libelle() + " " + n + " T",
                    !l.gris() ? st.libelleTour : t == 0 ? st.libelleTourGris : st.libelleTourGrisFonce);
            for (int c = 0; c < f.colonnes().size(); c++) {
                Palanquee p = f.colonnes().get(c).parTour().get(t);
                Object v = p == null ? null : l.valeur().apply(p);
                Cell cell = row.createCell(NB_COLONNES_FIXES + c);
                if (v instanceof Integer i) cell.setCellValue(i);
                else cell.setCellValue(v == null ? "" : v.toString());
                cell.setCellStyle(c % 2 == 0 ? fondPair : fond);
            }
            cellule(row, NB_COLONNES_FIXES + f.colonnes().size(), "", fond);
            ligne++;
        }
        fusion(feuille, debut, ligne - 1, 0, 0, t == 0 ? "1er tour\nou\nmatin" : "2e tour",
                t == 0 ? st.nomTour : st.nomTourFonce);
        return ligne;
    }

    /** Le site de la plongée de ce tour, sinon son lieu ; vide s'il n'y a pas de 2e plongée. */
    private static String lieu(FeuilleSecurite f, int tour) {
        if (tour >= f.tours().size()) return "";
        Seance s = f.tours().get(tour).getSeance();
        return s.getSite() == null || s.getSite().isBlank() ? texte(s.getLieu()) : s.getSite();
    }

    /** Côté du logo carré, en pixels : à peu près la hauteur des deux lignes de lieux. */
    private static final int TAILLE_LOGO_PX = 72;
    private static final int EMU_PAR_PIXEL = 9525;

    /** Logo dans la case fusionnée sous la date (colonne A, lignes des lieux), comme le modèle. */
    private void placerLogo(Workbook classeur, Sheet feuille) {
        int indexImage = classeur.addPicture(identite.logoPng(), Workbook.PICTURE_TYPE_PNG);
        ClientAnchor ancre = classeur.getCreationHelper().createClientAnchor();
        ancre.setAnchorType(ClientAnchor.AnchorType.MOVE_DONT_RESIZE);
        int largeur = Math.round(feuille.getColumnWidthInPixels(0));
        int cote = Math.min(TAILLE_LOGO_PX, largeur - 4);
        ancre.setCol1(0);
        ancre.setDx1(2 * EMU_PAR_PIXEL);
        ancre.setRow1(1);
        ancre.setDy1(2 * EMU_PAR_PIXEL);
        ancre.setCol2(0);
        ancre.setDx2((2 + cote) * EMU_PAR_PIXEL);
        int hauteurLigne = Math.round(feuille.getRow(1).getHeightInPoints() * 96 / 72);
        ancre.setRow2(cote + 2 > hauteurLigne ? 2 : 1);
        ancre.setDy2((cote + 2 > hauteurLigne ? cote + 2 - hauteurLigne : cote + 2) * EMU_PAR_PIXEL);
        feuille.createDrawingPatriarch().createPicture(ancre, indexImage);
    }

    private static Row ligne(Sheet feuille, int index, float hauteur) {
        Row row = feuille.createRow(index);
        row.setHeightInPoints(hauteur);
        return row;
    }

    private static void cellule(Row row, int colonne, String valeur, CellStyle style) {
        Cell cell = row.getCell(colonne) == null ? row.createCell(colonne) : row.getCell(colonne);
        cell.setCellValue(valeur == null ? "" : valeur);
        if (style != null) cell.setCellStyle(style);
    }

    /** Une zone fusionnée encadrée, sa valeur dans la première case. */
    private static void fusion(Sheet feuille, int l1, int l2, int c1, int c2, String valeur, CellStyle style) {
        for (int l = l1; l <= l2; l++) {
            Row row = feuille.getRow(l) == null ? feuille.createRow(l) : feuille.getRow(l);
            for (int c = c1; c <= c2; c++) cellule(row, c, l == l1 && c == c1 ? valeur : "", style);
        }
        if (l1 != l2 || c1 != c2) {
            CellRangeAddress zone = new CellRangeAddress(l1, l2, c1, c2);
            feuille.addMergedRegion(zone);
            RegionUtil.setBorderTop(BorderStyle.THIN, zone, feuille);
            RegionUtil.setBorderBottom(BorderStyle.THIN, zone, feuille);
            RegionUtil.setBorderLeft(BorderStyle.THIN, zone, feuille);
            RegionUtil.setBorderRight(BorderStyle.THIN, zone, feuille);
        }
    }

    private static String heure(LocalTime t) {
        return t == null ? "" : t.format(HEURE);
    }

    private static String texte(String s) {
        return s == null ? "" : s;
    }

    /** Les styles du modèle : polices, couleurs et fonds repris du classeur du club. */
    private static final class Styles {
        final XSSFCellStyle cadre, centre, etiquette, etiquetteCentree, titre, nomColonne, prenomColonne,
                observationsColonne, rotee, roteeNoire, roteeEncadrant, compte, libelleCompte, niveauEncadrant, numero, nom, prenom,
                niveau, observation, caseBleue, caseBlanche, caseGrise, caseGriseFoncee, caseBleueGrise,
                caseBleueGriseFoncee, libelleTour, libelleTourGris, libelleTourGrisFonce, nomTour, nomTourFonce;
        private final XSSFWorkbook classeur;

        Styles(XSSFWorkbook classeur) {
            this.classeur = classeur;
            cadre = style(police(false, 10, null, false), null);
            centre = centre(style(police(false, 10, null, false), null));
            etiquette = style(police(true, 12, BLEU, true), null);
            etiquette.setVerticalAlignment(VerticalAlignment.TOP);
            etiquette.setWrapText(true);
            etiquetteCentree = centre(style(police(true, 12, BLEU, true), null));
            etiquetteCentree.setVerticalAlignment(VerticalAlignment.TOP);
            etiquetteCentree.setWrapText(true);
            titre = style(police(true, 20, BLEU, true), null);
            titre.setWrapText(true);
            nomColonne = centre(style(police(true, 18, BLEU, false), null));
            prenomColonne = style(police(true, 12, BLEU, false), null);
            prenomColonne.setVerticalAlignment(VerticalAlignment.CENTER);
            observationsColonne = centre(style(police(true, 10, BLEU, true), null));
            observationsColonne.setVerticalAlignment(VerticalAlignment.BOTTOM);
            // Sans trait à gauche : il couperait la dernière barre penchée, qui déborde sur cette case.
            observationsColonne.setBorderLeft(BorderStyle.NONE);
            rotee = tourne(style(police(true, 10, BLEU, true), null));
            roteeNoire = tourne(style(police(true, 11, null, false), null));
            roteeEncadrant = tourne(style(police(true, 11, null, false), JAUNE));
            compte = centre(style(police(true, 14, ROUGE, true), null));
            libelleCompte = style(police(true, 10, BLEU, true), null);
            niveauEncadrant = centre(style(police(true, 8, null, false), JAUNE));
            numero = centre(style(police(false, 12, BLEU, true), null));
            nom = style(police(true, 11, null, false), null);
            prenom = style(police(false, 10, null, false), null);
            niveau = centre(style(police(true, 9, null, false), null));
            observation = centre(style(police(true, 7, null, true), null));
            observation.setWrapText(true);
            caseBleue = centre(style(police(true, 10, null, false), BLEU_CLAIR));
            caseBlanche = centre(style(police(true, 10, null, false), null));
            caseGrise = centre(style(police(true, 10, null, false), GRIS));
            caseGriseFoncee = centre(style(police(true, 10, null, false), GRIS_FONCE));
            caseBleueGrise = centre(style(police(true, 10, null, false), BLEU_GRIS));
            caseBleueGriseFoncee = centre(style(police(true, 10, null, false), BLEU_GRIS_FONCE));
            libelleTour = centre(style(police(true, 12, BLEU, true), null));
            libelleTourGris = centre(style(police(true, 12, BLEU, true), GRIS));
            libelleTourGrisFonce = centre(style(police(true, 12, BLEU, true), GRIS_FONCE));
            nomTour = centre(style(police(false, 8, BLEU, true), GRIS));
            nomTour.setWrapText(true);
            nomTourFonce = centre(style(police(false, 8, BLEU, true), GRIS_FONCE));
            nomTourFonce.setWrapText(true);
        }

        private XSSFFont police(boolean gras, int taille, byte[] couleur, boolean serif) {
            XSSFFont p = classeur.createFont();
            p.setBold(gras);
            p.setFontHeightInPoints((short) taille);
            p.setFontName(serif ? "Times New Roman" : "Arial");
            if (couleur != null) p.setColor(new XSSFColor(couleur, null));
            return p;
        }

        private XSSFCellStyle style(XSSFFont police, byte[] fond) {
            XSSFCellStyle s = classeur.createCellStyle();
            s.setFont(police);
            s.setBorderTop(BorderStyle.THIN);
            s.setBorderBottom(BorderStyle.THIN);
            s.setBorderLeft(BorderStyle.THIN);
            s.setBorderRight(BorderStyle.THIN);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            if (fond != null) {
                s.setFillForegroundColor(new XSSFColor(fond, null));
                s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            return s;
        }

        private static XSSFCellStyle centre(XSSFCellStyle s) {
            s.setAlignment(HorizontalAlignment.CENTER);
            return s;
        }

        private static XSSFCellStyle tourne(XSSFCellStyle s) {
            s.setRotation((short) 45);
            s.setVerticalAlignment(VerticalAlignment.BOTTOM);
            return s;
        }
    }
}
