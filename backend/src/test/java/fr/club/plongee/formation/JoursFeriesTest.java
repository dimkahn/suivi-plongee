package fr.club.plongee.formation;

import fr.club.plongee.formation.calendrier.JoursFeries;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JoursFeriesTest {

    @Test
    void fetesMobilesDeduitesDePaques() {
        Map<LocalDate, String> feries = JoursFeries.entre(LocalDate.of(2026, 9, 1), LocalDate.of(2027, 6, 30));
        assertThat(feries)
                .containsEntry(LocalDate.of(2026, 11, 11), "Armistice 1918")
                .containsEntry(LocalDate.of(2027, 3, 29), "Lundi de Pâques")      // Pâques 2027 : 28 mars
                .containsEntry(LocalDate.of(2027, 5, 6), "Ascension")
                .containsEntry(LocalDate.of(2027, 5, 17), "Lundi de Pentecôte")
                .doesNotContainKey(LocalDate.of(2026, 8, 15));                     // hors période
        assertThat(JoursFeries.entre(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30)))
                .containsEntry(LocalDate.of(2026, 4, 6), "Lundi de Pâques");       // Pâques 2026 : 5 avril
    }
}
