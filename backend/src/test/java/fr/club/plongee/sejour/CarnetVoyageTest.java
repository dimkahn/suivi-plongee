package fr.club.plongee.sejour;

import fr.club.plongee.sejour.SejourService.Trajet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

/** La ligne « Arrivée » ou « Départ » du carnet envoyé par e-mail au voyageur lui-même. */
class CarnetVoyageTest {

    @Test
    @DisplayName("Le carnet par e-mail donne au voyageur son terminal, l'ouverture de l'enregistrement et son dossier")
    void reservationDansLeCarnet() {
        Trajet aller = new Trajet(LocalDate.of(2026, 10, 22), LocalTime.of(15, 5), MoyenTransport.AVION, "TX510",
                "Fort-de-France", LocalTime.of(12, 20), "Paris-Orly", null, null, null, null,
                "4", "ABC123", "https://compagnie.example/ABC123", LocalDateTime.of(2026, 10, 20, 12, 20), null);

        String ligne = CarnetSejourService.trajet(aller, true);

        assertThat(ligne).contains("terminal 4")
                .contains("enregistrement en ligne à partir du mardi 20/10/2026 à 12h20")
                .contains("dossier ABC123 (https://compagnie.example/ABC123)");
    }
}
