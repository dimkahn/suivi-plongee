package fr.club.plongee.formation.service;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Base64;

/**
 * Logo du club (documents/logo-club.png, tiré de frontend/public/icones/icone-512.png),
 * imprimé en en-tête des exports de la fiche de sécurité. Lu une fois au démarrage.
 */
@Component
public class LogoClub {

    private final byte[] png;

    public LogoClub() {
        try (InputStream entree = new ClassPathResource("documents/logo-club.png").getInputStream()) {
            this.png = entree.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Logo du club introuvable (documents/logo-club.png)", e);
        }
    }

    public byte[] png() {
        return png;
    }

    /** Pour une balise img dans le HTML converti en PDF. */
    public String dataUri() {
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(png);
    }
}
