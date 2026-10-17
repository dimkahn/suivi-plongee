package fr.club.plongee.formation.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le PDF de la fiche est la feuille Excel redessinée en HTML : fusions,
 * fonds, polices, nombres et libellés tournés doivent s'y retrouver.
 */
class ClasseurHtmlTest {

    @Test
    void reprendFusionsFondsEtPolices() throws Exception {
        try (XSSFWorkbook classeur = new XSSFWorkbook()) {
            XSSFSheet feuille = classeur.createSheet("f");
            XSSFCellStyle jaune = classeur.createCellStyle();
            jaune.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xff, (byte) 0xff, 0}, null));
            jaune.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont gras = classeur.createFont();
            gras.setBold(true);
            gras.setColor(new XSSFColor(new byte[]{0x11, 0x11, (byte) 0xd3}, null));
            jaune.setFont(gras);
            Row r0 = feuille.createRow(0);
            r0.createCell(0).setCellValue("Titre fusionné");
            r0.getCell(0).setCellStyle(jaune);
            feuille.addMergedRegion(new CellRangeAddress(0, 0, 0, 2));
            Row r1 = feuille.createRow(1);
            r1.createCell(0).setCellValue(20);
            r1.createCell(1).setCellValue("ligne 1\nligne 2");
            classeur.setPrintArea(0, 0, 2, 0, 1);

            String html = ClasseurHtml.page(feuille);

            assertThat(html).contains("colspan=\"3\"", "Titre fusionné", "background: #ffff00", "color: #1111d3",
                    "font-weight: bold", ">20<", "ligne 1<br/>ligne 2");
        }
    }

    @Test
    void dessineLesLibellesTournesEnParallelogrammes() throws Exception {
        try (XSSFWorkbook classeur = new XSSFWorkbook()) {
            XSSFSheet feuille = classeur.createSheet("f");
            CellStyle tourne = classeur.createCellStyle();
            tourne.setRotation((short) 45);
            tourne.setBorderLeft(BorderStyle.THIN);
            Row r0 = feuille.createRow(0);
            r0.createCell(0).setCellValue("Hubert Gérard");
            r0.getCell(0).setCellStyle(tourne);
            classeur.setPrintArea(0, 0, 0, 0, 0);

            String html = ClasseurHtml.page(feuille);

            assertThat(html).contains("class=\"parallelogramme\"", "class=\"tourne\"", "Hubert Gérard");
        }
    }
}
