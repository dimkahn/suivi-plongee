package fr.club.plongee.sejour.domaine;

/** Petits outils de saisie partagés par le séjour. */
public final class Textes {

    private Textes() {}

    public static boolean blanc(String texte) {
        return texte == null || texte.isBlank();
    }

    /** Le texte sans espaces autour, null s'il est vide. */
    public static String nettoyer(String texte) {
        return blanc(texte) ? null : texte.trim();
    }
}
