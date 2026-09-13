package fr.club.plongee.config;

import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

@Configuration
public class AuditConfig {

    /** L'auteur d'une ecriture vient toujours du SecurityContext, jamais du corps de la requete. */
    @Bean
    AuditorAware<String> auditeurCourant() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(a -> a.getPrincipal())
                .filter(p -> p instanceof UtilisateurPrincipal)
                .map(p -> ((UtilisateurPrincipal) p).email());
    }
}
