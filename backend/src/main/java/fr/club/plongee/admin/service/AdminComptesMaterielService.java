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
 * Directeurs techniques qui ne sont pas moniteurs du club (choix du club,
 * 2026-11-10) : rôle DIRECTEUR_TECHNIQUE seul, ni niveau d'encadrement, ni
 * CACI, ni photo ; ils n'apparaissent dans aucune liste de moniteurs. Ils ne
 * gèrent que le matériel, les prêts et les sorties ; tout le reste demande
 * le rôle MONITEUR. Le mot de passe se définit par le lien d'invitation.
 */
@Service
public class AdminComptesMaterielService {

    private static final SecureRandom ALEA = new SecureRandom();

    private final UtilisateurRepository utilisateurs;
    private final PasswordEncoder encodeur;
    private final ReinitialisationMotDePasseService reinitialisations;
    private final RefreshTokenRepository refreshTokens;

    public AdminComptesMaterielService(UtilisateurRepository utilisateurs, PasswordEncoder encodeur,
                                       ReinitialisationMotDePasseService reinitialisations,
                                       RefreshTokenRepository refreshTokens) {
        this.utilisateurs = utilisateurs;
        this.encodeur = encodeur;
        this.reinitialisations = reinitialisations;
        this.refreshTokens = refreshTokens;
    }

    /** Un directeur technique moniteur se gère dans l'écran Moniteurs, pas ici. */
    @Transactional(readOnly = true)
    public List<Utilisateur> lister() {
        return utilisateurs.parRole(RoleNom.DIRECTEUR_TECHNIQUE).stream()
                .filter(AdminComptesMaterielService::directeurTechniqueSeul)
                .toList();
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
        u.setRoles(EnumSet.of(RoleNom.DIRECTEUR_TECHNIQUE));
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

    /**
     * Pas de suppression : ses écritures au journal du matériel et aux prêts
     * font foi (Code du sport, A322-177) et le nomment. On désactive.
     */
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

    static boolean directeurTechniqueSeul(Utilisateur u) {
        return u.getRoles().contains(RoleNom.DIRECTEUR_TECHNIQUE)
                && !u.getRoles().contains(RoleNom.MONITEUR) && !u.getRoles().contains(RoleNom.ADMIN);
    }

    private Utilisateur compte(Long id) {
        return utilisateurs.findById(id).filter(AdminComptesMaterielService::directeurTechniqueSeul)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte de directeur technique introuvable"));
    }
}
