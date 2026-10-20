package fr.club.plongee.sejour;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;

/** L'heure à laquelle être sur place avant le départ (choix du club). */
class MoyenTransportTest {

    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH'h'mm");

    @Test
    @DisplayName("En avion, il faut être à l'aéroport 3 heures avant le départ")
    void avionTroisHeuresAvant() {
        assertThat(MoyenTransport.AVION.conseil(LocalTime.of(12, 20), HEURE))
                .isEqualTo("soyez à l'aéroport vers 09h20 (3 h avant)");
    }
}
