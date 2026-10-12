package fr.club.plongee.evaluation.service;

import fr.club.plongee.evaluation.domain.StatutAcquisition;

import java.util.List;

/**
 * État d'une compétence (bloc du référentiel) pour un élève, tel que le club
 * le lit d'un coup d'œil (choix du club, 2026) : porté par chaque bloc de la
 * grille, repris par la synthèse d'un groupe et par la fiche de synthèse
 * d'un élève.
 */
public enum EtatCompetence {
    /** Aucun critère noté autrement que « non abordé », ni en milieu naturel ni à l'entraînement. */
    NT,
    /** Travaillée mais pas encore validée (même si tous ses critères sont acquis). */
    ECA,
    /** Validée. */
    A;

    /** Validée : A ; un critère noté (milieu naturel ou entraînement) au-delà de « non abordé » : ECA ; sinon NT. */
    static EtatCompetence de(boolean valide, List<GrilleService.CritereVue> criteres) {
        if (valide) return A;
        String nonAborde = StatutAcquisition.NON_ABORDE.name();
        boolean travaillee = criteres.stream().anyMatch(c -> !nonAborde.equals(c.statut())
                || (c.entrainement() != null && !nonAborde.equals(c.entrainement().statut())));
        return travaillee ? ECA : NT;
    }
}
