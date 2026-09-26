package fr.club.plongee.securite.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.RefreshTokenRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ce qu'un utilisateur connecte peut modifier sur son propre compte : son
 * identite, son e-mail et son mot de passe. Le niveau d'encadrement, les
 * roles et l'activation restent du ressort de l'ADMIN
 * ({@code AdminMoniteurService}) : un moniteur ne s'accorde pas lui-meme le
 * droit de noter un niveau superieur.
 *
 * <p>L'identifiant du compte vient toujours du SecurityContext, jamais du
 * corps de la requete.
 */
@Service
public class MonCompteService {

    public static final int LONGUEUR_MIN_MOT_DE_PASSE = 10;

    private final UtilisateurRepository utilisateurs;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encodeur;

    public MonCompteService(UtilisateurRepository utilisateurs, RefreshTokenRepository refreshTokens,
                            PasswordEncoder encodeur) {
        this.utilisateurs = utilisateurs;
        this.refreshTokens = refreshTokens;
        this.encodeur = encodeur;
    }

    /**
     * Seul le n° de licence se modifie depuis « Mon compte ». Nom et prénom
     * sont fixés par un ADMIN (écran Moniteurs) : ils figurent sur les fiches
     * de sécurité et dans l'historique des évaluations, un encadrant ne doit
     * pas pouvoir les changer lui-même.
     */
    @Transactional
    public Utilisateur modifierLicence(Long id, String numeroLicence) {
        Utilisateur u = compte(id);
        u.setNumeroLicence(numeroLicence == null || numeroLicence.isBlank() ? null : numeroLicence.trim());
        return utilisateurs.save(u);
    }

    /**
     * L'e-mail est l'identifiant de connexion : on redemande le mot de passe
     * actuel, pour qu'une session laissee ouverte sur un telephone du club ne
     * suffise pas a s'approprier le compte.
     */
    @Transactional
    public Utilisateur changerEmail(Long id, String nouvelEmail, String motDePasseActuel) {
        Utilisateur u = compte(id);
        verifierMotDePasseActuel(u, motDePasseActuel);
        String email = nouvelEmail.trim();
        if (email.equalsIgnoreCase(u.getEmail())) return u;
        if (utilisateurs.existsByEmailIgnoreCase(email)) {
            throw new RegleMetierException("Un compte existe déjà avec cet e-mail.");
        }
        u.setEmail(email);
        return utilisateurs.save(u);
    }

    /**
     * Revoque toutes les sessions ouvertes : a l'appelant d'en rouvrir une
     * pour l'appareil courant.
     */
    @Transactional
    public Utilisateur changerMotDePasse(Long id, String motDePasseActuel, String nouveauMotDePasse) {
        Utilisateur u = compte(id);
        verifierMotDePasseActuel(u, motDePasseActuel);
        if (nouveauMotDePasse == null || nouveauMotDePasse.length() < LONGUEUR_MIN_MOT_DE_PASSE) {
            throw new RegleMetierException(
                    "Le mot de passe doit compter au moins " + LONGUEUR_MIN_MOT_DE_PASSE + " caractères.");
        }
        u.setMotDePasse(encodeur.encode(nouveauMotDePasse));
        utilisateurs.save(u);
        refreshTokens.revoquerTout(id);
        return u;
    }

    private void verifierMotDePasseActuel(Utilisateur u, String motDePasseActuel) {
        if (motDePasseActuel == null || !encodeur.matches(motDePasseActuel, u.getMotDePasse())) {
            throw new RegleMetierException("Le mot de passe actuel est incorrect.");
        }
    }

    private Utilisateur compte(Long id) {
        return utilisateurs.findById(id).orElseThrow();
    }
}
