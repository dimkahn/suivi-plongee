package fr.club.plongee.notification.courriel;

import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.identite.IdentiteStructureService.IdentiteVue;
import fr.club.plongee.notification.courriel.Courriel.Bloc;
import fr.club.plongee.notification.courriel.Courriel.Bouton;
import fr.club.plongee.notification.courriel.Courriel.Code;
import fr.club.plongee.notification.courriel.Courriel.Encadre;
import fr.club.plongee.notification.courriel.Courriel.Note;
import fr.club.plongee.notification.courriel.Courriel.Paragraphe;
import fr.club.plongee.notification.courriel.Courriel.Tableau;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Map;

/**
 * Met un {@link Courriel} en forme, aux couleurs et au logo de la structure
 * (« Identité de la structure », celles d'origine si rien n'est réglé).
 *
 * <p>Le HTML suit ce que les messageries savent afficher : mise en page en
 * tableaux de 600 px au plus, styles en ligne (Gmail et Outlook ignorent les
 * feuilles de style), polices système. Le logo est joint au message
 * ({@code cid:}) : aucune image n'est chargée depuis un serveur, donc aucun
 * suivi d'ouverture, chez des destinataires dont beaucoup sont mineurs. La
 * version texte dit la même chose, liens en clair.
 */
@Service
public class GabaritCourriel {

    /** Identifiant du logo joint au message. */
    public static final String CID_LOGO = "logo-structure";

    /** Couleurs d'origine (frontend/src/styles.css). */
    static final String PRINCIPALE_ORIGINE = "#0891B2";
    static final String FONCEE_ORIGINE = "#0C3547";
    static final String ACCENT_ORIGINE = "#F97316";

    private static final String ENCRE = "#0F172A";
    private static final String CRAIE = "#475569";
    private static final String TRAIT = "#E2E8F0";
    private static final String FOND = "#F1F5F9";
    private static final String POLICE = "Arial,Helvetica,sans-serif";

    private final IdentiteStructureService identite;

    public GabaritCourriel(IdentiteStructureService identite) {
        this.identite = identite;
    }

    public CourrielRendu rendre(Courriel courriel) {
        IdentiteVue vue = identite.lire();
        Couleurs couleurs = new Couleurs(
                ouOrigine(vue.couleurPrincipale(), PRINCIPALE_ORIGINE),
                ouOrigine(vue.couleurFoncee(), FONCEE_ORIGINE),
                ouOrigine(vue.couleurAccent(), ACCENT_ORIGINE));
        String nom = identite.nom();
        return new CourrielRendu(texte(courriel, nom), html(courriel, nom, couleurs), identite.logoPng());
    }

    private record Couleurs(String principale, String foncee, String accent) {}

    // ---------------------------------------------------------------- Texte

    private static String texte(Courriel c, String nom) {
        StringBuilder t = new StringBuilder(c.getTitre());
        if (c.getSousTitre() != null) t.append(" — ").append(c.getSousTitre());
        t.append("\n\n");
        if (c.getPrenom() != null) {
            t.append(c.getPrenom().isBlank() ? "Bonjour," : "Bonjour " + c.getPrenom() + ",").append("\n\n");
        }
        for (Bloc b : c.getBlocs()) {
            switch (b) {
                case Paragraphe p -> t.append(p.texte());
                case Bouton bt -> t.append(bt.libelle()).append(" : ").append(bt.lien());
                case Encadre e -> {
                    if (e.titre() != null) t.append(e.titre()).append('\n');
                    for (Map.Entry<String, String> l : e.lignes()) {
                        t.append("- ").append(l.getKey()).append(" : ").append(l.getValue()).append('\n');
                    }
                    t.setLength(t.length() - 1);
                }
                case Code code -> t.append("Code : ").append(code.code());
                case Tableau tab -> {
                    for (List<String> ligne : tab.lignes()) {
                        t.append("- ");
                        for (int i = 0; i < ligne.size(); i++) {
                            if (i > 0) t.append(" · ");
                            if (i < tab.entetes().size() && i > 0) t.append(tab.entetes().get(i)).append(" : ");
                            t.append(ligne.get(i));
                        }
                        t.append('\n');
                    }
                    t.setLength(t.length() - 1);
                }
                case Note n -> t.append(n.texte());
            }
            t.append("\n\n");
        }
        if (c.getSignature() != null) t.append(c.getSignature()).append(",\n");
        return t.append(nom).toString();
    }

    // ----------------------------------------------------------------- HTML

