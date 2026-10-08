package fr.club.plongee.referentiel.domain;

/**
 * Les trois temps d'une compétence dans la base d'exercices : découvrir le
 * geste, le rendre autonome, puis l'évaluer au plus près de la réalité.
 * Seule la maîtrise fait passer un critère à « acquis » (EvaluationService).
 */
public enum PhaseExercice {
    INITIATION("Initiation"),
    PERFECTIONNEMENT("Perfectionnement"),
    MAITRISE("Maîtrise");

    private final String libelle;

    PhaseExercice(String libelle) {
        this.libelle = libelle;
    }

    public String libelle() {
        return libelle;
    }
}
