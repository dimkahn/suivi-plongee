package fr.club.plongee.securite.service;

import fr.club.plongee.securite.domain.ReinitialisationMotDePasse;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.ReinitialisationMotDePasseRepository;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.notification.service.ServiceNotification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Emission et consommation des jetons de reinitialisation de mot de passe.
 * Sert a la fois le "mot de passe oublie" en connexion et l'invitation d'un
 * moniteur cree par un ADMIN, qui definit ainsi son propre mot de passe sans
 * qu'il transite jamais en clair par l'administrateur.
 */
@Service
public class ReinitialisationMotDePasseService {

    private static final SecureRandom ALEA = new SecureRandom();
    private static final Duration DUREE_VALIDITE = Duration.ofHours(1);

    private final ReinitialisationMotDePasseRepository reinitialisations;
    private final ServiceNotification notifications;

    public ReinitialisationMotDePasseService(ReinitialisationMotDePasseRepository reinitialisations,
                                             ServiceNotification notifications) {
        this.reinitialisations = reinitialisations;
        this.notifications = notifications;
    }

    @Transactional
    public void demander(Utilisateur utilisateur) {
        String jeton = emettre(utilisateur);
        notifications.envoyerLienReinitialisation(utilisateur, jeton);
    }

    /** Comme {@link #demander}, mais pour l'invitation d'un moniteur tout juste créé par un ADMIN. */
    @Transactional
    public void inviter(Utilisateur utilisateur) {
        String jeton = emettre(utilisateur);
        notifications.envoyerLienInvitation(utilisateur, jeton);
    }

    private String emettre(Utilisateur utilisateur) {
        byte[] brut = new byte[32];
        ALEA.nextBytes(brut);
        String jeton = Base64.getUrlEncoder().withoutPadding().encodeToString(brut);

        ReinitialisationMotDePasse r = new ReinitialisationMotDePasse();
        r.setUtilisateur(utilisateur);
        r.setJetonHash(empreinte(jeton));
        r.setExpireLe(Instant.now().plus(DUREE_VALIDITE));
        reinitialisations.save(r);
        return jeton;
    }

    /** Valide le jeton, le marque consomme, et renvoie l'utilisateur concerne. */
    @Transactional
    public Utilisateur consommer(String jeton) {
        ReinitialisationMotDePasse r = reinitialisations.findByJetonHash(empreinte(jeton))
                .filter(x -> x.getUtiliseeLe() == null)
                .filter(x -> x.getExpireLe().isAfter(Instant.now()))
                .orElseThrow(() -> new RegleMetierException(
                        "Ce lien de réinitialisation est invalide ou a expiré."));
        r.setUtiliseeLe(Instant.now());
        return r.getUtilisateur();
    }

    private static String empreinte(String jeton) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(jeton.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
