package fr.club.plongee.notification.service;

import fr.club.plongee.notification.courriel.CourrielRendu;
import fr.club.plongee.notification.courriel.GabaritCourriel;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import fr.club.plongee.securite.domain.Utilisateur;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * Implementation de secours pour le developpement : aucun serveur SMTP n'y
 * est configure, le lien est simplement trace dans les logs du serveur. En
 * production, {@link ServiceNotificationEmail} envoie reellement le courriel.
 */
@Service
@Profile("dev")
public class ServiceNotificationConsole implements ServiceNotification {

    private static final Logger log = LoggerFactory.getLogger(ServiceNotificationConsole.class);

    private final String urlFrontend;

    public ServiceNotificationConsole(@Value("${app.frontend-url}") String urlFrontend) {
        this.urlFrontend = urlFrontend;
    }

    @Override
    public void envoyerLienReinitialisation(Utilisateur destinataire, String jeton) {
        String lien = urlFrontend + "/reinitialiser-mot-de-passe?jeton=" + jeton;
        log.info("Lien de reinitialisation de mot de passe pour {} : {}", destinataire.getEmail(), lien);
    }

    @Override
    public void envoyerLienInvitation(Utilisateur destinataire, String jeton) {
        String lien = urlFrontend + "/reinitialiser-mot-de-passe?jeton=" + jeton + "&invitation=1";
        log.info("Lien d'invitation (definition du mot de passe) pour {} : {}", destinataire.getEmail(), lien);
    }

    @Override
    public boolean envoyerCourriel(String adresse, String sujet, String corps) {
        log.info("Courriel pour {} : {}\n{}", adresse, sujet, corps);
        return true;
    }

    @Override
    public boolean envoyerCourriel(String adresse, String sujet, String corps, String html) {
        envoyerCourriel(adresse, sujet, corps);
        apercu(sujet, html, null);
        return true;
    }

    @Override
    public boolean envoyerCourriel(String adresse, String sujet, CourrielRendu rendu) {
        envoyerCourriel(adresse, sujet, rendu.texte());
        apercu(sujet, rendu.html(), rendu.logo());
        return true;
    }

    /**
     * L'aperçu du HTML, à ouvrir dans un navigateur : {@code target/courriels/}
     * (profil dev seulement, données de démonstration ; le logo y est intégré
     * au lieu d'être joint). Un échec d'écriture n'empêche rien.
     */
    private void apercu(String sujet, String html, byte[] logo) {
        if (html == null) return;
        try {
            Path dossier = Path.of("target", "courriels");
            Files.createDirectories(dossier);
            String page = logo == null ? html : html.replace("cid:" + GabaritCourriel.CID_LOGO,
                    "data:image/png;base64," + Base64.getEncoder().encodeToString(logo));
            String nom = HORODATAGE.format(LocalDateTime.now()) + "-"
                    + Normalizer.normalize(sujet, Normalizer.Form.NFD).replaceAll("[^A-Za-z0-9]+", "-").replaceAll("^-|-$", "")
                    + ".html";
            Path fichier = dossier.resolve(nom.length() > 120 ? nom.substring(0, 115) + ".html" : nom);
            Files.writeString(fichier, page, StandardCharsets.UTF_8);
            log.info("Aperçu du courriel : {}", fichier.toAbsolutePath());
        } catch (IOException e) {
            log.warn("Aperçu du courriel non écrit : {}", e.getClass().getSimpleName());
        }
    }

    private static final DateTimeFormatter HORODATAGE = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");
}
