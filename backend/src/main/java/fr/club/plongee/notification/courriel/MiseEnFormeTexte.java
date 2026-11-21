package fr.club.plongee.notification.courriel;

import fr.club.plongee.notification.courriel.Courriel.Liste;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Le texte d'un e-mail déjà écrit pour la version texte, découpé en blocs pour
 * la version HTML, d'après ses conventions : « Bonjour X, » en tête, titres de
 * section en MAJUSCULES, éléments en retrait de deux espaces (« - » facultatif),
 * détails en retrait de quatre, une adresse seule sur sa ligne devient un
 * bouton, la formule de fin (« Bon séjour, ») puis le nom de la structure.
 * La version texte, elle, part telle qu'écrite.
 */
public final class MiseEnFormeTexte {

    private static final Pattern BONJOUR = Pattern.compile("Bonjour ?(.*),");
    private static final Pattern ADRESSE = Pattern.compile("https?://\\S+");

    private MiseEnFormeTexte() {}

    public static Courriel courriel(String titre, String sousTitre, String texte, String nomStructure) {
        Courriel c = Courriel.titre(titre).sousTitre(sousTitre);
        List<List<String>> paragraphes = paragraphes(texte);

        if (!paragraphes.isEmpty() && paragraphes.getFirst().size() == 1) {
            var bonjour = BONJOUR.matcher(paragraphes.getFirst().getFirst().strip());
            if (bonjour.matches()) {
                c.bonjour(bonjour.group(1));
                paragraphes.removeFirst();
            }
        }
        if (!paragraphes.isEmpty()) {
            List<String> fin = new ArrayList<>(paragraphes.getLast());
            if (fin.getLast().strip().equals(nomStructure)) fin.removeLast();
            if (!fin.isEmpty() && fin.getLast().strip().endsWith(",") && !fin.getLast().startsWith(" ")) {
                String formule = fin.removeLast().strip();
                c.signature(formule.substring(0, formule.length() - 1));
            }
            paragraphes.removeLast();
            if (!fin.isEmpty()) paragraphes.add(fin);
        }

        for (List<String> lignes : paragraphes) {
            int debut = 0;
            if (intertitre(lignes.getFirst())) {
                c.section(enMinuscules(lignes.getFirst().strip()));
                debut = 1;
            }
            List<Liste.Element> elements = new ArrayList<>();
            StringBuilder paragraphe = new StringBuilder();
            for (String ligne : lignes.subList(debut, lignes.size())) {
                int retrait = ligne.length() - ligne.stripLeading().length();
                String contenu = ligne.strip();
                if (retrait >= 4 && !elements.isEmpty()) {
                    Liste.Element dernier = elements.removeLast();
                    List<String> details = new ArrayList<>(dernier.details());
                    details.add(contenu.startsWith("- ") ? contenu.substring(2) : contenu);
                    elements.add(new Liste.Element(dernier.texte(), details));
                } else if (retrait >= 2) {
                    vider(c, paragraphe);
                    elements.add(new Liste.Element(contenu.startsWith("- ") ? contenu.substring(2) : contenu, List.of()));
                } else {
                    if (!elements.isEmpty()) {
                        c.liste(elements);
                        elements = new ArrayList<>();
                    }
                    if (ADRESSE.matcher(contenu).matches()) {
                        vider(c, paragraphe);
                        c.bouton(contenu.contains("/sejour") ? "Ouvrir le séjour" : "Ouvrir l'appli", contenu);
                    } else {
                        if (!paragraphe.isEmpty()) paragraphe.append('\n');
                        paragraphe.append(contenu);
                    }
                }
            }
            vider(c, paragraphe);
            if (!elements.isEmpty()) c.liste(elements);
        }
        return c;
    }

    /** Les paragraphes (séparés par une ligne vide), chacun en lignes, retraits gardés. */
    private static List<List<String>> paragraphes(String texte) {
        List<List<String>> resultat = new ArrayList<>();
        List<String> courant = new ArrayList<>();
        for (String ligne : texte.split("\n", -1)) {
            if (ligne.isBlank()) {
                if (!courant.isEmpty()) resultat.add(courant);
                courant = new ArrayList<>();
            } else {
                courant.add(ligne.stripTrailing());
            }
        }
        if (!courant.isEmpty()) resultat.add(courant);
        return resultat;
    }

    private static void vider(Courriel c, StringBuilder paragraphe) {
        if (paragraphe.isEmpty()) return;
        c.paragraphe(paragraphe.toString());
        paragraphe.setLength(0);
    }

    /** « VOS DÉPENSES », « AFFAIRES À PRÉVOIR (* indispensable) » : en capitales jusqu'à la parenthèse. */
    private static boolean intertitre(String ligne) {
        if (ligne.startsWith(" ")) return false;
        String tete = tete(ligne.strip());
        return tete.length() > 2 && tete.chars().anyMatch(Character::isLetter)
                && tete.chars().noneMatch(Character::isLowerCase);
    }

    private static String tete(String ligne) {
        int parenthese = ligne.indexOf(" (");
        return parenthese < 0 ? ligne : ligne.substring(0, parenthese);
    }

    /** « VOS DÉPENSES » → « Vos dépenses » ; la parenthèse qui suit reste telle quelle. */
    private static String enMinuscules(String ligne) {
        String tete = tete(ligne).toLowerCase(Locale.FRENCH);
        return Character.toUpperCase(tete.charAt(0)) + tete.substring(1) + ligne.substring(tete(ligne).length());
    }
}