    private static String html(Courriel c, String nom, Couleurs k) {
        String apercu = c.getBlocs().stream().filter(b -> b instanceof Paragraphe)
                .map(b -> ((Paragraphe) b).texte()).findFirst().orElse(c.getTitre());
        StringBuilder h = new StringBuilder(4096);
        h.append("<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"UTF-8\">")
                .append("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">")
                // Clair seulement : les messageries qui inversent les couleurs abîment le logo et les boutons.
                .append("<meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\">")
                .append("<title>").append(e(c.getTitre())).append("</title></head>")
                .append("<body style=\"margin:0;padding:0;background-color:").append(FOND).append(";\">")
                // Le début du message, montré dans la liste des e-mails, puis masqué.
                .append("<div style=\"display:none;max-height:0;overflow:hidden;mso-hide:all;\">").append(e(apercu)).append("</div>")
                .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color:")
                .append(FOND).append(";\"><tr><td align=\"center\" style=\"padding:24px 12px;\">")
                .append("<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;")
                .append("background-color:#FFFFFF;border-radius:16px;overflow:hidden;font-family:").append(POLICE)
                .append(";color:").append(ENCRE).append(";\">");

        // En-tête : logo et nom de la structure sur sa couleur foncée, liseré d'accent.
        String surFoncee = texteSur(k.foncee());
        h.append("<tr><td style=\"background-color:").append(k.foncee()).append(";padding:16px 24px;\">")
                .append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>")
                .append("<td style=\"padding-right:12px;vertical-align:middle;\"><img src=\"cid:").append(CID_LOGO)
                .append("\" width=\"48\" height=\"48\" alt=\"\" style=\"display:block;border:0;width:48px;height:48px;border-radius:24px;background-color:#FFFFFF;\"></td>")
                .append("<td style=\"vertical-align:middle;font-family:").append(POLICE).append(";font-size:16px;font-weight:bold;color:")
                .append(surFoncee).append(";\">").append(e(nom)).append("</td></tr></table></td></tr>")
                .append("<tr><td style=\"height:4px;line-height:4px;font-size:4px;background-color:").append(k.accent()).append(";\">&nbsp;</td></tr>");

        // Corps.
        String titreCouleur = contraste(k.foncee(), "#FFFFFF") >= 4.5 ? k.foncee() : ENCRE;
        h.append("<tr><td style=\"padding:28px 24px 8px;font-family:").append(POLICE).append(";font-size:16px;line-height:24px;color:")
                .append(ENCRE).append(";\">")
                .append("<h1 style=\"margin:0;font-family:").append(POLICE).append(";font-size:24px;line-height:30px;color:")
                .append(titreCouleur).append(";\">").append(e(c.getTitre())).append("</h1>");
        if (c.getSousTitre() != null) {
            h.append("<p style=\"margin:4px 0 0;font-size:15px;color:").append(CRAIE).append(";\">").append(e(c.getSousTitre())).append("</p>");
        }
        h.append("<div style=\"height:20px;line-height:20px;\">&nbsp;</div>");
        if (c.getPrenom() != null) {
            paragraphe(h, c.getPrenom().isBlank() ? "Bonjour," : "Bonjour " + c.getPrenom() + ",", false);
        }
        for (Bloc b : c.getBlocs()) {
            switch (b) {
                case Paragraphe p -> paragraphe(h, p.texte(), p.fort());
                case Bouton bt -> bouton(h, bt, k.foncee());
                case Encadre en -> encadre(h, en, k.principale());
                case Code code -> h.append("<p style=\"margin:8px 0 20px;padding:16px;background-color:").append(FOND)
                        .append(";border-radius:8px;text-align:center;font-family:'Courier New',Courier,monospace;font-size:32px;")
                        .append("line-height:40px;letter-spacing:8px;font-weight:bold;color:").append(ENCRE).append(";\">")
                        .append(e(code.code())).append("</p>");
                case Tableau t -> tableau(h, t, titreCouleur);
                case Note n -> h.append("<p style=\"margin:0 0 16px;font-size:13px;line-height:20px;color:").append(CRAIE).append(";\">")
                        .append(e(n.texte())).append("</p>");
            }
        }
        h.append("</td></tr>");

        // Signature.
        h.append("<tr><td style=\"padding:8px 24px 28px;font-family:").append(POLICE).append(";font-size:16px;line-height:24px;color:")
                .append(ENCRE).append(";\"><p style=\"margin:0;\">");
        if (c.getSignature() != null) h.append(e(c.getSignature())).append(",<br>");
        h.append("<strong>").append(e(nom)).append("</strong></p></td></tr>")
                .append("</table>")
                .append("<p style=\"margin:16px 0 0;font-family:").append(POLICE).append(";font-size:12px;line-height:18px;color:")
                .append(CRAIE).append(";\">Envoyé par ").append(e(nom)).append(".</p>")
                .append("</td></tr></table></body></html>");
        return h.toString();
    }

    private static void paragraphe(StringBuilder h, String texte, boolean fort) {
        h.append("<p style=\"margin:0 0 16px;").append(fort ? "font-weight:bold;" : "").append("\">")
                .append(e(texte).replace("\n", "<br>")).append("</p>");
    }

    /** Bouton en tableau : cliquable partout, y compris dans Outlook. */
    private static void bouton(StringBuilder h, Bouton b, String fond) {
        String encre = texteSur(fond);
        h.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:8px 0 24px;\"><tr>")
                .append("<td style=\"border-radius:8px;background-color:").append(fond).append(";\">")
                .append("<a href=\"").append(e(b.lien())).append("\" style=\"display:inline-block;padding:14px 28px;font-family:")
                .append(POLICE).append(";font-size:16px;line-height:20px;font-weight:bold;text-decoration:none;border-radius:8px;")
                .append("background-color:").append(fond).append(";color:").append(encre).append(";\">")
                .append(e(b.libelle())).append("</a></td></tr></table>");
    }

