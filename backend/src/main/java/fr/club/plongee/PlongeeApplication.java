package fr.club.plongee;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

/** {@code @EnableScheduling} : les tâches de la nuit (cartes d'embarquement des séjours finis). */
@SpringBootApplication
@EnableJpaAuditing(auditorAwareRef = "auditeurCourant")
@EnableScheduling
public class PlongeeApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlongeeApplication.class, args);
    }
}
