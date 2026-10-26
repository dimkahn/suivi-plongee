package fr.club.plongee.notification.push;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * La clé publique des notifications, que le navigateur demande pour
 * s'abonner. Ouverte sans connexion (SecurityConfig) : un participant sans
 * compte s'abonne depuis la page du lien. Elle n'a rien de secret.
 */
@RestController
public class ClePushController {

    public record ClePubliqueVue(String clePublique) {}

    private final ServiceClesVapid cles;

    public ClePushController(ServiceClesVapid cles) {
        this.cles = cles;
    }

    @GetMapping("/api/public/notifications/cle")
    public ClePubliqueVue cle() {
        return new ClePubliqueVue(cles.cles().publique());
    }
}
