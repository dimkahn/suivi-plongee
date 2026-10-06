package fr.club.plongee.formation.domain;

/**
 * Cases à cocher du CACI (certificat d'absence de contre-indication) de la
 * FFESSM : les activités et les modes de pratique que le médecin a couverts.
 * Ce ne sont pas des données de santé (le CACI ne dit rien de la raison
 * d'une case non cochée) : on ne garde ni restriction, ni remarque du
 * médecin, ni le certificat lui-même. Les libellés sont repris à l'écran
 * dans {@code core/caci.ts}.
 *
 * Ajouter une case = ajouter une valeur ici et son libellé côté écran ; ne
 * jamais renommer une valeur existante (elle est enregistrée telle quelle).
 */
public enum ActiviteCaci {
    // Activités
    PLONGEE_SCAPHANDRE,
    APNEE,
    NAGE_AVEC_PALMES,
    PECHE_SOUS_MARINE,
    HOCKEY_SUBAQUATIQUE,
    TIR_SUR_CIBLE,
    ORIENTATION,
    NAGE_EN_EAU_VIVE,
    PLONGEE_SPORTIVE_PISCINE,
    RUGBY_SUBAQUATIQUE,
    // Modes de pratique
    LOISIR,
    COMPETITION,
    ENSEIGNEMENT_ENCADREMENT
}
