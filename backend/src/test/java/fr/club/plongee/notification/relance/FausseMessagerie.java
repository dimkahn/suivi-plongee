package fr.club.plongee.notification.relance;

import fr.club.plongee.notification.service.ServiceNotification;
import fr.club.plongee.securite.domain.Utilisateur;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Fausse messagerie des tests des relances CACI : enregistre chaque courriel
 * (adresse, sujet, corps) et refuse ceux des adresses de {@link Boite#refusees},
 * comme un serveur SMTP qui ne les accepte pas ; {@link Boite#apresEnvoi} simule
 * ce qui se passe ailleurs juste après un envoi accepté. À vider en {@code @BeforeEach}.
 */
@TestConfiguration
public class FausseMessagerie {

    public record Message(String adresse, String sujet, String corps) {}

    public static class Boite implements ServiceNotification {

        private final List<Message> messages = new ArrayList<>();
        private final Set<String> refusees = new HashSet<>();
        private final Map<String, Runnable> apresEnvoi = new HashMap<>();

        @Override public void envoyerLienReinitialisation(Utilisateur destinataire, String jeton) {}

        @Override public void envoyerLienInvitation(Utilisateur destinataire, String jeton) {}

        @Override
        public synchronized boolean envoyerCourriel(String adresse, String sujet, String corps) {
            if (refusees.contains(adresse)) return false;
            messages.add(new Message(adresse, sujet, corps));
            apresEnvoi.getOrDefault(adresse, () -> {}).run();
            return true;
        }

        /** Les courriels partis vers cette adresse, dans l'ordre d'envoi. */
        public synchronized List<Message> vers(String adresse) {
            return messages.stream().filter(m -> m.adresse().equals(adresse)).toList();
        }

        public synchronized void refuser(String adresse) {
            refusees.add(adresse);
        }

        public synchronized void accepter(String adresse) {
            refusees.remove(adresse);
        }

        /** Action lancée juste après un envoi accepté vers cette adresse. */
        public synchronized void apresEnvoi(String adresse, Runnable action) {
            apresEnvoi.put(adresse, action);
        }

        public synchronized void vider() {
            messages.clear();
            refusees.clear();
            apresEnvoi.clear();
        }
    }

    @Bean
    @Primary
    Boite fausseMessagerie() {
        return new Boite();
    }
}
