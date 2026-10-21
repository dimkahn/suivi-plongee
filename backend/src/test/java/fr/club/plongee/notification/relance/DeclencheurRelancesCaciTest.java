package fr.club.plongee.notification.relance;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

/**
 * Déclenchement des relances CACI (R22), sans Spring : on lit l'annotation
 * {@code @Scheduled} réellement posée sur {@code declencher()} (cron et zone)
 * et on calcule les déclenchements suivants comme le planificateur.
 */
@ExtendWith(OutputCaptureExtension.class)
class DeclencheurRelancesCaciTest {

    @Test
    @DisplayName("Le déclenchement suit 7 h à Paris, passage à l'heure d'hiver compris")
    void chaqueJourA7hHeureDeParis() throws Exception {
        Scheduled planification = DeclencheurRelancesCaci.class.getMethod("declencher").getAnnotation(Scheduled.class);
        assertThat(planification).as("@Scheduled sur declencher()").isNotNull();
        CronExpression cron = CronExpression.parse(planification.cron());
        ZoneId zone = ZoneId.of(planification.zone());
        ZoneId paris = ZoneId.of("Europe/Paris");

        // CA31 : depuis le 24/10/2026 à 8 h à Paris ; heure d'hiver le 25/10 à 3 h.
        ZonedDateTime premier = cron.next(ZonedDateTime.of(2026, 10, 24, 8, 0, 0, 0, paris).withZoneSameInstant(zone));
        ZonedDateTime second = cron.next(premier);
        assertThat(premier.toInstant()).isEqualTo(Instant.parse("2026-10-25T06:00:00Z"));
        assertThat(second.toInstant()).isEqualTo(Instant.parse("2026-10-26T06:00:00Z"));

        // R22, heure d'été comme d'hiver : passage à l'heure d'été le 28/03/2027.
        ZonedDateTime ete = cron.next(ZonedDateTime.of(2027, 3, 27, 8, 0, 0, 0, paris).withZoneSameInstant(zone));
        assertThat(ete.toInstant()).isEqualTo(Instant.parse("2027-03-28T05:00:00Z"));
    }

    @Test
    @DisplayName("Une erreur inattendue du traitement est journalisée par son seul type, sans donnée personnelle")
    void erreurInattendueSansDonneePersonnelle(CapturedOutput journal) {
        RelancesCaciService relances = mock(RelancesCaciService.class);
        doThrow(new IllegalStateException("paul.marin@exemple.fr Marin Paul 20/11/2026"))
                .when(relances).executer(LocalDate.of(2026, 10, 21));
        Clock horloge = Clock.fixed(Instant.parse("2026-10-21T05:00:00Z"), ZoneOffset.UTC);

        assertThatCode(() -> new DeclencheurRelancesCaci(horloge, relances).declencher()).doesNotThrowAnyException();

        assertThat(journal.getAll())
                .contains("Relances CACI du 21/10/2026 : le traitement s'est arrêté sur une erreur inattendue (IllegalStateException).")
                .doesNotContain("paul.marin").doesNotContain("Marin").doesNotContain("20/11/2026");
    }
}
