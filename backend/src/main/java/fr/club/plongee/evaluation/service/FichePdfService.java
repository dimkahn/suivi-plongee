package fr.club.plongee.evaluation.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import fr.club.plongee.formation.repository.PhotoEleveRepository;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * Génère la fiche de suivi d'un élève en PDF (chantier « export PDF ») : même
 * contenu que la grille consultée à l'écran, mise en page pour l'impression
 * ou l'archivage. Le rendu part d'un gabarit HTML plutôt que d'un
 * positionnement bas niveau, pour rester lisible et facile à faire évoluer.
 */
@Service
public class FichePdfService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Pattern NON_ALPHANUMERIQUE = Pattern.compile("[^A-Za-z0-9]+");

    public record FichePdf(byte[] contenu, String nomFichier) {}

    private final GrilleService grilles;
    private final PhotoEleveRepository photos;

    public FichePdfService(GrilleService grilles, PhotoEleveRepository photos) {
        this.grilles = grilles;
        this.photos = photos;
    }

    public FichePdf genererFiche(Long cursusId) {
        GrilleService.GrilleVue grille = grilles.grille(cursusId);
        String html = html(grille, photoEnDataUri(grille));

        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        try {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(sortie);
            builder.run();
        } catch (IOException e) {
            throw new IllegalStateException("Échec de la génération du PDF de la fiche de suivi", e);
        }

        return new FichePdf(sortie.toByteArray(), nomFichier(grille));
    }

    private String nomFichier(GrilleService.GrilleVue g) {
        String base = Normalizer.normalize(g.eleve(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        base = NON_ALPHANUMERIQUE.matcher(base).replaceAll("-").toLowerCase();
        return "fiche-%s-%s.pdf".formatted(base, g.niveau());
    }

    /**
     * {@code g.aPhoto()} porte deja la verification du consentement
     * (autorisation_image) et l'existence d'une photo, voir
     * {@link GrilleService#grille(Long)} : rien a revalider ici. openhtmltopdf
     * ne recupere aucune ressource externe, la photo est donc embarquee en
     * data URI plutot que servie par une URL.
     */
    private String photoEnDataUri(GrilleService.GrilleVue g) {
        if (!g.aPhoto()) return null;
        return photos.findById(g.eleveId())
                .map(p -> "data:%s;base64,%s".formatted(
                        p.getTypeContenu(), Base64.getEncoder().encodeToString(p.getContenu())))
                .orElse(null);
    }

    private String html(GrilleService.GrilleVue g, String photoDataUri) {
        StringBuilder blocs = new StringBuilder();
        String regroupementPrecedent = null;
        boolean premier = true;
        for (GrilleService.BlocVue bloc : g.blocs()) {
            // Le backend livre deja les blocs groupes par regroupement (etiquette
            // "Commun"/"PA20"/"PE40"...) : on insere juste un titre de section au
            // premier changement de valeur, pour un rendu identique a l'ecran.
            if (bloc.regroupement() != null
                    && (premier || !bloc.regroupement().equals(regroupementPrecedent))) {
                blocs.append("<div class=\"titre-groupe\">%s</div>".formatted(echapper(bloc.regroupement())));
            }
            regroupementPrecedent = bloc.regroupement();
            premier = false;
            blocs.append(blocHtml(bloc));
        }
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="UTF-8"/>
              <style>
                @page { size: A4; margin: 2cm; }
                body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #1c2d33; }
                h1 { font-size: 18pt; margin: 0 0 4pt; }
                .entete { display: table; width: 100%%; }
                .entete-photo, .entete-texte { display: table-cell; vertical-align: top; }
                .entete-photo { width: 60pt; padding-right: 12pt; }
                .entete-photo img { width: 60pt; height: 60pt; border-radius: 4pt; object-fit: cover; }
                .entete p { margin: 2pt 0; color: #4a6169; }
                .score { font-weight: bold; margin: 10pt 0; font-size: 11pt; }
                table { width: 100%%; border-collapse: collapse; margin-bottom: 12pt; }
                th, td { border: 1px solid #c7d3d6; padding: 4pt 6pt; text-align: left; font-size: 9pt; }
                th { background: #e7eef0; }
                .titre-groupe {
                  font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: .02em;
                  color: #1c5a6b; border-bottom: 1.5pt solid #1c5a6b; margin-top: 18pt; padding-bottom: 2pt;
                }
                .bloc-titre { font-size: 12pt; font-weight: bold; margin-top: 14pt; }
                .bloc-sous-titre { color: #4a6169; margin: 0 0 4pt; }
                .valide { color: #1c7a4d; font-weight: bold; margin: 2pt 0 6pt; }
                .pied { margin-top: 18pt; font-size: 8pt; color: #7c8b90; }
              </style>
            </head>
            <body>
              <h1>%s</h1>
              <div class="entete">
                %s
                <div class="entete-texte">
                  <p>Plongeur %s &#183; saison %s &#183; référentiel MFT %s</p>
                  <p>Statut du cursus : %s</p>
                  <p>%d séances bloc, %d séances nage%s</p>
                </div>
              </div>
              <p class="score">%d critères acquis sur %d</p>
              %s
              <p class="pied">Fiche générée le %s.</p>
            </body>
            </html>
            """.formatted(
                echapper(g.eleve()),
                photoDataUri == null ? "" : "<div class=\"entete-photo\"><img src=\"%s\" alt=\"\"/></div>".formatted(photoDataUri),
                echapper(g.niveau()), echapper(g.saison()), echapper(g.versionMft()),
                echapper(g.statut()),
                g.seancesBloc(), g.seancesNage(),
                g.seancesPlongee() > 0 ? ", %d plongées".formatted(g.seancesPlongee()) : "",
                g.criteresAcquis(), g.criteresTotal(), blocs,
                LocalDate.now().format(DATE));
    }

    private String blocHtml(GrilleService.BlocVue bloc) {
        StringBuilder lignes = new StringBuilder();
        for (GrilleService.CritereVue c : bloc.criteres()) {
            lignes.append("""
                <tr>
                  <td>%s</td>
                  <td>%s</td>
                  <td>%s</td>
                  <td>%s</td>
                </tr>
                """.formatted(
                    echapper(c.savoirFaire()),
                    libelleStatut(c.statut()),
                    c.le() == null ? "" : c.le().format(DATE),
                    echapper(c.parQui() == null ? "" : c.parQui())));
        }

        String validation = bloc.valide()
                ? "<p class=\"valide\">Validée le %s par %s</p>".formatted(
                        bloc.dateValidation() == null ? "" : bloc.dateValidation().format(DATE),
                        echapper(bloc.valideePar()))
                : "";

        return """
            <div class="bloc-titre">%s</div>
            <p class="bloc-sous-titre">%d / %d acquis</p>
            %s
            <table>
              <thead><tr><th>Savoir-faire</th><th>Statut</th><th>Date</th><th>Par qui</th></tr></thead>
              <tbody>%s</tbody>
            </table>
            """.formatted(echapper(bloc.intitule()),
                bloc.acquis(), bloc.total(), validation, lignes);
    }

    private String libelleStatut(String statut) {
        return switch (statut) {
            case "ACQUIS" -> "Acquis";
            case "EN_COURS" -> "En cours";
            default -> "Non abordé";
        };
    }

    private String echapper(String texte) {
        if (texte == null) return "";
        return texte.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
