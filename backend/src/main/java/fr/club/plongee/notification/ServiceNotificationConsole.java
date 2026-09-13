package fr.club.plongee.notification;

import fr.club.plongee.securite.Utilisateur;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Implementation de secours : aucun serveur SMTP n'est configure, le lien est
 * simplement trace dans les logs du serveur. A remplacer par un envoi reel
 * (JavaMailSender ou prestataire transactionnel) avant la mise en production.
 */
@Service
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
