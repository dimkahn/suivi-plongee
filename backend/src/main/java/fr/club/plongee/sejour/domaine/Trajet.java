package fr.club.plongee.sejour.domaine;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Un voyage. Pour l'arrivée : {@code heure} et {@code lieu} sont ceux où
 * l'on arrive sur place, {@code heureDepart} et {@code lieuDepart} ceux
 * d'où part l'avion ou le train (pour conseiller l'heure à laquelle être à
 * l'aéroport). Pour le départ : {@code heure} et {@code lieu} sont déjà
 * ceux du départ, les deux derniers restent vides.
 */
public record Trajet(LocalDate date, LocalTime heure, MoyenTransport transport,
                     @Size(max = 30) String numero, @Size(max = 120) String lieu,
                     LocalTime heureDepart, @Size(max = 120) String lieuDepart) {

    public boolean vide() {
        return date == null && heure == null && transport == null && Textes.blanc(numero) && Textes.blanc(lieu)
                && heureDepart == null && Textes.blanc(lieuDepart);
    }

    /** Le moment du voyage, midi si l'heure manque ; null sans date. */
    public static LocalDateTime moment(Trajet t) {
        if (t == null || t.date() == null) return null;
        return t.date().atTime(t.heure() == null ? LocalTime.NOON : t.heure());
    }
}
