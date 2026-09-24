package fr.club.plongee.formation.calendrier;

import java.time.LocalDate;

/** Une période de vacances scolaires : du premier au dernier jour sans cours, bornes incluses. */
public record PeriodeVacances(String libelle, LocalDate premierJour, LocalDate dernierJour) {

    public boolean contient(LocalDate date) {
        return !date.isBefore(premierJour) && !date.isAfter(dernierJour);
    }
}
