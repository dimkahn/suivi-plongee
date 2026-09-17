package fr.club.plongee.notification.service;

import fr.club.plongee.securite.domain.Utilisateur;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envoi reel par SMTP, actif hors developpement (voir spring.mail.* dans
 * application.yml, profil prod). Un echec d'envoi ne doit pas empecher la
 * demande de reinitialisation elle-meme d'etre enregistree : il est trace et
 * avale, comme le ferait un prestataire transactionnel en cas de bounce.
 */
@Service
@Profile("!dev")
public class ServiceNotificationEmail implements ServiceNotification {

    private static final Logger log = LoggerFactory.getLogger(ServiceNotificationEmail.class);

    private final JavaMailSender mailSender;
    private final String expediteur;
    private final String urlFrontend;

    public ServiceNotificationEmail(JavaMailSender mailSender,
                                    @Value("${app.mail.expediteur}") String expediteur,
                                    @Value("${app.frontend-url}") String urlFrontend) {
        this.mailSender = mailSender;
        this.expediteur = expediteur;
        this.urlFrontend = urlFrontend;
    }

    @Override
    public void envoyerLienReinitialisation(Utilisateur destinataire, String jeton) {
        String lien = urlFrontend + "/reinitialiser-mot-de-passe?jeton=" + jeton;
        envoyer(destinataire, "Réinitialisation de votre mot de passe",
                "Bonjour " + destinataire.getPrenom() + ",\n\n"
                        + "Une réinitialisation de mot de passe a été demandée pour votre compte du club.\n"
                        + "Ce lien est valable une heure :\n" + lien + "\n\n"
                        + "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.");
    }

    @Override
    public void envoyerLienInvitation(Utilisateur destinataire, String jeton) {
        String lien = urlFrontend + "/reinitialiser-mot-de-passe?jeton=" + jeton + "&invitation=1";
        envoyer(destinataire, "Bienvenue : créez votre mot de passe",
                "Bonjour " + destinataire.getPrenom() + ",\n\n"
                        + "Un compte moniteur vient d'être créé pour vous sur le suivi des formations du club.\n"
                        + "Ce lien, valable une heure, vous permet de choisir votre mot de passe :\n" + lien);
    }

    private void envoyer(Utilisateur destinataire, String sujet, String corps) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(expediteur);
        message.setTo(destinataire.getEmail());
        message.setSubject(sujet);
        message.setText(corps);
        try {
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Échec de l'envoi du courriel à {}", destinataire.getEmail(), e);
        }
    }
}
