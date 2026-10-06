package fr.club.plongee.commun;

/**
 * Cases à cocher du CACI (certificat d'absence de contre-indication) de la
 * FFESSM, modèle « Version Juin 2026 » de la commission médicale et de
 * prévention nationale. Les libellés sont repris à l'écran dans
 * {@code core/caci.ts}.
 *
 * On ne garde que les cases : ni le texte écrit par le médecin à côté (les
 * activités en compétition, le détail des limites et préconisations), ni le
 * certificat lui-même. {@link #LIMITES_PRECONISATIONS} dit seulement à
 * l'encadrant qu'il doit lire le certificat papier avant la séance.
 *
 * Ajouter une case = ajouter une valeur ici et son libellé côté écran ; ne
 * jamais renommer une valeur existante (elle est enregistrée telle quelle).
 */
public enum ActiviteCaci {
    /** « De l'ensemble des activités subaquatiques fédérales ». */
    ENSEMBLE_ACTIVITES,
    // « Ou bien seulement » : exclusives de ENSEMBLE_ACTIVITES
    PLONGEE_SCAPHANDRE,
    APNEE,
    APNEE_PROFONDEUR_6M,
    NAGE_AVEC_ACCESSOIRES,
    /** « De la ou des activité(s) suivante(s) en compétition ». */
    COMPETITION,
    /** « Avec les limites et préconisations suivantes » (encadrement, profondeur, gaz…). */
    LIMITES_PRECONISATIONS;

    public boolean seulement() {
        return this == PLONGEE_SCAPHANDRE || this == APNEE
                || this == APNEE_PROFONDEUR_6M || this == NAGE_AVEC_ACCESSOIRES;
    }
}
