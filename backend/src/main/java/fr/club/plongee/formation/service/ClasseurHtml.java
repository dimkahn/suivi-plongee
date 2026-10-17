package fr.club.plongee.formation.service;

import org.apache.poi.ss.SpreadsheetVersion;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.util.AreaReference;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFPicture;
import org.apache.poi.xssf.usermodel.XSSFRichTextString;
import org.apache.poi.xssf.usermodel.XSSFShape;
import org.apache.poi.xssf.usermodel.XSSFSheet;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Redessine une feuille Excel en tableau HTML, pour que le PDF de la fiche
 * de sécurité soit la même feuille que l'Excel (choix du club, 2026) :
 * largeurs et hauteurs, fusions, polices, couleurs, fonds, bordures,
 * alignements, retours à la ligne, images (le logo). Comme l'impression
 * d'Excel « ajustée à une page », la zone d'impression est réduite d'un même
 * facteur pour tenir sur une page A4 portrait.
 * <p>
 * Les cases tournées à 45° sont dessinées comme dans un tableur : un
 * parallélogramme penché (fond et bordures de la case) et le texte en
 * diagonale (classes {@code parallelogramme} et {@code tourne}, voir
 * {@link #CSS}).
 */
public final class ClasseurHtml {

    /** Surface utile d'une page A4 portrait aux marges de {@link #CSS}, en points. */
    static final double LARGEUR_PAGE_PT = 555;
    static final double HAUTEUR_PAGE_PT = 790;
    private static final double EMU_PAR_POINT = 12700;

    /** Styles communs aux pages produites par {@link #page}, à mettre dans le {@code <style>} du document. */
    public static final String CSS = """
            @page { size: A4 portrait; margin: 0.7cm 0.8cm; }
            body { margin: 0; }
            table.classeur { border-collapse: collapse; table-layout: fixed; }
            table.classeur td { padding: 0 1.5pt; overflow: visible; }
            td.case-tournee { position: relative; }
            .parallelogramme {
              position: absolute; left: 0; bottom: 0; width: 100%; box-sizing: border-box;
              transform: skewX(-45deg); transform-origin: left bottom;
            }
            .tourne {
              position: absolute; z-index: 2; display: block; white-space: nowrap;
              transform: rotate(-45deg); transform-origin: left bottom;
            }
            .ancre { position: relative; }
            .ancre img { position: absolute; }
            .page + .page { page-break-before: always; }
            """;

    private ClasseurHtml() {}

    /** La zone d'impression de la feuille (sinon ses cases remplies), en tableau HTML. */
    public static String page(XSSFSheet feuille) {
        int[] zone = zone(feuille);
        int l1 = zone[0], c1 = zone[1], l2 = zone[2], c2 = zone[3];

        double[] largeurs = new double[c2 - c1 + 1];
        double largeurTotale = 0;
        for (int c = c1; c <= c2; c++) {
            largeurs[c - c1] = feuille.getColumnWidthInPixels(c) * 0.75;
            largeurTotale += largeurs[c - c1];
        }
        double[] hauteurs = new double[l2 - l1 + 1];
        double hauteurTotale = 0;
        for (int l = l1; l <= l2; l++) {
            Row row = feuille.getRow(l);
            hauteurs[l - l1] = row == null ? feuille.getDefaultRowHeightInPoints() : row.getHeightInPoints();
            hauteurTotale += hauteurs[l - l1];
        }
        double echelle = Math.min(1, Math.min(LARGEUR_PAGE_PT / largeurTotale, HAUTEUR_PAGE_PT / hauteurTotale));

        Map<String, CellRangeAddress> fusions = new HashMap<>();
        Set<String> couvertes = new HashSet<>();
        for (CellRangeAddress r : feuille.getMergedRegions()) {
            fusions.put(r.getFirstRow() + ":" + r.getFirstColumn(), r);
            for (int l = r.getFirstRow(); l <= r.getLastRow(); l++) {
                for (int c = r.getFirstColumn(); c <= r.getLastColumn(); c++) {
                    if (l != r.getFirstRow() || c != r.getFirstColumn()) couvertes.add(l + ":" + c);
                }
            }
        }
        Map<String, List<String>> images = images(feuille, largeurs, c1, echelle);

        StringBuilder html = new StringBuilder("<table class=\"classeur\" style=\"width: %s\"><colgroup>"
                .formatted(pt(largeurTotale * echelle)));
        for (double l : largeurs) html.append("<col style=\"width: %s\"/>".formatted(pt(l * echelle)));
        html.append("</colgroup>");
        DataFormatter formateur = new DataFormatter(Locale.FRANCE);
        for (int l = l1; l <= l2; l++) {
            html.append("<tr style=\"height: %s\">".formatted(pt(hauteurs[l - l1] * echelle)));
            Row row = feuille.getRow(l);
            for (int c = c1; c <= c2; c++) {
                if (couvertes.contains(l + ":" + c)) continue;
                CellRangeAddress fusion = fusions.get(l + ":" + c);
                XSSFCell cell = row == null ? null : (XSSFCell) row.getCell(c);
                html.append(cellule(feuille, cell, fusion, l, c, echelle, hauteurs[l - l1] * echelle, formateur,
                        images.getOrDefault(l + ":" + c, List.of())));
            }
            html.append("</tr>");
        }
        return html.append("</table>").toString();
    }

    private static String cellule(XSSFSheet feuille, XSSFCell cell, CellRangeAddress fusion, int l, int c,
                                  double echelle, double hauteur, DataFormatter formateur, List<String> images) {
        String etendue = fusion == null ? "" : "%s%s".formatted(
                fusion.getLastColumn() > c ? " colspan=\"%d\"".formatted(fusion.getLastColumn() - c + 1) : "",
                fusion.getLastRow() > l ? " rowspan=\"%d\"".formatted(fusion.getLastRow() - l + 1) : "");
        XSSFCellStyle style = cell == null ? null : cell.getCellStyle();
        String texte = cell == null ? "" : texte(cell, formateur, echelle);
        String contenuImages = images.isEmpty() ? "" : "<div class=\"ancre\">" + String.join("", images) + "</div>";
        if (style == null) {
            return "<td%s>%s%s</td>".formatted(etendue, contenuImages, texte);
        }
        int dl = fusion == null ? l : fusion.getLastRow();
        int dc = fusion == null ? c : fusion.getLastColumn();
        String haut = bordure(style.getBorderTop());
        String gauche = bordure(style.getBorderLeft());
        String droite = bordure(styleDe(feuille, l, dc, style).getBorderRight());
        String bas = bordure(styleDe(feuille, dl, c, style).getBorderBottom());
        String fond = fond(style);
        String police = police(style.getFont(), echelle);

        if (style.getRotation() == 45) {
            // Comme un tableur : la case penche vers la droite, le texte suit la diagonale.
            // Hauteurs en points : le moteur PDF ne place pas un bloc absolu dans une case de hauteur implicite.
            return ("<td%s class=\"case-tournee\" style=\"height: %s; border-top: none; border-left: none; border-right: none;"
                    + " border-bottom: %s; vertical-align: bottom\">"
                    + "<div class=\"parallelogramme\" style=\"height: %s; border-left: %s; border-right: %s;%s\"></div>"
                    + "<span class=\"tourne\" style=\"left: 35%%; bottom: 2pt; %s\">%s</span></td>")
                    .formatted(etendue, pt(hauteur), bas, pt(hauteur), gauche, droite, fond, police, texte);
        }
        String alignement = switch (style.getAlignment()) {
            case CENTER, CENTER_SELECTION -> "center";
            case RIGHT -> "right";
            case GENERAL -> cell.getCellType() == CellType.NUMERIC ? "right" : "left";
            default -> "left";
        };
        String vertical = switch (style.getVerticalAlignment()) {
            case TOP -> "top";
            case CENTER, JUSTIFY, DISTRIBUTED -> "middle";
            default -> "bottom";
        };
        return "<td%s style=\"border-top: %s; border-left: %s; border-right: %s; border-bottom: %s;%s text-align: %s; vertical-align: %s; white-space: %s; %s\">%s%s</td>"
                .formatted(etendue, haut, gauche, droite, bas, fond, alignement, vertical,
                        style.getWrapText() ? "normal" : "nowrap", police, contenuImages, texte);
    }

    /** Le style de la case qui porte une bordure d'une zone fusionnée (bas ou droite), sinon celui de la première. */
    private static XSSFCellStyle styleDe(XSSFSheet feuille, int l, int c, XSSFCellStyle parDefaut) {
        Row row = feuille.getRow(l);
        Cell cell = row == null ? null : row.getCell(c);
        return cell == null ? parDefaut : (XSSFCellStyle) cell.getCellStyle();
    }

    /** Le texte affiché, avec les polices des passages d'un texte enrichi (« 1er T » en rouge…). */
    private static String texte(XSSFCell cell, DataFormatter formateur, double echelle) {
        if (cell.getCellType() == CellType.STRING) {
            XSSFRichTextString riche = cell.getRichStringCellValue();
            String brut = riche.getString();
            if (riche.numFormattingRuns() > 0) {
                StringBuilder html = new StringBuilder();
                int debutPremier = riche.getIndexOfFormattingRun(0);
                if (debutPremier > 0) html.append(echapper(brut.substring(0, debutPremier)));
                for (int i = 0; i < riche.numFormattingRuns(); i++) {
                    int debut = riche.getIndexOfFormattingRun(i);
                    int fin = debut + riche.getLengthOfFormattingRun(i);
                    XSSFFont font = riche.getFontOfFormattingRun(i);
                    String morceau = echapper(brut.substring(debut, Math.min(fin, brut.length())));
                    html.append(font == null ? morceau
                            : "<span style=\"%s\">%s</span>".formatted(police(font, echelle), morceau));
                }
                return html.toString();
            }
            return echapper(brut);
        }
        return echapper(formateur.formatCellValue(cell));
    }

    private static String police(XSSFFont font, double echelle) {
        if (font == null) return "";
        String nom = font.getFontName() == null ? "" : font.getFontName().toLowerCase(Locale.ROOT);
        String famille = nom.contains("times") || nom.contains("serif") && !nom.contains("sans") ? "Times, serif"
                : "Helvetica, Arial, sans-serif";
        XSSFColor couleur = font.getXSSFColor();
        return "font-family: %s; font-size: %s; font-weight: %s; font-style: %s; color: %s;".formatted(
                famille, pt(font.getFontHeightInPoints() * echelle), font.getBold() ? "bold" : "normal",
                font.getItalic() ? "italic" : "normal", couleur == null || couleur.getRGB() == null ? "#000000" : hex(couleur));
    }

    private static String fond(XSSFCellStyle style) {
        XSSFColor couleur = style.getFillForegroundXSSFColor();
        if (style.getFillPattern() == null || couleur == null || couleur.getRGB() == null) return "";
        return switch (style.getFillPattern()) {
            case NO_FILL -> "";
            default -> " background: %s;".formatted(hex(couleur));
        };
    }

    private static String bordure(BorderStyle b) {
        return switch (b) {
            case NONE -> "none";
            case MEDIUM, MEDIUM_DASHED, MEDIUM_DASH_DOT, MEDIUM_DASH_DOT_DOT -> "1.2pt solid #000";
            case THICK, DOUBLE -> "1.8pt solid #000";
            default -> "0.6pt solid #000";
        };
    }

    /**
     * Les images de la feuille (le logo), chacune dans la case de son coin
     * haut gauche, décalée et dimensionnée d'après son ancre.
     */
    private static Map<String, List<String>> images(XSSFSheet feuille, double[] largeurs, int c1, double echelle) {
        Map<String, List<String>> parCase = new HashMap<>();
        XSSFDrawing dessin = feuille.getDrawingPatriarch();
        if (dessin == null) return parCase;
        for (XSSFShape forme : dessin.getShapes()) {
            if (!(forme instanceof XSSFPicture image) || !(image.getAnchor() instanceof XSSFClientAnchor a)) continue;
            double gauche = a.getDx1() / EMU_PAR_POINT;
            double haut = a.getDy1() / EMU_PAR_POINT;
            double largeur = -gauche + a.getDx2() / EMU_PAR_POINT;
            for (int c = a.getCol1(); c < a.getCol2(); c++) largeur += largeurs[c - c1];
            double hauteur = -haut + a.getDy2() / EMU_PAR_POINT;
            for (int l = a.getRow1(); l < a.getRow2(); l++) {
                Row row = feuille.getRow(l);
                hauteur += row == null ? feuille.getDefaultRowHeightInPoints() : row.getHeightInPoints();
            }
            String donnees = Base64.getEncoder().encodeToString(image.getPictureData().getData());
            parCase.computeIfAbsent(a.getRow1() + ":" + a.getCol1(), k -> new ArrayList<>()).add(
                    "<img src=\"data:%s;base64,%s\" alt=\"\" style=\"left: %s; top: %s; width: %s; height: %s\"/>".formatted(
                            image.getPictureData().getMimeType(), donnees, pt(gauche * echelle), pt(haut * echelle),
                            pt(largeur * echelle), pt(hauteur * echelle)));
        }
        return parCase;
    }

    /** Lignes et colonnes de la zone d'impression (première ligne, première colonne, dernière ligne, dernière colonne). */
    private static int[] zone(XSSFSheet feuille) {
        String zone = feuille.getWorkbook().getPrintArea(feuille.getWorkbook().getSheetIndex(feuille));
        if (zone != null) {
            AreaReference ref = new AreaReference(zone.substring(zone.lastIndexOf('!') + 1), SpreadsheetVersion.EXCEL2007);
            return new int[]{ref.getFirstCell().getRow(), ref.getFirstCell().getCol(),
                    ref.getLastCell().getRow(), ref.getLastCell().getCol()};
        }
        int derniereColonne = 0;
        for (Row row : feuille) derniereColonne = Math.max(derniereColonne, row.getLastCellNum() - 1);
        return new int[]{0, 0, Math.max(0, feuille.getLastRowNum()), Math.max(0, derniereColonne)};
    }

    private static String hex(XSSFColor couleur) {
        byte[] rgb = couleur.getRGB();
        return "#%02x%02x%02x".formatted(rgb[0] & 0xff, rgb[1] & 0xff, rgb[2] & 0xff);
    }

    private static String pt(double valeur) {
        return String.format(Locale.ROOT, "%.2fpt", valeur);
    }

    private static String echapper(String texte) {
        return texte.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
                .replace("\n", "<br/>");
    }
}
