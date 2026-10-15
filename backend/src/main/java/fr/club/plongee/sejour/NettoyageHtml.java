package fr.club.plongee.sejour;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.TextNode;
import org.jsoup.safety.Cleaner;
import org.jsoup.safety.Safelist;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Vérifie et nettoie le HTML collé par un organisateur : le mail de
 * réservation d'une voiture de location (instructions du loueur). Il sera
 * affiché tel quel aux participants, dans l'appli : on n'en garde que le
 * texte et sa structure (titres, paragraphes, listes, tableaux, gras) et
 * les liens (web, e-mail, téléphone), ouverts dans un nouvel onglet.
 * <p>
 * Retirés : scripts, formulaires, cadres, images (souvent des pixels de
 * suivi du loueur) et la mise en forme (attribut et balise {@code style}),
 * qui pourrait recouvrir l'écran de l'appli. Le texte des balises de mise
 * en page inconnues ({@code font}, {@code center}...) est gardé.
 * <p>
 * Calcul pur, sans base : testé à part.
 */
public final class NettoyageHtml {

    /** Ce qui reste après nettoyage (null s'il ne reste aucun texte) et ce qui a été retiré, en clair. */
    public record Resultat(String html, List<String> retraits) {}

    private static final Set<String> ACTIFS = Set.of("script", "iframe", "frame", "frameset", "object", "embed",
            "applet", "form", "input", "button", "select", "textarea", "link", "meta", "base", "svg", "math");

    private static final Safelist AUTORISE = Safelist.relaxed()
            .removeTags("img")
            .addTags("hr", "center")
            .removeProtocols("a", "href", "ftp")
            .addProtocols("a", "href", "tel")
            .addEnforcedAttribute("a", "target", "_blank")
            .addEnforcedAttribute("a", "rel", "noopener noreferrer nofollow");

    private NettoyageHtml() {}

    public static Resultat nettoyer(String html) {
        if (html == null || html.isBlank()) return new Resultat(null, List.of());
        // Un mail entier (<html><head>…) : seul le corps compte, le titre de la page n'est pas du texte à garder.
        Document source = Jsoup.parse(html);
        int images = 0, scripts = 0, actifs = 0, liens = 0;
        boolean miseEnForme = !source.select("style").isEmpty();
        for (Element e : source.body().getAllElements()) {
            String balise = e.normalName();
            if (balise.equals("img")) images++;
            else if (balise.equals("script")) scripts++;
            else if (ACTIFS.contains(balise)) actifs++;
            else if (balise.equals("style")) miseEnForme = true;
            if (!AUTORISE.isSafeTag(balise)) continue;
            for (Attribute a : e.attributes()) {
                String nom = a.getKey().toLowerCase();
                if (AUTORISE.isSafeAttribute(balise, e, a)) continue;
                if (nom.startsWith("on")) scripts++;
                else if (nom.equals("style")) miseEnForme = true;
                else if (balise.equals("a") && nom.equals("href") && !a.getValue().startsWith("#")) liens++;
            }
        }

        Document.OutputSettings sortie = new Document.OutputSettings().prettyPrint(false);
        Document propre = new Cleaner(AUTORISE).clean(source);
        propre.outputSettings(sortie);
        String resultat = propre.body().html().trim();

        List<String> retraits = new ArrayList<>();
        if (scripts > 0) retraits.add(nombre(scripts, "script", "scripts"));
        if (actifs > 0) retraits.add(nombre(actifs, "élément actif (formulaire, cadre, bouton…)",
                "éléments actifs (formulaire, cadre, bouton…)"));
        if (images > 0) retraits.add(nombre(images, "image", "images"));
        if (liens > 0) retraits.add(nombre(liens, "lien non sûr", "liens non sûrs"));
        if (miseEnForme) retraits.add("la mise en forme (couleurs, polices, tailles)");
        return new Resultat(propre.body().text().isBlank() ? null : resultat, retraits);
    }

    /** Le même mail en texte brut, pour le carnet envoyé par e-mail : un paragraphe, une ligne de tableau par ligne. */
    public static String enTexte(String html) {
        if (html == null || html.isBlank()) return "";
        Element corps = Jsoup.parse(html).body();
        corps.select("br").after("\n");
        corps.select("p, div, li, tr, h1, h2, h3, h4, h5, h6, table, blockquote, hr").before("\n");
        corps.select("td, th").after(" ");
        for (Element a : corps.select("a[href]")) {
            String adresse = a.attr("href").replaceFirst("^(mailto|tel):", "");
            if (!a.text().contains(adresse)) a.after(new TextNode(" (" + adresse + ")"));
        }
        return corps.wholeText().lines().map(String::strip).filter(l -> !l.isEmpty())
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private static String nombre(int n, String un, String plusieurs) {
        return n + " " + (n > 1 ? plusieurs : un);
    }
}
