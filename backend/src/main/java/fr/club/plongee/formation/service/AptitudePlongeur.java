package fr.club.plongee.formation.service;

import fr.club.plongee.securite.domain.NiveauEncadrement;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ce qu'un texte d'aptitude permet en milieu naturel : profondeur maximale
 * encadrée, profondeur maximale en autonomie, niveau d'encadrement et statut
 * de guide de palanquée. L'aptitude d'un membre de groupe ou de palanquée est
 * un texte libre (« N2 », « PE40 PA20 », « E2 », « MF1 », « Niveau 3 »…) : on
 * y cherche les codes connus et on retient, pour chaque prérogative, la plus
 * étendue. Un texte où aucun code n'est reconnu donne une aptitude vide
 * (toutes valeurs nulles) : on ne devine jamais.
 *
 * <p>Valeurs FFESSM courantes : N1 = PE20 ; N2 = PE40 + PA20 ; N3 = PE60 +
 * PA60 ; N4 (guide de palanquée, GP) et N5 = 60 m dans les deux cas. Un E1
 * est au moins N2, un E2 au moins N4 (donc aussi GP).
 */
public record AptitudePlongeur(Integer profondeurEncadree, Integer profondeurAutonome,
                               NiveauEncadrement encadrement, boolean guidePalanquee) {

    private static final Pattern CODES = Pattern.compile(
            "PA20|PA40|PA60|PE12|PE20|PE40|PE60|MF1|MF2|GP|E[1-4]|N[1-5]|NIVEAU ?[1-5]");

    public static final AptitudePlongeur INCONNUE = new AptitudePlongeur(null, null, null, false);

    public static AptitudePlongeur lire(String texte) {
        if (texte == null || texte.isBlank()) return INCONNUE;
        Matcher m = CODES.matcher(texte.toUpperCase(Locale.ROOT));
        AptitudePlongeur resultat = INCONNUE;
        while (m.find()) {
            resultat = resultat.avec(pourCode(m.group().replace("NIVEAU", "N").replace(" ", "")));
        }
        return resultat;
    }

    private static AptitudePlongeur pourCode(String code) {
        return switch (code) {
            case "PE12" -> new AptitudePlongeur(12, null, null, false);
            case "PE20", "N1" -> new AptitudePlongeur(20, null, null, false);
            case "PE40" -> new AptitudePlongeur(40, null, null, false);
            case "PE60" -> new AptitudePlongeur(60, null, null, false);
            case "PA20" -> new AptitudePlongeur(null, 20, null, false);
            case "PA40" -> new AptitudePlongeur(null, 40, null, false);
            case "PA60" -> new AptitudePlongeur(null, 60, null, false);
            case "N2" -> new AptitudePlongeur(40, 20, null, false);
            case "N3" -> new AptitudePlongeur(60, 60, null, false);
            case "N4", "N5", "GP" -> new AptitudePlongeur(60, 60, null, true);
            case "E1" -> new AptitudePlongeur(40, 20, NiveauEncadrement.E1, false);
            case "E2" -> new AptitudePlongeur(60, 60, NiveauEncadrement.E2, true);
            case "E3", "MF1" -> new AptitudePlongeur(60, 60, NiveauEncadrement.E3, true);
            case "E4", "MF2" -> new AptitudePlongeur(60, 60, NiveauEncadrement.E4, true);
            default -> INCONNUE;
        };
    }

    /** La réunion de deux aptitudes : pour chaque prérogative, la plus étendue. */
    public AptitudePlongeur avec(AptitudePlongeur autre) {
        return new AptitudePlongeur(max(profondeurEncadree, autre.profondeurEncadree),
                max(profondeurAutonome, autre.profondeurAutonome),
                encadrement == null ? autre.encadrement
                        : autre.encadrement == null || encadrement.auMoins(autre.encadrement) ? encadrement
                        : autre.encadrement,
                guidePalanquee || autre.guidePalanquee);
    }

    /** Peut encadrer une palanquée : un niveau d'encadrement ou guide de palanquée. */
    public boolean encadre() {
        return encadrement != null || guidePalanquee;
    }

    /** La plus grande profondeur permise, encadrée ou en autonomie ; null si inconnue. */
    public Integer profondeurMax() {
        return max(profondeurEncadree, profondeurAutonome);
    }

    private static Integer max(Integer a, Integer b) {
        if (a == null) return b;
        if (b == null) return a;
        return Math.max(a, b);
    }
}
