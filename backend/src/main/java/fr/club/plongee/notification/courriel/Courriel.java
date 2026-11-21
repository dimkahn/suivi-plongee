package fr.club.plongee.notification.courriel;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Un e-mail décrit une seule fois, bloc par bloc : {@link GabaritCourriel} en
 * tire la version HTML (aux couleurs et au logo de la structure) et la version
 * texte, envoyées ensemble. Tout texte est donné brut : le gabarit l'échappe.
 */
public final class Courriel {

    /** Les blocs, dans l'ordre où ils s'affichent. */
    public sealed interface Bloc permits Paragraphe, Bouton, Encadre, Code, Tableau, Note {}

    /** Un paragraphe ; {@code fort} : en gras (une phrase à ne pas manquer). */
    public record Paragraphe(String texte, boolean fort) implements Bloc {}

    /** Le geste attendu : un gros bouton, et le lien en clair dans la version texte. */
    public record Bouton(String libelle, String lien) implements Bloc {}

    /** Un encadré de lignes « clé : valeur » (dates, lieu, montant…), avec un titre facultatif. */
    public record Encadre(String titre, List<Map.Entry<String, String>> lignes) implements Bloc {}

    /** Un code à recopier, en gros caractères espacés. */
    public record Code(String code) implements Bloc {}

    /** Un tableau ; chaque ligne a autant de cases que d'en-têtes. */
    public record Tableau(List<String> entetes, List<List<String>> lignes) implements Bloc {}

    /** Un petit texte discret (précision, rappel de confidentialité). */
    public record Note(String texte) implements Bloc {}

    private final String titre;
    private String sousTitre;
    private String prenom;
    private final List<Bloc> blocs = new ArrayList<>();
    private String signature;

    private Courriel(String titre) {
        this.titre = titre;
    }

    /** {@code titre} : la grande ligne en tête du message (« Votre mot de passe », « Carnet du séjour »). */
    public static Courriel titre(String titre) {
        return new Courriel(titre);
    }

    /** Sous le titre, en plus petit (le nom du séjour, par exemple). */
    public Courriel sousTitre(String sousTitre) {
        this.sousTitre = sousTitre;
        return this;
    }

    /** « Bonjour Léa, » ; sans prénom, « Bonjour, ». */
    public Courriel bonjour(String prenom) {
        this.prenom = prenom == null ? "" : prenom;
        return this;
    }

    public Courriel paragraphe(String texte) {
        blocs.add(new Paragraphe(texte, false));
        return this;
    }

    public Courriel paragrapheFort(String texte) {
        blocs.add(new Paragraphe(texte, true));
        return this;
    }

    public Courriel bouton(String libelle, String lien) {
        blocs.add(new Bouton(libelle, lien));
        return this;
    }

    public Courriel encadre(String titre, List<Map.Entry<String, String>> lignes) {
        blocs.add(new Encadre(titre, List.copyOf(lignes)));
        return this;
    }

    public Courriel code(String code) {
        blocs.add(new Code(code));
        return this;
    }

    public Courriel tableau(List<String> entetes, List<List<String>> lignes) {
        blocs.add(new Tableau(List.copyOf(entetes), lignes.stream().map(List::copyOf).toList()));
        return this;
    }

    public Courriel note(String texte) {
        blocs.add(new Note(texte));
        return this;
    }

    /** La formule de fin (« Bonnes bulles ») ; le nom de la structure suit toujours. */
    public Courriel signature(String signature) {
        this.signature = signature;
        return this;
    }

    public String getTitre() { return titre; }
    public String getSousTitre() { return sousTitre; }
    /** {@code null} : pas de « Bonjour ». */
    public String getPrenom() { return prenom; }
    public List<Bloc> getBlocs() { return List.copyOf(blocs); }
    public String getSignature() { return signature; }
}
