package fr.club.plongee.commun;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * La date du jour vue du club, pas du serveur : un conteneur tourne souvent
 * en UTC, et entre minuit et 2 h (heure de Paris) une séance du jour
 * passerait sinon pour une séance de demain.
 */
public final class Calendrier {

    public static final ZoneId ZONE_CLUB = ZoneId.of("Europe/Paris");
    public static final DateTimeFormatter DATE_FR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private Calendrier() {}

    public static LocalDate aujourdhui() {
        return LocalDate.now(ZONE_CLUB);
    }
}
