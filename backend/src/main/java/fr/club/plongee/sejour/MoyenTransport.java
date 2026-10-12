package fr.club.plongee.sejour;

/** Comment un participant arrive au séjour ou en repart. */
public enum MoyenTransport {
    AVION("avion"),
    TRAIN("train"),
    VOITURE("voiture"),
    CAR("car"),
    BATEAU("bateau"),
    AUTRE("autre");

    private final String libelle;

    MoyenTransport(String libelle) {
        this.libelle = libelle;
    }

    public String libelle() {
        return libelle;
    }
}
