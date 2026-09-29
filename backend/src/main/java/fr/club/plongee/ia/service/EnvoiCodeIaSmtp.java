package fr.club.plongee.ia.service;

import fr.club.plongee.commun.RegleMetierException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import java.util.Properties;

/**
 * Envoie le code d'accès par SMTP. Le profil dev n'envoie aucun autre
 * courriel (ServiceNotificationConsole) : ce serveur est donc configuré à
 * part, sous {@code app.ia.smtp}, avec les mêmes variables d'environnement
 * que la production. Non configuré, l'envoi est refusé : le code ne
 * s'affiche jamais dans la console à la place.
 */
@Component
@ConditionalOnProperty(name = "app.ia.active", havingValue = "true")
public class EnvoiCodeIaSmtp implements EnvoiCodeIa {

    private static final Logger log = LoggerFactory.getLogger(EnvoiCodeIaSmtp.class);

    private final String hote;
    private final int port;
    private final String utilisateur;
    private final String motDePasse;
    private final String expediteur;

    public EnvoiCodeIaSmtp(@Value("${app.ia.smtp.hote:}") String hote,
                           @Value("${app.ia.smtp.port:587}") int port,
                           @Value("${app.ia.smtp.utilisateur:}") String utilisateur,
                           @Value("${app.ia.smtp.mot-de-passe:}") String motDePasse,
                           @Value("${app.mail.expediteur}") String expediteur) {
        this.hote = hote;
        this.port = port;
        this.utilisateur = utilisateur;
        this.motDePasse = motDePasse;
        this.expediteur = expediteur;
    }

    private static String duree(int minutes) {
        if (minutes % 60 == 0) return minutes == 60 ? "une heure" : (minutes / 60) + " heures";
        return minutes + " minutes";
    }

    @Override
    public void envoyer(String destinataire, String code, String demandeur, int minutesDeValidite) {
        if (hote.isBlank()) {
            throw new RegleMetierException("Le code ne peut pas être envoyé : aucun serveur d'envoi de courriel "
                    + "n'est configuré sur ce poste (variables SMTP_HOTE, SMTP_UTILISATEUR, SMTP_MOT_DE_PASSE).");
        }
        JavaMailSenderImpl envoi = new JavaMailSenderImpl();
        envoi.setHost(hote);
        envoi.setPort(port);
        envoi.setUsername(utilisateur);
        envoi.setPassword(motDePasse);
        Properties p = envoi.getJavaMailProperties();
        p.put("mail.smtp.auth", String.valueOf(!utilisateur.isBlank()));
        p.put("mail.smtp.starttls.enable", "true");
        p.put("mail.smtp.connectiontimeout", "10000");
        p.put("mail.smtp.timeout", "10000");

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(expediteur);
        message.setTo(destinataire);
        message.setSubject("Code d'accès à l'assistant IA : " + code);
        message.setText("Bonjour,\n\n"
                + demandeur + " demande l'accès à l'assistant IA (Claude Code) de l'application de suivi.\n\n"
                + "Code d'accès : " + code + "\n\n"
                + "Il ne sert qu'une fois et vaut " + duree(minutesDeValidite) + " à partir de maintenant : "
                + "l'accès qu'il ouvre se referme à la fin de ce délai. "
                + "Si vous n'êtes pas à l'origine de cette demande, ne le transmettez pas.");
        try {
            envoi.send(message);
        } catch (Exception e) {
            log.error("Échec de l'envoi du code d'accès à l'assistant IA à {}", destinataire, e);
            throw new RegleMetierException("Le code n'a pas pu être envoyé par courriel : " + e.getMessage());
        }
    }
}
