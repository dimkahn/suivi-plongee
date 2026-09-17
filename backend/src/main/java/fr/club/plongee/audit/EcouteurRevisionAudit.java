package fr.club.plongee.audit;

import fr.club.plongee.securite.UtilisateurPrincipal;
import org.hibernate.envers.RevisionListener;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Instancié par Envers via un constructeur sans argument (pas par Spring) :
 * l'accès au SecurityContext est donc statique, comme dans
 * {@code AuditConfig.auditeurCourant()}, qu'on ne peut pas réutiliser ici.
 * Invisible à l'analyse AOT (le graphe de beans Spring ne voit jamais cette
 * instanciation) : le hint de réflexion pour une image native est déclaré
 * dans {@code AuditConfig} plutôt qu'ici, une simple annotation sur cette
 * classe n'étant jamais scannée puisqu'elle n'est pas un bean Spring.
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
