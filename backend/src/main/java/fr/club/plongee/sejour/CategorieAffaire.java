package fr.club.plongee.sejour;

/** Rubriques de la liste des affaires à prévoir. */
public enum CategorieAffaire {
    DOCUMENTS("Papiers"),
    PLONGEE("Pour la plongée"),
    SEJOUR("Pour le séjour");

    private final String libelle;

    CategorieAffaire(String libelle) {
        this.libelle = libelle;
    }

    public String libelle() {
        return libelle;
    }
}
