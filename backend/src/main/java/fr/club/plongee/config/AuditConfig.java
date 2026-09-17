package fr.club.plongee.config;

import fr.club.plongee.audit.EcouteurRevisionAudit;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

@Configuration
@ImportRuntimeHints(AuditConfig.HintsEnversListener.class)
public class AuditConfig {

    /**
     * Hibernate Envers instancie {@link EcouteurRevisionAudit} par réflexion,
     * en dehors du graphe de beans Spring : invisible à l'analyse AOT, donc
     * jamais couvert automatiquement pour une image native.
     */
    static class HintsEnversListener implements RuntimeHintsRegistrar {
        @Override
        public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
            hints.reflection().registerType(EcouteurRevisionAudit.class,
                    MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);
        }
    }

    /** L'auteur d'une ecriture vient toujours du SecurityContext, jamais du corps de la requete. */
    @Bean
    AuditorAware<String> auditeurCourant() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(a -> a.getPrincipal())
                .filter(p -> p instanceof UtilisateurPrincipal)
                .map(p -> ((UtilisateurPrincipal) p).email());
    }
}