    private static void encadre(StringBuilder h, Encadre en, String lisere) {
        h.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 20px;")
                .append("background-color:").append(FOND).append(";border-left:4px solid ").append(lisere).append(";border-radius:8px;\">")
                .append("<tr><td style=\"padding:14px 16px;font-family:").append(POLICE).append(";font-size:15px;line-height:22px;\">");
        if (en.titre() != null) {
            h.append("<p style=\"margin:0 0 6px;font-weight:bold;\">").append(e(en.titre())).append("</p>");
        }
        for (Map.Entry<String, String> l : en.lignes()) {
            h.append("<p style=\"margin:0;\"><span style=\"color:").append(CRAIE).append(";\">").append(e(l.getKey()))
                    .append(" : </span><strong>").append(e(l.getValue())).append("</strong></p>");
        }
        h.append("</td></tr></table>");
    }

    private static void tableau(StringBuilder h, Tableau t, String couleurTitres) {
        h.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 20px;")
                .append("border-collapse:collapse;font-family:").append(POLICE).append(";font-size:14px;line-height:20px;\"><tr>");
        for (String entete : t.entetes()) {
            h.append("<th align=\"left\" style=\"padding:8px 6px;border-bottom:2px solid ").append(couleurTitres)
                    .append(";color:").append(couleurTitres).append(";font-size:13px;\">").append(e(entete)).append("</th>");
        }
        h.append("</tr>");
        for (List<String> ligne : t.lignes()) {
            h.append("<tr>");
            for (String c : ligne) {
                // Un montant ou une date (« 720,00 € », « 05/06 ») ne se coupe pas en deux au téléphone.
                String insecable = c != null && c.length() <= 12 ? "white-space:nowrap;" : "";
                h.append("<td style=\"padding:8px 6px;border-bottom:1px solid ").append(TRAIT).append(";vertical-align:top;")
                        .append(insecable).append("\">")
                        .append(e(c)).append("</td>");
            }
            h.append("</tr>");
        }
        h.append("</table>");
    }

    // ------------------------------------------------------------- Couleurs

    private static String ouOrigine(String couleur, String origine) {
        return couleur == null || couleur.isBlank() ? origine : couleur.toUpperCase();
    }

    /** Blanc sur une couleur foncée, encre sur une couleur claire : 4,5:1 au moins quand c'est possible. */
    static String texteSur(String fond) {
        return contraste(fond, "#FFFFFF") >= 4.5 ? "#FFFFFF" : ENCRE;
    }

    /** Rapport de contraste WCAG entre deux couleurs « #RRGGBB ». */
    static double contraste(String a, String b) {
        double la = luminance(a), lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    private static double luminance(String couleur) {
        int rgb = Integer.parseInt(couleur.substring(1), 16);
        double[] c = {(rgb >> 16 & 0xFF) / 255.0, (rgb >> 8 & 0xFF) / 255.0, (rgb & 0xFF) / 255.0};
        for (int i = 0; i < 3; i++) {
            c[i] = c[i] <= 0.04045 ? c[i] / 12.92 : Math.pow((c[i] + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    private static String e(String texte) {
        return texte == null ? "" : HtmlUtils.htmlEscape(texte, "UTF-8");
    }
}
