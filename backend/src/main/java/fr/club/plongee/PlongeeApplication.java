package fr.club.plongee;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@code @EnableScheduling} : les tâches planifiées, heure de Paris, sur le fil
 * unique par défaut : la nuit, cartes d'embarquement (3 h 30) et attestations
 * d'assurance (3 h 35) des séjours finis ; à 7 h, relances CACI
 * ({@code DeclencheurRelancesCaci}).
 */
@SpringBootApplication
@EnableJpaAuditing(auditorAwareRef = "auditeurCourant")
@EnableScheduling
public class PlongeeApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlongeeApplication.class, args);
    }
}
