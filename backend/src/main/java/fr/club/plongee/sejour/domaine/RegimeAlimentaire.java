package fr.club.plongee.sejour.domaine;

/**
 * Régimes alimentaires d'un participant au séjour, pour la cuisine. Des
 * choix de table, pas des diagnostics : ni allergie, ni intolérance
 * médicale, ni traitement (aucune donnée de santé, règle du club).
 */
public enum RegimeAlimentaire {
    VEGETARIEN("végétarien"),
    VEGETALIEN("végétalien"),
    PESCETARIEN("pescétarien"),
    SANS_PORC("sans porc"),
    HALAL("halal"),
    CASHER("casher"),
    SANS_GLUTEN("sans gluten"),
    SANS_LACTOSE("sans lactose");

    private final String libelle;

    RegimeAlimentaire(String libelle) {
        this.libelle = libelle;
    }

    public String libelle() {
        return libelle;
    }
}
