package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.*;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;

/**
 * Génère la fiche de sécurité en PDF, pour l'impression ou l'archivage exigé
 * un an par l'article A322-72. Reprend la mise en page du modèle papier du
 * club : les plongeurs en lignes, les palanquées en colonnes cochées d'une
 * croix, pour rester lisible à la volée sur le pont d'un bateau plutôt qu'en
 * fiches détaillées par palanquée.
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
        FicheSecuriteGrille grille = FicheSecuriteGrille.depuis(f);

        StringBuilder colonnesPalanquees = new StringBuilder();
        for (int numero : grille.numerosColonnes()) {
            colonnesPalanquees.append("<th>Palanquée %d</th>".formatted(numero));
        }

        StringBuilder lignesMembres = new StringBuilder();
        int ligne = 1;
        for (MembrePalanquee m : grille.membres()) {
            String classeLigne = grille.estEncadrant(m) ? " class=\"encadrant\"" : "";
            lignesMembres.append("<tr%s><td class=\"numero\">%d</td><td>%s</td><td>%s</td><td>%s</td>"
                    .formatted(classeLigne, ligne++, echapper(m.getNom()), echapper(m.getPrenom()), niveau(m)));
            for (int numero : grille.numerosColonnes()) {
                lignesMembres.append(grille.appartient(numero, m) ? "<td class=\"croix\">X</td>" : "<td></td>");
            }
            lignesMembres.append("<td>%s</td></tr>".formatted(vide(m.getObservations())));
        }
        for (; ligne <= grille.nbLignesAffichees(); ligne++) {
            lignesMembres.append("<tr><td class=\"numero\">%d</td><td></td><td></td><td></td>%s<td></td></tr>"
                    .formatted(ligne, "<td></td>".repeat(grille.numerosColonnes().size())));
        }

        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="UTF-8"/>
              <style>
                @page { size: A4 landscape; margin: 1.2cm; }
                body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #1c2d33; }
                .entete { display: table; width: 100%%; margin-bottom: 8pt; }
                .entete .bloc { display: table-cell; vertical-align: top; }
                .entete .titre { text-align: center; }
                .entete .titre h1 { font-size: 15pt; margin: 0; }
                .entete .titre .club { font-weight: bold; }
                .entete p { margin: 2pt 0; }
                table { width: 100%%; border-collapse: collapse; }
                th, td {
                  border: 1px solid #1c2d33; padding: 3pt 5pt; text-align: center; font-size: 8pt;
                }
                th { background: #e7eef0; }
                td.numero, th.numero { width: 16pt; }
                td:nth-child(2), td:nth-child(3) { text-align: left; }
                td.croix { font-weight: bold; }
                tr.encadrant td { background: #ffe680; }
                tfoot td { font-weight: bold; background: #f4f7f8; }
                tfoot td.libelle { text-align: left; }
                .pied { margin-top: 10pt; font-size: 7pt; color: #7c8b90; }
              </style>
            </head>
            <body>
              <div class="entete">
                <div class="bloc">
                  <p>Date : %s</p>
                  <p>Lieu : %s</p>
                  <p>Plongée n° : ____</p>
                </div>
                <div class="bloc titre">
                  <p class="club">%s</p>
                  <h1>FICHE DE SÉCURITÉ</h1>
                </div>
                <div class="bloc">
                  <p>Directeur de plongée :</p>
                  <p>%s</p>
                  <p>%s</p>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="numero">N°</th><th>Nom</th><th>Prénom</th><th>Niveau</th>
                    %s
                    <th>Observations</th>
                  </tr>
                </thead>
                <tbody>%s</tbody>
                <tfoot>
                  %s
                </tfoot>
              </table>
              <p class="pied">Fiche à conserver un an par l'établissement (article A322-72 du Code du sport).</p>
            </body>
            </html>
            """.formatted(
                s.getDateSeance().format(DATE),
                echapper(s.getLieu()),
                echapper(nomClub),
                echapper(f.getDp().nomComplet()),
                conditionsResumees(f),
                colonnesPalanquees,
                lignesMembres,
                lignesRecapitulatives(grille));
    }

    private String niveau(MembrePalanquee m) {
        String aptitude = vide(m.getAptitude());
        String qualification = m.getQualificationPreparee() == null || m.getQualificationPreparee().isBlank()
                ? "" : "<br/>" + echapper(m.getQualificationPreparee());
        return aptitude + qualification;
    }

    private String conditionsResumees(FicheSecurite f) {
        StringBuilder resume = new StringBuilder();
        ajouter(resume, "Météo", f.getMeteo());
        ajouter(resume, "Mer", f.getEtatMer());
        ajouter(resume, "Visi", f.getVisibilite());
        ajouter(resume, "Courant", f.getCourant());
        return resume.isEmpty() ? "" : resume.toString();
    }

    private void ajouter(StringBuilder resume, String libelle, String valeur) {
        if (valeur == null || valeur.isBlank()) return;
        if (!resume.isEmpty()) resume.append(" · ");
        resume.append(libelle).append(" : ").append(echapper(valeur));
    }

    private String lignesRecapitulatives(FicheSecuriteGrille grille) {
        int nbColonnesFixes = 4; // N°, Nom, Prénom, Niveau
        return ligneRecap("Prof prévue", grille, nbColonnesFixes, p -> profondeur(p.getProfondeurPrevue()))
                + ligneRecap("Durée prévue", grille, nbColonnesFixes, p -> duree(p.getDureePrevue()))
                + ligneRecap("Heure de départ", grille, nbColonnesFixes, p -> heure(p.getHeureImmersion()))
                + ligneRecap("Heure de sortie", grille, nbColonnesFixes, p -> heure(p.getHeureSortie()))
                + ligneRecap("Prof réalisée", grille, nbColonnesFixes, p -> profondeur(p.getProfondeurRealisee()))
                + ligneRecap("Durée réalisée", grille, nbColonnesFixes, p -> duree(p.getDureeRealisee()));
    }

    private String ligneRecap(String libelle, FicheSecuriteGrille grille, int nbColonnesFixes,
                              java.util.function.Function<Palanquee, String> valeur) {
        StringBuilder ligne = new StringBuilder("<tr><td class=\"libelle\" colspan=\"%d\">%s</td>"
                .formatted(nbColonnesFixes, libelle));
        for (int numero : grille.numerosColonnes()) {
            Palanquee p = grille.palanquee(numero);
            ligne.append("<td>%s</td>".formatted(p == null ? "" : valeur.apply(p)));
        }
        ligne.append("<td></td></tr>");
        return ligne.toString();
    }

    private String heure(java.time.LocalTime t) {
        return t == null ? "" : t.format(HEURE);
    }

    private String profondeur(Integer m) {
        return m == null ? "" : m + " m";
    }

    private String duree(Integer min) {
        return min == null ? "" : min + " min";
    }

    private String vide(String texte) {
        return texte == null || texte.isBlank() ? "" : echapper(texte);
    }

    private String echapper(String texte) {
        if (texte == null) return "";
        return texte.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    /**
     * Aplatit la fiche pour la présentation en grille (plongeurs en lignes,
     * palanquées en colonnes) : dédoublonne les membres présents dans
     * plusieurs sources et indexe leur appartenance par palanquée, partagée
     * entre le rendu PDF et le rendu Excel.
     */
    static final class FicheSecuriteGrille {
        /** Colonnes et lignes minimales du modèle papier du club, même si la fiche compte moins de plongeurs ou de palanquées. */
        private static final int NB_COLONNES_MIN = 7;
        private static final int NB_LIGNES_MIN = 15;

        private final java.util.List<Palanquee> palanquees;
        private final java.util.List<MembrePalanquee> membres;
        private final java.util.List<Integer> numerosColonnes;
        private final java.util.Map<Integer, Palanquee> palanqueesParNumero = new java.util.LinkedHashMap<>();

        private FicheSecuriteGrille(java.util.List<Palanquee> palanquees) {
            this.palanquees = palanquees;
            this.membres = new java.util.ArrayList<>();
            java.util.Set<String> vus = new java.util.HashSet<>();
            for (Palanquee p : palanquees) {
                palanqueesParNumero.put(p.getNumero(), p);
                for (MembrePalanquee m : p.getMembres()) {
                    if (vus.add(cle(m))) {
                        membres.add(m);
                    }
                }
            }

            int nbColonnes = Math.max(NB_COLONNES_MIN,
                    palanquees.stream().mapToInt(Palanquee::getNumero).max().orElse(0));
            this.numerosColonnes = new java.util.ArrayList<>();
            for (int i = 1; i <= nbColonnes; i++) {
                numerosColonnes.add(i);
            }
        }

        static FicheSecuriteGrille depuis(FicheSecurite f) {
            return new FicheSecuriteGrille(f.getPalanquees());
        }

        java.util.List<Palanquee> palanquees() {
            return palanquees;
        }

        java.util.List<MembrePalanquee> membres() {
            return membres;
        }

        java.util.List<Integer> numerosColonnes() {
            return numerosColonnes;
        }

        int nbLignesAffichees() {
            return Math.max(NB_LIGNES_MIN, membres.size());
        }

        Palanquee palanquee(int numero) {
            return palanqueesParNumero.get(numero);
        }

        boolean appartient(int numero, MembrePalanquee m) {
            Palanquee p = palanquee(numero);
            if (p == null) return false;
            String cleMembre = cle(m);
            for (MembrePalanquee candidat : p.getMembres()) {
                if (cle(candidat).equals(cleMembre)) return true;
            }
            return false;
        }

        /** Niveau d'encadrement (E1-E4) plutôt que de plongée : distingue les encadrants sur la fiche, comme sur le modèle papier. */
        boolean estEncadrant(MembrePalanquee m) {
            String aptitude = m.getAptitude();
            return aptitude != null && aptitude.trim().toUpperCase().matches("E[1-4]");
        }

        private static String cle(MembrePalanquee m) {
            if (m.getEleve() != null) return "E" + m.getEleve().getId();
            if (m.getUtilisateur() != null) return "U" + m.getUtilisateur().getId();
            return "N" + m.getNom() + "|" + m.getPrenom();
        }
    }
}
