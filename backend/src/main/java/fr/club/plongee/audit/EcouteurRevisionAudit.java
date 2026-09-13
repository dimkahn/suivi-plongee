package fr.club.plongee.audit;

import fr.club.plongee.securite.UtilisateurPrincipal;
import org.hibernate.envers.RevisionListener;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Instancié par Envers via un constructeur sans argument (pas par Spring) :
 * l'accès au SecurityContext est donc statique, comme dans
 * {@code AuditConfig.auditeurCourant()}, qu'on ne peut pas réutiliser ici.
 */
public class EcouteurRevisionAudit implements RevisionListener {

    @Override
    public void newRevision(Object revisionEntity) {
        RevisionAudit revision = (RevisionAudit) revisionEntity;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        revision.setActeur(
                auth != null && auth.getPrincipal() instanceof UtilisateurPrincipal p
                        ? p.email()
                        : "système");
    }
}
