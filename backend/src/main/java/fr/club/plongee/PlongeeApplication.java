package fr.club.plongee;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing(auditorAwareRef = "auditeurCourant")
public class PlongeeApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlongeeApplication.class, args);
    }
}
