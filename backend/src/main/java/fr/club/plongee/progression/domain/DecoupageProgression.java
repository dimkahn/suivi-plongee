package fr.club.plongee.progression.domain;

/** Comment se lisent les périodes d'une progression type. */
public enum DecoupageProgression {
    /** Plages de mois de la saison (club associatif, formation de septembre à juin). */
    MOIS,
    /**
     * Plages de numéros de plongée en milieu naturel de l'élève (centre de
     * plongée en mer : un stage court, commencé le jour où l'élève arrive).
     */
    PLONGEES
}
