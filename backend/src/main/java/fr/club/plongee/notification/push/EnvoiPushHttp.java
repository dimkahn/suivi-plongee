package fr.club.plongee.notification.push;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.spec.ECGenParameterSpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * L'envoi réel : le message chiffré pour le téléphone ({@link ChiffrementPush}),
 * signé de nos clés VAPID, posté à l'adresse de son service de notification.
 * Le journal d'un échec ne garde que le code HTTP, jamais l'adresse.
 */
@Service
public class EnvoiPushHttp implements EnvoiPush {

    private static final Logger LOG = LoggerFactory.getLogger(EnvoiPushHttp.class);
    /** Le service garde la notification un jour si le téléphone est éteint. */
    private static final int DUREE_DE_VIE_SECONDES = 86_400;

    private final ServiceClesVapid cles;
    private final String contact;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final SecureRandom hasard = new SecureRandom();

    public EnvoiPushHttp(ServiceClesVapid cles, @Value("${app.frontend-url}") String urlFrontend) {
        this.cles = cles;
        this.contact = urlFrontend;
    }

    @Override
    public Resultat envoyer(AbonnementPush a, String json) {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair ephemere = g.generateKeyPair();
            byte[] sel = new byte[16];
            hasard.nextBytes(sel);
            Base64.Decoder d64 = Base64.getUrlDecoder();
            byte[] corps = ChiffrementPush.chiffrer(json.getBytes(StandardCharsets.UTF_8), d64.decode(a.p256dh()),
                    d64.decode(a.auth()), ephemere, sel);
            ClesVapid vapid = cles.cles();
            String jeton = vapid.jeton(a.endpoint(), contact,
                    Instant.now().getEpochSecond() + ClesVapid.SECONDES_VALIDITE_JETON);
            HttpRequest requete = HttpRequest.newBuilder(URI.create(a.endpoint()))
                    .timeout(Duration.ofSeconds(15))
                    .header("TTL", String.valueOf(DUREE_DE_VIE_SECONDES))
                    .header("Urgency", "normal")
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("Authorization", "vapid t=" + jeton + ", k=" + vapid.publique())
                    .POST(HttpRequest.BodyPublishers.ofByteArray(corps))
                    .build();
            int statut = client.send(requete, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (statut == 404 || statut == 410) return Resultat.EXPIRE;
            if (statut >= 200 && statut < 300) return Resultat.ENVOYE;
            LOG.warn("Notification refusée par le service de notification (HTTP {})", statut);
            return Resultat.ECHEC;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Resultat.ECHEC;
        } catch (Exception e) {
            LOG.warn("Notification non envoyée ({})", e.getClass().getSimpleName());
            return Resultat.ECHEC;
        }
    }
}
