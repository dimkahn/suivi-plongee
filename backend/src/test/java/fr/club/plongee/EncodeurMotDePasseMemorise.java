package fr.club.plongee;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Accélère les tests sans changer ce qu'ils vérifient : BCrypt (coût 12,
 * {@code SecurityConfig}) prend environ 0,3 s par vérification, et les tests
 * se connectent des centaines de fois avec les mêmes comptes de démo. Le
 * résultat d'une vérification (mot de passe, empreinte) est donc gardé : la
 * première est faite par le vrai BCrypt, les suivantes donnent forcément la
 * même réponse. Un autre mot de passe ou une autre empreinte (mot de passe
 * changé) repasse par BCrypt. Le calcul des empreintes ({@code encode}) n'est
 * pas touché.
 *
 * <p>Composant des sources de test, trouvé par le balayage de
 * {@code PlongeeApplication} : il s'applique à tous les tests {@code @SpringBootTest}
 * sans annotation, donc sans contexte Spring supplémentaire. Jamais en production.
 */
@Component
class EncodeurMotDePasseMemorise implements BeanPostProcessor {

    @Override
    public Object postProcessAfterInitialization(Object bean, String nom) {
        return bean instanceof PasswordEncoder encodeur ? new Memorise(encodeur) : bean;
    }

    private static final class Memorise implements PasswordEncoder {

        private final PasswordEncoder vrai;
        private final Map<String, Boolean> verifications = new ConcurrentHashMap<>();

        Memorise(PasswordEncoder vrai) {
            this.vrai = vrai;
        }

        @Override
        public String encode(CharSequence motDePasse) {
            return vrai.encode(motDePasse);
        }

        @Override
        public boolean matches(CharSequence motDePasse, String empreinte) {
            if (motDePasse == null || empreinte == null) return vrai.matches(motDePasse, empreinte);
            return verifications.computeIfAbsent(motDePasse + "\u0000" + empreinte,
                    cle -> vrai.matches(motDePasse, empreinte));
        }

        @Override
        public boolean upgradeEncoding(String empreinte) {
            return vrai.upgradeEncoding(empreinte);
        }
    }
}
