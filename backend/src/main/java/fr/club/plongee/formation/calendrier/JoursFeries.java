package fr.club.plongee.formation.calendrier;

import java.time.LocalDate;
import java.time.Month;
import java.util.Map;
import java.util.TreeMap;

/**
 * Jours fériés en France métropolitaine, calculés : aucune source externe.
 * Les fêtes mobiles se déduisent de Pâques (algorithme de Meeus/Jones/Butcher,
 * calendrier grégorien).
 */
public final class JoursFeries {

    private JoursFeries() {}

    /** Jours fériés compris entre deux dates (bornes incluses), avec leur nom. */
    public static Map<LocalDate, String> entre(LocalDate debut, LocalDate fin) {
        Map<LocalDate, String> feries = new TreeMap<>();
        for (int annee = debut.getYear(); annee <= fin.getYear(); annee++) {
            de(annee).forEach((date, nom) -> {
                if (!date.isBefore(debut) && !date.isAfter(fin)) feries.put(date, nom);
            });
        }
        return feries;
    }

    static Map<LocalDate, String> de(int annee) {
        LocalDate paques = paques(annee);
        Map<LocalDate, String> feries = new TreeMap<>();
        feries.put(LocalDate.of(annee, Month.JANUARY, 1), "Jour de l'an");
        feries.put(paques, "Pâques");
        feries.put(paques.plusDays(1), "Lundi de Pâques");
        feries.put(LocalDate.of(annee, Month.MAY, 1), "Fête du Travail");
        feries.put(LocalDate.of(annee, Month.MAY, 8), "Victoire 1945");
        feries.put(paques.plusDays(39), "Ascension");
        feries.put(paques.plusDays(49), "Pentecôte");
        feries.put(paques.plusDays(50), "Lundi de Pentecôte");
        feries.put(LocalDate.of(annee, Month.JULY, 14), "Fête nationale");
        feries.put(LocalDate.of(annee, Month.AUGUST, 15), "Assomption");
        feries.put(LocalDate.of(annee, Month.NOVEMBER, 1), "Toussaint");
        feries.put(LocalDate.of(annee, Month.NOVEMBER, 11), "Armistice 1918");
        feries.put(LocalDate.of(annee, Month.DECEMBER, 25), "Noël");
        return feries;
    }

    static LocalDate paques(int annee) {
        int a = annee % 19, b = annee / 100, c = annee % 100, d = b / 4, e = b % 4;
        int f = (b + 8) / 25, g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int mois = (h + l - 7 * m + 114) / 31, jour = (h + l - 7 * m + 114) % 31 + 1;
        return LocalDate.of(annee, mois, jour);
    }
}
