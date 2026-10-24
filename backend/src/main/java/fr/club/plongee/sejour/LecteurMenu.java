package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Lit le menu d'un restaurant dans un classeur Excel (.xlsx ou .xls), au
 * format du prompt donné par l'écran : sur la première feuille, une ligne
 * d'en-tête « Catégorie | Plat | Description | Prix » (dans cet ordre ou
 * non, accents et majuscules indifférents), puis une ligne par plat. Seule
 * la colonne « Plat » est obligatoire ; les lignes sans plat sont ignorées.
 * Calcul pur, sans base.
 */
public final class LecteurMenu {

    /** Un plat lu, dans l'ordre du fichier ; prix en centimes, null s'il n'est pas indiqué ou illisible. */
    public record PlatLu(String categorie, String nom, String description, Integer prixCentimes) {}

    static final int PLATS_MAX = 300;
    private static final int LIGNES_AVANT_EN_TETE = 20;

    private LecteurMenu() {}

    public static List<PlatLu> lire(byte[] contenu) {
        try (Workbook classeur = WorkbookFactory.create(new ByteArrayInputStream(contenu))) {
            return lire(classeur.getSheetAt(0));
        } catch (RegleMetierException e) {
            throw e;
        } catch (Exception | LinkageError e) {
            throw new RegleMetierException("Ce fichier n'est pas un classeur Excel lisible (.xlsx ou .xls).");
        }
    }

    private static List<PlatLu> lire(Sheet feuille) {
        DataFormatter format = new DataFormatter(Locale.FRANCE);
        int ligneEnTete = -1, categorie = -1, plat = -1, description = -1, prix = -1;
        for (int i = feuille.getFirstRowNum(); i <= Math.min(feuille.getLastRowNum(), LIGNES_AVANT_EN_TETE) && plat < 0; i++) {
            Row r = feuille.getRow(i);
            if (r == null) continue;
            int c = -1, p = -1, d = -1, x = -1;
            for (Cell cellule : r) {
                String titre = simplifier(format.formatCellValue(cellule));
                int j = cellule.getColumnIndex();
                if (titre.startsWith("categ") && c < 0) c = j;
                else if ((titre.startsWith("plat") || titre.startsWith("nom du plat")) && p < 0) p = j;
                else if (titre.startsWith("descr") && d < 0) d = j;
                else if (titre.startsWith("prix") && x < 0) x = j;
            }
            if (p >= 0) {
                ligneEnTete = i;
                categorie = c;
                plat = p;
                description = d;
                prix = x;
            }
        }
        if (plat < 0) {
            throw new RegleMetierException("Le fichier n'a pas de colonne « Plat » : utilisez le prompt proposé pour le fabriquer.");
        }
        List<PlatLu> plats = new ArrayList<>();
        for (int i = ligneEnTete + 1; i <= feuille.getLastRowNum(); i++) {
            Row r = feuille.getRow(i);
            if (r == null) continue;
            String nom = texte(r, plat, format, 300);
            if (nom == null) continue;
            if (plats.size() == PLATS_MAX) {
                throw new RegleMetierException("Le menu a plus de " + PLATS_MAX + " plats : est-ce bien le bon fichier ?");
            }
            plats.add(new PlatLu(texte(r, categorie, format, 100), nom, texte(r, description, format, 1000),
                    prix(r, prix, format)));
        }
        if (plats.isEmpty()) throw new RegleMetierException("Le fichier n'a aucun plat sous la ligne d'en-tête.");
        return plats;
    }

    private static String texte(Row r, int colonne, DataFormatter format, int longueurMax) {
        if (colonne < 0 || r.getCell(colonne) == null) return null;
        String t = format.formatCellValue(r.getCell(colonne)).strip();
        if (t.isEmpty()) return null;
        return t.length() > longueurMax ? t.substring(0, longueurMax) : t;
    }

    /** « 12,50 € », « 12.5 » ou une cellule nombre ; illisible : pas de prix plutôt qu'un refus. */
    static Integer prix(Row r, int colonne, DataFormatter format) {
        if (colonne < 0 || r.getCell(colonne) == null) return null;
        Cell cellule = r.getCell(colonne);
        CellType type = cellule.getCellType() == CellType.FORMULA ? cellule.getCachedFormulaResultType() : cellule.getCellType();
        BigDecimal euros;
        if (type == CellType.NUMERIC) {
            euros = BigDecimal.valueOf(cellule.getNumericCellValue());
        } else {
            String t = format.formatCellValue(cellule).replaceAll("[€\\s\\u00a0\\u202f]|EUR", "").replace(',', '.');
            if (!t.matches("\\d+(\\.\\d+)?")) return null;
            euros = new BigDecimal(t);
        }
        if (euros.signum() < 0 || euros.compareTo(BigDecimal.valueOf(100_000)) > 0) return null;
        return euros.movePointRight(2).setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    private static String simplifier(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).strip();
    }
}
