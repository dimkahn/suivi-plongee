package fr.club.plongee.commun;

import java.time.LocalDate;
import java.util.Set;

/**
 * CACI d'un élève ou d'un moniteur tel que saisi dans son dossier : dates,
 * médecin signataire et cases cochées du formulaire FFESSM. Jamais le
 * certificat, ni le texte écrit par le médecin.
 */
public record Caci(LocalDate finValidite, LocalDate dateExamen, MedecinCaci medecin,
                   Set<ActiviteCaci> activites) {

    /**
     * Erreurs de saisie : « l'ensemble des activités » cochée avec une case
     * « ou bien seulement », date d'examen à venir ou postérieure à la fin
     * de validité.
     */
    public void verifier() {
        if (activites != null && activites.contains(ActiviteCaci.ENSEMBLE_ACTIVITES)
                && activites.stream().anyMatch(ActiviteCaci::seulement)) {
            throw new RegleMetierException("CACI : « l'ensemble des activités subaquatiques fédérales » "
                    + "exclut les cases « ou bien seulement ». Cochez l'une ou les autres, comme sur le certificat.");
        }
        if (dateExamen == null) return;
        if (dateExamen.isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date de l'examen du CACI ne peut pas être dans le futur.");
        }
        if (finValidite != null && dateExamen.isAfter(finValidite)) {
            throw new RegleMetierException(
                    "La date de l'examen du CACI est postérieure à sa fin de validité : vérifiez les deux dates.");
        }
    }
}
