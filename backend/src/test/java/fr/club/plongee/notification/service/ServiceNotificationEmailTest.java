package fr.club.plongee.notification.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Journal d'un échec d'envoi SMTP (R17 des relances CACI, appliqué à tous les
 * e-mails) : l'échec est signalé, sans l'adresse du destinataire.
 */
@ExtendWith(OutputCaptureExtension.class)
class ServiceNotificationEmailTest {

    /** Serveur SMTP qui refuse tout message, sans citer le destinataire. */
    static class SmtpEnPanne extends JavaMailSenderImpl {
        @Override
        public void send(SimpleMailMessage simpleMessage) {
            throw new MailSendException("Serveur SMTP injoignable");
        }

        @Override
        public void send(SimpleMailMessage... simpleMessages) {
            throw new MailSendException("Serveur SMTP injoignable");
        }
    }

    @Test
    @DisplayName("Un e-mail refusé est signalé dans le journal sans l'adresse du destinataire")
    void echecSansAdresseDansLeJournal(CapturedOutput journal) {
        ServiceNotificationEmail service = new ServiceNotificationEmail(
                new SmtpEnPanne(), "club@exemple.fr", "http://localhost:4200");

        boolean parti = service.envoyerCourriel("e3@club.fr", "Votre CACI expire le 20/11/2026", "Bonjour");

        assertThat(parti).isFalse();
        assertThat(journal.getAll()).contains("Échec de l'envoi");
        assertThat(journal.getAll()).doesNotContain("e3@club.fr");
    }

    /** Serveur SMTP qui refuse le destinataire en le citant, comme un vrai « 550 ». */
    static class SmtpRefuseLeDestinataire extends JavaMailSenderImpl {
        @Override
        public void send(SimpleMailMessage simpleMessage) {
            throw new MailSendException("550 5.1.1 <" + simpleMessage.getTo()[0] + ">: Recipient address rejected");
        }
    }

    @Test
    @DisplayName("Un refus SMTP qui cite le destinataire ne fait pas entrer son adresse dans le journal")
    void refusQuiCiteLeDestinataireSansAdresseDansLeJournal(CapturedOutput journal) {
        ServiceNotificationEmail service = new ServiceNotificationEmail(
                new SmtpRefuseLeDestinataire(), "club@exemple.fr", "http://localhost:4200");

        boolean parti = service.envoyerCourriel("e3@club.fr", "Votre CACI expire le 20/11/2026", "Bonjour");

        assertThat(parti).isFalse();
        assertThat(journal.getAll()).contains("Échec de l'envoi");
        assertThat(journal.getAll()).doesNotContain("e3@club.fr");
    }
}
