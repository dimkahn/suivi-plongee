package fr.club.plongee.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * L'horloge des tâches planifiées, remplaçable dans les tests (relances CACI,
 * R22). En UTC : la date du club s'en déduit par {@code Calendrier.aujourdhui(Clock)}.
 */
@Configuration
public class HorlogeConfig {

    @Bean
    Clock horloge() {
        return Clock.systemUTC();
    }
}
