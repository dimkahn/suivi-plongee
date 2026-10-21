package fr.club.plongee.notification.relance;

import fr.club.plongee.commun.Calendrier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;

import static fr.club.plongee.commun.Calendrier.DATE_FR;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Recette en profil dev (R23, CA4) : sans faux, dans le contexte par défaut
 * et sur la démo, l'e-mail de relance est écrit dans le journal du serveur.
 * Gwendoline (e3@club.fr) a un CACI qui finit dans 12 jours.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@ExtendWith(OutputCaptureExtension.class)
class RelancesCaciJournalDevTest {

    @Autowired RelancesCaciService relances;
    @Autowired JdbcTemplate jdbc;

    @Test
    @DisplayName("En dev, le journal montre l'e-mail de relance adressé à e3@club.fr")
    void journalDev(CapturedOutput journal) {
        LocalDate fin = jdbc.queryForObject(
                "SELECT certificat_valide_jusqu_au FROM utilisateur WHERE email = 'e3@club.fr'", LocalDate.class);

        relances.executer(Calendrier.aujourdhui());

        assertThat(journal.getOut())
                .contains("Courriel pour e3@club.fr : Votre CACI expire le " + DATE_FR.format(fin))
                .contains("Bonjour Gwendoline,")
                .contains("est valable jusqu'au " + DATE_FR.format(fin) + ".");
    }
}
