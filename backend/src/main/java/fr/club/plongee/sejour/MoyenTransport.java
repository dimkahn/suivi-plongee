package fr.club.plongee.sejour;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * Comment un participant arrive au séjour ou en repart, et combien de temps
 * avant le départ il est conseillé d'être sur place (choix du club, 2026 :
 * avion 2 h, train 30 min, bateau 45 min, car 15 min ; rien pour la voiture).
 * Même règle côté écran ({@code AVANCES_TRANSPORT} de {@code sejour-api.ts}).
 */
public enum MoyenTransport {
    AVION("avion", 120, "à l'aéroport"),
    TRAIN("train", 30, "à la gare"),
    VOITURE("voiture", 0, null),
    CAR("car", 15, "à l'arrêt du car"),
    BATEAU("bateau", 45, "à l'embarquement"),
    AUTRE("autre", 0, null);

    private final String libelle;
    private final int avanceMinutes;
    private final String ouEtre;

    MoyenTransport(String libelle, int avanceMinutes, String ouEtre) {
        this.libelle = libelle;
        this.avanceMinutes = avanceMinutes;
        this.ouEtre = ouEtre;
    }

    public String libelle() {
        return libelle;
    }

    /**
     * « soyez à l'aéroport vers 05h10 (2 h avant) » pour un départ à 07h10 ;
     * null si ce moyen de transport n'a pas de conseil (voiture, autre).
     */
    public String conseil(LocalTime depart, DateTimeFormatter format) {
        if (avanceMinutes == 0 || depart == null) return null;
        String avance = avanceMinutes >= 60 ? (avanceMinutes / 60) + " h" : avanceMinutes + " min";
        return "soyez " + ouEtre + " vers " + depart.minusMinutes(avanceMinutes).format(format)
                + " (" + avance + " avant)";
    }
}
