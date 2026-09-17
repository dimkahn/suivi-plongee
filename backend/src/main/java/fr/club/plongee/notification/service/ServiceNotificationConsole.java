package fr.club.plongee.notification.service;

import fr.club.plongee.securite.domain.Utilisateur;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * Implementation de secours pour le developpement : aucun serveur SMTP n'y
 * est configure, le lien est simplement trace dans les logs du serveur. En
 * production, {@link ServiceNotificationEmail} envoie reellement le courriel.
 */
@Service
@Profile("dev")
public class ServiceNotificationConsole implements ServiceNotification {

    private static final Logger log = LoggerFactory.getLogger(ServiceNotificationConsole.class);

    private final String urlFrontend;

    public ServiceNotificationConsole(@Value("${app.frontend-url}") String urlFrontend) {
        this.urlFrontend = urlFrontend;
    }

    @Override
    public void envoyerLienReinitialisation(Utilisateur destinataire, String jeton) {
        String lien = urlFrontend + "/reinitialiser-mot-de-passe?jeton=" + jeton;
        log.info("Lien de reinitialisation de mot de passe pour {} : {}", destinataire.getEmail(), lien);
    }

    @Override
    public void envoyerLienInvitation(Utilisateur destinataire, String jeton) {
        String lien = urlFrontend + "/reinitialiser-mot-de-passe?jeton=" + jeton + "&invitation=1";
        log.info("Lien d'invitation (definition du mot de passe) pour {} : {}", destinataire.getEmail(), lien);
    }
}
