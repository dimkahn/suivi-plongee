package fr.club.plongee.admin.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.RefreshTokenRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import fr.club.plongee.securite.service.ReinitialisationMotDePasseService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;

/**
 * Comptes « sécurité surface » (choix du club, 2026) : une personne qui
 * n'est pas moniteur du club et qui, sur une sortie, ne fait que compléter
 * les fiches de sécurité au retour de plongée. Rôle SECURITE_SURFACE seul :
 * ni niveau d'encadrement, ni CACI, ni photo ; elle n'apparaît dans aucune
 * liste de moniteurs. Créée par un ADMIN, elle définit son mot de passe par
 * le lien d'invitation, comme un moniteur.
 */
@Service
public class AdminSecuriteSurfaceService {

    private static final SecureRandom ALEA = new SecureRandom();

    private final UtilisateurRepository utilisateurs;
    private final PasswordEncoder encodeur;
    private final ReinitialisationMotDePasseService reinitialisations;
    private final RefreshTokenRepository refreshTokens;

    public AdminSecuriteSurfaceService(UtilisateurRepository utilisateurs, PasswordEncoder encodeur,
                                       ReinitialisationMotDePasseService reinitialisations,
                                       RefreshTokenRepository refreshTokens) {
        this.utilisateurs = utilisateurs;
        this.encodeur = encodeur;
        this.reinitialisations = reinitialisations;
        this.refreshTokens = refreshTokens;
    }

    @Transactional(readOnly = true)
    public List<Utilisateur> lister() {
        return utilisateurs.parRole(RoleNom.SECURITE_SURFACE);
    }

    @Transactional
    public Utilisateur creer(String email, String nom, String prenom) {
        String adresse = email.trim();
        if (utilisateurs.existsByEmailIgnoreCase(adresse)) {
            throw new RegleMetierException("Un compte existe déjà avec cet e-mail.");
        }
        Utilisateur u = new Utilisateur();
        u.setEmail(adresse);
        u.setNom(nom.trim());
        u.setPrenom(prenom.trim());
        u.setActif(true);
        u.setRoles(EnumSet.of(RoleNom.SECURITE_SURFACE));
        byte[] brut = new byte[32];
        ALEA.nextBytes(brut);
        // Mot de passe connu de personne : écrasé dès que le lien d'invitation a servi.
        u.setMotDePasse(encodeur.encode(Base64.getUrlEncoder().encodeToString(brut)));
        utilisateurs.save(u);
        reinitialisations.inviter(u);
        return u;
    }

    @Transactional
    public Utilisateur modifier(Long id, String email, String nom, String prenom) {
        Utilisateur u = compte(id);
        String adresse = email.trim();
        boolean emailChange = !adresse.equalsIgnoreCase(u.getEmail());
        if (emailChange && utilisateurs.existsByEmailIgnoreCase(adresse)) {
            throw new RegleMetierException("Un compte existe déjà avec cet e-mail.");
        }
        u.setEmail(adresse);
        u.setNom(nom.trim());
        u.setPrenom(prenom.trim());
        utilisateurs.save(u);
        // Le jeton d'accès porte l'e-mail : on se reconnecte avec la nouvelle adresse.
        if (emailChange) refreshTokens.revoquerTout(id);
        return u;
    }

    @Transactional
    public Utilisateur changerActivation(Long id, boolean actif) {
        Utilisateur u = compte(id);
        u.setActif(actif);
        utilisateurs.save(u);
        if (!actif) refreshTokens.revoquerTout(id);
        return u;
    }

    @Transactional
    public void envoyerLienReinitialisation(Long id) {
        Utilisateur u = compte(id);
        if (!u.isActif()) {
            throw new RegleMetierException(
                    "Ce compte est désactivé : réactivez-le avant d'envoyer un lien de réinitialisation.");
        }
        reinitialisations.demander(u);
    }

    /** Rien ne garde trace de son auteur dans le complément d'une fiche : la suppression est toujours possible. */
    @Transactional
    public void supprimer(Long id) {
        Utilisateur u = compte(id);
        refreshTokens.revoquerTout(id);
        utilisateurs.delete(u);
    }

    private Utilisateur compte(Long id) {
        Utilisateur u = utilisateurs.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte de sécurité surface introuvable"));
        if (!u.getRoles().contains(RoleNom.SECURITE_SURFACE)) {
            throw new RessourceIntrouvableException("Compte de sécurité surface introuvable");
        }
        return u;
    }
}
