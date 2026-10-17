package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.FicheSecurite;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

/**
 * Génère la fiche de sécurité en PDF, pour l'impression ou l'archivage exigé
 * un an par l'article A322-72. Le PDF est la feuille de l'export Excel
 * ({@link FicheSecuriteExcelService}, modèle papier du club « Martinique
 * 2026 ») redessinée par {@link ClasseurHtml} : une seule mise en page, le
 * PDF ne peut pas s'écarter de l'Excel.
 */
@Service
public class FicheSecuritePdfService {

    public record FichePdf(byte[] contenu, String nomFichier) {}

    private final FicheSecuriteExcelService excel;

    public FicheSecuritePdfService(FicheSecuriteExcelService excel) {
        this.excel = excel;
    }

    /** Une feuille : une plongée, ou deux du même jour (1er et 2e tour). */
    public FichePdf generer(List<FicheSecurite> tours) {
        return new FichePdf(rendre(document(List.of(page(tours)))),
                "fiche-securite-%s.pdf".formatted(tours.get(0).getSeance().getDateSeance()));
    }

    /**
     * Plusieurs fiches (une journée, une sortie) dans un seul PDF, dans
     * l'ordre donné, pour les imprimer d'un coup avant le départ ou les
     * archiver ensemble. {@code regrouper} : celles d'un même jour et d'un
     * même lieu par deux sur une page ({@link FeuilleSecurite#regrouper}) ;
     * sinon une page par plongée.
     */
    public FichePdf genererPlusieurs(List<FicheSecurite> fiches, String nomFichier, boolean regrouper) {
        List<List<FicheSecurite>> feuilles = regrouper ? FeuilleSecurite.regrouper(fiches)
                : fiches.stream().map(List::of).toList();
        return new FichePdf(rendre(document(feuilles.stream().map(this::page).toList())), nomFichier);
    }

    private String page(List<FicheSecurite> tours) {
        try (XSSFWorkbook classeur = excel.classeur(tours)) {
            return ClasseurHtml.page(classeur.getSheetAt(0));
        } catch (IOException e) {
            throw new IllegalStateException("Échec de la génération du PDF de la fiche de sécurité", e);
        }
    }

    private byte[] rendre(String html) {
        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        try {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(sortie);
            builder.run();
        } catch (IOException e) {
            throw new IllegalStateException("Échec de la génération du PDF de la fiche de sécurité", e);
        }
        return sortie.toByteArray();
    }

    /** Enveloppe commune (styles, format de page) autour d'une ou plusieurs feuilles, une par page. */
    private String document(List<String> pages) {
        StringBuilder corps = new StringBuilder();
        for (String page : pages) {
            corps.append("<div class=\"page\">").append(page).append("</div>");
        }
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="UTF-8"/>
              <style>%s</style>
            </head>
            <body>%s</body>
            </html>
            """.formatted(ClasseurHtml.CSS, corps);
    }
}
