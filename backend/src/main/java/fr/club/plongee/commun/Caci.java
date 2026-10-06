package fr.club.plongee.commun;

import java.time.LocalDate;
import java.util.Set;

/**
 * CACI d'un élève ou d'un moniteur tel que saisi dans son dossier : date de
 * l'examen, médecin signataire et cases cochées du formulaire FFESSM. Jamais
 * le certificat, ni le texte écrit par le médecin. La fin de validité ne se
 * saisit pas : elle se déduit de la date de l'examen ({@link #finValidite}).
 */
public record Caci(LocalDate dateExamen, MedecinCaci medecin, Set<ActiviteCaci> activites) {

    /** Un CACI vaut un an à compter de l'examen (choix du club, 2026). */
    public static LocalDate finValidite(LocalDate dateExamen) {
        return dateExamen == null ? null : dateExamen.plusYears(1);
    }

    public LocalDate finValidite() {
        return finValidite(dateExamen);
    }

    /**
     * Erreurs de saisie : « l'ensemble des activités » cochée avec une case
     * « ou bien seulement », date d'examen à venir.
     */
    public void verifier() {
        if (activites != null && activites.contains(ActiviteCaci.ENSEMBLE_ACTIVITES)
                && activites.stream().anyMatch(ActiviteCaci::seulement)) {
            throw new RegleMetierException("CACI : « l'ensemble des activités subaquatiques fédérales » "
                    + "exclut les cases « ou bien seulement ». Cochez l'une ou les autres, comme sur le certificat.");
        }
        if (dateExamen != null && dateExamen.isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date de l'examen du CACI ne peut pas être dans le futur.");
        }
    }
}
