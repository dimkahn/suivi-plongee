package fr.club.plongee.notification.relance;

import fr.club.plongee.commun.Calendrier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;

import static fr.club.plongee.commun.Calendrier.DATE_FR;

/**
 * Déclenche les relances CACI chaque jour à 7 h, heure de Paris, été comme
 * hiver (R22) ; aucune route ni aucun bouton ne le fait. Le jour D est la date
 * du club à l'instant de l'horloge injectée (R1), remplaçable dans les tests ;
 * toute la logique est dans {@link RelancesCaciService#executer}.
 *
 * <p>Une erreur inattendue est journalisée par son seul type : son message
 * pourrait citer une adresse, un nom ou une date de CACI, que le gestionnaire
 * d'erreurs du planificateur écrirait sinon avec la pile (R17).
 */
@Component
public class DeclencheurRelancesCaci {

    private static final Logger log = LoggerFactory.getLogger(DeclencheurRelancesCaci.class);

    private final Clock horloge;
    private final RelancesCaciService relances;

    public DeclencheurRelancesCaci(Clock horloge, RelancesCaciService relances) {
        this.horloge = horloge;
        this.relances = relances;
    }

    @Scheduled(cron = "0 0 7 * * *", zone = "Europe/Paris")
    public void declencher() {
        LocalDate jour = Calendrier.aujourdhui(horloge);
        try {
            relances.executer(jour);
        } catch (RuntimeException e) {
            log.error("Relances CACI du {} : le traitement s'est arrêté sur une erreur inattendue ({}).",
                    DATE_FR.format(jour), e.getClass().getSimpleName());
        }
    }
}
