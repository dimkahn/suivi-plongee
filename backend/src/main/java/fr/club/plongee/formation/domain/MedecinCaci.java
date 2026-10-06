package fr.club.plongee.formation.domain;

/**
 * Qualité du médecin signataire du CACI (« rayez la mention inutile »).
 * Utile parce que certaines pratiques (trimix hypoxique, apnée au-delà de
 * 6 m en compétition, reprise après un accident de plongée) demandent un
 * médecin fédéral, du sport ou qualifié.
 */
public enum MedecinCaci {
    GENERALISTE,
    DU_SPORT,
    MEDECINE_SUBAQUATIQUE,
    FEDERAL,
    AUTRE
}
