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
    private static final fr.club.plongee.notification.courriel.GabaritCourriel GABARIT =
            new fr.club.plongee.notification.courriel.GabaritCourriel(new fr.club.plongee.notification.courriel.IdentiteDonnee());


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
                new SmtpEnPanne(), "club@exemple.fr", "http://localhost:4200", GABARIT);

        boolean parti = service.envoyerCourriel("e3@club.fr", "Votre CACI expire le 20/11/2026", "Bonjour");

        assertThat(parti).isFalse();
        assertThat(journal.getAll()).contains("Échec de l'envoi");
        assertThat(journal.getAll()).doesNotContain("e3@club.fr");
    }

    /** Serveur SMTP qui garde le dernier message MIME reçu. */
    static class SmtpQuiGarde extends JavaMailSenderImpl {
        jakarta.mail.internet.MimeMessage recu;
        SimpleMailMessage texteSeul;

        @Override
        public void send(jakarta.mail.internet.MimeMessage mimeMessage) {
            recu = mimeMessage;
        }

        @Override
        public void send(SimpleMailMessage simpleMessage) {
            texteSeul = simpleMessage;
        }
    }

    @Test
    @DisplayName("Un e-mail avec une version HTML part avec le texte et le HTML, la messagerie choisit")
    void texteEtHtml() throws Exception {
        SmtpQuiGarde smtp = new SmtpQuiGarde();
        ServiceNotificationEmail service = new ServiceNotificationEmail(smtp, "club@exemple.fr", "http://localhost:4200", GABARIT);

        boolean parti = service.envoyerCourriel("plongeur@exemple.fr", "Vos plongées — Séjour",
                "Bonjour Léa", "<table><tr><td>Le Donator</td></tr></table>");

        assertThat(parti).isTrue();
        assertThat(smtp.recu).isNotNull();
        smtp.recu.saveChanges();
        var sortie = new java.io.ByteArrayOutputStream();
        smtp.recu.writeTo(sortie);
        String brut = sortie.toString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(brut).contains("multipart/alternative", "text/plain", "text/html");
        assertThat(smtp.recu.getSubject()).isEqualTo("Vos plongées — Séjour");
    }

    @Test
    @DisplayName("Un e-mail mis en forme part avec son logo joint au message, référencé par cid:, rien à télécharger")
    void logoJoint() throws Exception {
        SmtpQuiGarde smtp = new SmtpQuiGarde();
        ServiceNotificationEmail service = new ServiceNotificationEmail(smtp, "club@exemple.fr", "http://localhost:4200", GABARIT);
        var rendu = new fr.club.plongee.notification.courriel.CourrielRendu("Bonjour Léa",
                "<img src=\"cid:logo-structure\"><p>Bonjour Léa</p>", new byte[] {(byte) 0x89, 'P', 'N', 'G'});

        assertThat(service.envoyerCourriel("plongeur@exemple.fr", "Votre code", rendu)).isTrue();

        smtp.recu.saveChanges();
        var sortie = new java.io.ByteArrayOutputStream();
        smtp.recu.writeTo(sortie);
        String brut = sortie.toString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(brut).contains("multipart/related", "text/plain", "text/html", "image/png", "Content-ID: <logo-structure>");
    }

    /** Le message MIME reçu, en texte brut (en-têtes et parties décodées seulement pour le texte). */
    private static String brut(jakarta.mail.internet.MimeMessage m) throws Exception {
        m.saveChanges();
        var sortie = new java.io.ByteArrayOutputStream();
        m.writeTo(sortie);
        return sortie.toString(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("Mot de passe oublié : un e-mail mis en forme, bouton vers la page, lien en clair dans le texte, logo joint")
    void reinitialisationMiseEnForme() throws Exception {
        SmtpQuiGarde smtp = new SmtpQuiGarde();
        ServiceNotificationEmail service = new ServiceNotificationEmail(smtp, "club@exemple.fr", "http://localhost:4200", GABARIT);
        var lea = new fr.club.plongee.securite.domain.Utilisateur();
        lea.setPrenom("Léa");
        lea.setEmail("lea@exemple.fr");

        service.envoyerLienReinitialisation(lea, "jeton123");

        assertThat(smtp.texteSeul).as("plus d'e-mail en texte seul").isNull();
        assertThat(smtp.recu).as("un e-mail mis en forme est parti").isNotNull();
        assertThat(smtp.recu.getSubject()).isEqualTo("Réinitialisation de votre mot de passe");
        String brut = brut(smtp.recu);
        assertThat(brut).contains("text/html", "Content-ID: <logo-structure>");
        assertThat(smtp.recu.getContent().toString()).isNotEmpty();
    }

    @Test
    @DisplayName("Invitation d'un moniteur : un e-mail mis en forme, avec son logo joint")
    void invitationMiseEnForme() throws Exception {
        SmtpQuiGarde smtp = new SmtpQuiGarde();
        ServiceNotificationEmail service = new ServiceNotificationEmail(smtp, "club@exemple.fr", "http://localhost:4200", GABARIT);
        var hugo = new fr.club.plongee.securite.domain.Utilisateur();
        hugo.setPrenom("Hugo");
        hugo.setEmail("hugo@exemple.fr");

        service.envoyerLienInvitation(hugo, "jeton456");

        assertThat(smtp.texteSeul).as("plus d'e-mail en texte seul").isNull();
        assertThat(smtp.recu).as("un e-mail mis en forme est parti").isNotNull();
        assertThat(smtp.recu.getSubject()).isEqualTo("Bienvenue : créez votre mot de passe");
        assertThat(brut(smtp.recu)).contains("text/html", "Content-ID: <logo-structure>");
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
                new SmtpRefuseLeDestinataire(), "club@exemple.fr", "http://localhost:4200", GABARIT);

        boolean parti = service.envoyerCourriel("e3@club.fr", "Votre CACI expire le 20/11/2026", "Bonjour");

        assertThat(parti).isFalse();
        assertThat(journal.getAll()).contains("Échec de l'envoi");
        assertThat(journal.getAll()).doesNotContain("e3@club.fr");
    }
}
