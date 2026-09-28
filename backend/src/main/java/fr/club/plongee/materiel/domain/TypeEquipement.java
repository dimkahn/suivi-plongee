package fr.club.plongee.materiel.domain;

/** Les quatre familles de matériel suivies par le directeur technique. */
public enum TypeEquipement {
    BLOC("Bloc"),
    DETENDEUR("Détendeur"),
    GILET("Gilet stabilisateur"),
    COMBINAISON("Combinaison");

    private final String libelle;

    TypeEquipement(String libelle) {
        this.libelle = libelle;
    }

    public String libelle() {
        return libelle;
    }
}
