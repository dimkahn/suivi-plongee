package fr.club.plongee.formation;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;

/**
 * Génère la fiche de sécurité en PDF, pour l'impression ou l'archivage exigé
 * un an par l'article A322-72. Même approche que {@code FichePdfService} :
 * gabarit HTML rendu par openhtmltopdf.
 */
@Service
public class FicheSecuritePdfService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH:mm");

    public record FichePdf(byte[] contenu, String nomFichier) {}

    /** Nom de la structure, en-tête obligatoire de la fiche (A322-72) : la fiche est un document de l'établissement. */
    private final String nomClub;

    public FicheSecuritePdfService(@Value("${app.club.nom}") String nomClub) {
        this.nomClub = nomClub;
    }

    public FichePdf generer(FicheSecurite fiche) {
        String html = html(fiche);

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

        Seance s = fiche.getSeance();
        return new FichePdf(sortie.toByteArray(),
                "fiche-securite-%s.pdf".formatted(s.getDateSeance()));
    }

    private String html(FicheSecurite f) {
        Seance s = f.getSeance();
        StringBuilder palanquees = new StringBuilder();
        for (Palanquee p : f.getPalanquees()) {
            palanquees.append(palanqueeHtml(p));
        }
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="UTF-8"/>
              <style>
                @page { size: A4 landscape; margin: 1.5cm; }
                body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #1c2d33; }
                h1 { font-size: 16pt; margin: 0 0 8pt; }
                .entete p { margin: 2pt 0; color: #4a6169; }
                .conditions { display: table; width: 100%%; margin: 8pt 0; }
                .conditions div { display: table-cell; padding-right: 10pt; }
                .titre-palanquee {
                  font-size: 11pt; font-weight: bold; margin-top: 12pt; color: #1c5a6b;
                  border-bottom: 1pt solid #1c5a6b; padding-bottom: 2pt;
                }
                .profil-palanquee { margin: 3pt 0 5pt; color: #4a6169; }
                table { width: 100%%; border-collapse: collapse; margin-bottom: 8pt; }
                th, td { border: 1px solid #c7d3d6; padding: 3pt 5pt; text-align: left; font-size: 8pt; }
                th { background: #e7eef0; }
                .bloc { margin-top: 10pt; }
                .bloc h2 { font-size: 10pt; margin: 0 0 2pt; }
                .bloc p { margin: 0; white-space: pre-wrap; }
                .pied { margin-top: 14pt; font-size: 7pt; color: #7c8b90; }
              </style>
            </head>
            <body>
              <h1>Fiche de sécurité</h1>
              <div class="entete">
                <p>%s</p>
                <p>%s &#183; %s &#183; %s%s</p>
                <p>Directeur de plongée : %s</p>
                <p>%d plongeur(s) &#183; %d palanquée(s)</p>
              </div>
              <div class="conditions">
                <div>Météo : %s</div>
                <div>État de la mer : %s</div>
                <div>Visibilité : %s</div>
                <div>Courant : %s</div>
                <div>Marée : %s</div>
                <div>Température de l'eau : %s</div>
              </div>
              %s
              <div class="bloc">
                <h2>Sécurité surface</h2>
                <p>%s</p>
              </div>
              <div class="bloc">
                <h2>Plan de secours</h2>
                <p>%s</p>
              </div>
              <div class="bloc">
                <h2>Observations</h2>
                <p>%s</p>
              </div>
              <p class="pied">Fiche à conserver un an par l'établissement (article A322-72 du Code du sport).</p>
            </body>
            </html>
            """.formatted(
                echapper(nomClub),
                s.getDateSeance().format(DATE),
                echapper(s.getLieu()),
                s.getMilieu() == Milieu.NATUREL ? "Milieu naturel" : "Milieu artificiel",
                s.getProfondeurMax() == null ? "" : " · %d m max".formatted(s.getProfondeurMax()),
                echapper(f.getDp().nomComplet()),
                f.getPalanquees().stream().mapToInt(p -> p.getMembres().size()).sum(),
                f.getPalanquees().size(),
                echapper(f.getMeteo()), echapper(f.getEtatMer()), echapper(f.getVisibilite()),
                echapper(f.getCourant()), echapper(f.getMaree()), echapper(f.getTemperatureEau()),
                palanquees,
                echapper(f.getSecuriteSurface()), echapper(f.getPlanSecours()), echapper(f.getObservations()));
    }

    private String palanqueeHtml(Palanquee p) {
        StringBuilder lignes = new StringBuilder();
        for (MembrePalanquee m : p.getMembres()) {
            lignes.append("""
                <tr>
                  <td>%s %s</td>
                  <td>%s</td>
                  <td>%s</td>
                  <td>%s</td>
                  <td>%s</td>
                </tr>
                """.formatted(
                    echapper(m.getPrenom()), echapper(m.getNom()),
                    libelleFonction(m.getFonction()), echapper(m.getAptitude()),
                    echapper(m.getGaz()), echapper(m.getMoyenDesaturation())));
        }
        return """
            <div class="titre-palanquee">Palanquée %d</div>
            <p class="profil-palanquee">
              Prévu : %s / %s &#183; Réalisé : %s / %s &#183; Paliers : %s &#183; Immersion / sortie : %s
            </p>
            <table>
              <thead>
                <tr>
                  <th>Plongeur</th><th>Fonction</th><th>Aptitude</th><th>Gaz</th><th>Désaturation</th>
                </tr>
              </thead>
              <tbody>%s</tbody>
            </table>
            """.formatted(p.getNumero(),
                profondeur(p.getProfondeurPrevue()), duree(p.getDureePrevue()),
                profondeur(p.getProfondeurRealisee()), duree(p.getDureeRealisee()),
                vide(p.getPaliers()), heures(p),
                lignes);
    }

    private String heures(Palanquee p) {
        String immersion = p.getHeureImmersion() == null ? "" : p.getHeureImmersion().format(HEURE);
        String sortie = p.getHeureSortie() == null ? "" : p.getHeureSortie().format(HEURE);
        if (immersion.isEmpty() && sortie.isEmpty()) return "";
        return immersion + " – " + sortie;
    }

    private String profondeur(Integer m) {
        return m == null ? "—" : m + " m";
    }

    private String duree(Integer min) {
        return min == null ? "—" : min + " min";
    }

    private String vide(String texte) {
        return texte == null || texte.isBlank() ? "—" : echapper(texte);
    }

    private String libelleFonction(FonctionPalanquee f) {
        return switch (f) {
            case GUIDE_PALANQUEE -> "Guide de palanquée";
            case ENCADRANT -> "Encadrant";
            case PLONGEUR -> "Plongeur";
        };
    }

    private String echapper(String texte) {
        if (texte == null) return "";
        return texte.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
