package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;

/**
 * Efface chaque nuit, à 3 h, heure de Paris, les abonnements aux
 * notifications des séjours finis depuis plus de 60 jours : ils identifient
 * un téléphone auprès de Google, Apple ou Mozilla, et ne servent plus.
 * L'horloge injectée ({@code HorlogeConfig}) donne le jour.
 */
@Component
public class PurgeAbonnementsPush {

    private static final Logger log = LoggerFactory.getLogger(PurgeAbonnementsPush.class);

    private final Clock horloge;
    private final NotificationsSejourService notifications;

    public PurgeAbonnementsPush(Clock horloge, NotificationsSejourService notifications) {
        this.horloge = horloge;
        this.notifications = notifications;
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Paris")
    public void declencher() {
        try {
            notifications.oublierAnciens(Calendrier.aujourdhui(horloge));
        } catch (RuntimeException e) {
            log.error("Purge des abonnements aux notifications : erreur inattendue ({}).", e.getClass().getSimpleName());
        }
    }
}
