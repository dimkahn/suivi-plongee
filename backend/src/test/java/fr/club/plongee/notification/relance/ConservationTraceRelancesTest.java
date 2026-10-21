package fr.club.plongee.notification.relance;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * R20, en règle pure : une ligne de trace est supprimée à la première
 * exécution dont le jour D est postérieur à sa date d'envoi + 2 ans
 * ({@code plusYears(2)}, comme {@code Caci.finValidite} : un 29 février donne
 * le 28 février).
 */
class ConservationTraceRelancesTest {

    /** Ce que fait la purge du jour D : supprime les envois antérieurs au premier envoi conservé. */
    private static boolean supprimee(LocalDate envoi, LocalDate jour) {
        return envoi.isBefore(RelancesCaciService.premierEnvoiConserve(jour));
    }

    @Test
    @DisplayName("Une trace est supprimée le lendemain de ses deux ans, 29 février compris")
    void deuxAns() {
        LocalDate envoi = LocalDate.of(2026, 10, 21);
        assertThat(supprimee(envoi, LocalDate.of(2028, 10, 21))).as("encore présente le 21/10/2028").isFalse();
        assertThat(supprimee(envoi, LocalDate.of(2028, 10, 22))).as("supprimée le 22/10/2028").isTrue();

        LocalDate bissextile = LocalDate.of(2028, 2, 29);
        assertThat(supprimee(bissextile, LocalDate.of(2030, 2, 28))).as("encore présente le 28/02/2030").isFalse();
        assertThat(supprimee(bissextile, LocalDate.of(2030, 3, 1))).as("supprimée le 01/03/2030").isTrue();

        LocalDate finFevrier = LocalDate.of(2030, 2, 28);
        assertThat(supprimee(finFevrier, LocalDate.of(2032, 2, 28))).as("encore présente le 28/02/2032").isFalse();
        assertThat(supprimee(finFevrier, LocalDate.of(2032, 2, 29))).as("supprimée le 29/02/2032").isTrue();
    }
}
