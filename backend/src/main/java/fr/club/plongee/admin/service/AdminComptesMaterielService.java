package fr.club.plongee.admin.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.RefreshTokenRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import fr.club.plongee.securite.service.ReinitialisationMotDePasseService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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
 * Supprimé seulement s'il n'a rien enregistré, comme un moniteur.
 */
@Service
public class AdminComptesMaterielService {

    private static final SecureRandom ALEA = new SecureRandom();

    private final UtilisateurRepository utilisateurs;
    private final PasswordEncoder encodeur;
    private final ReinitialisationMotDePasseService reinitialisations;
    private final RefreshTokenRepository refreshTokens;
    private final NamedParameterJdbcTemplate jdbc;

    public AdminComptesMaterielService(UtilisateurRepository utilisateurs, PasswordEncoder encodeur,
                                       ReinitialisationMotDePasseService reinitialisations,
                                       RefreshTokenRepository refreshTokens, NamedParameterJdbcTemplate jdbc) {
        this.utilisateurs = utilisateurs;
        this.encodeur = encodeur;
        this.reinitialisations = reinitialisations;
        this.refreshTokens = refreshTokens;
        this.jdbc = jdbc;
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

    /**
     * Comme pour un moniteur : un compte qui n'a rien enregistré se supprime
     * (créé par erreur, jamais servi) ; sinon on le désactive, pour que le
     * journal du matériel (fiche de gestion, Code du sport A322-177, où
     * entrent aussi les fiches d'inspection TIV) et les prêts gardent qui a
     * fait quoi.
     */
    @Transactional
    public void supprimer(Long id) {
        Utilisateur u = compte(id);
        Integer traces = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM intervention_equipement WHERE saisi_par_id = :id)
                     + (SELECT COUNT(*) FROM pret WHERE prete_par_id = :id OR recu_par_id = :id OR utilisateur_id = :id)
                     + (SELECT COUNT(*) FROM photo_pret WHERE prise_par_id = :id)
                     + (SELECT COUNT(*) FROM sejour_pret WHERE declare_par_utilisateur_id = :id)""",
                new MapSqlParameterSource("id", id), Integer.class);
        if (traces != null && traces > 0) {
            throw new RegleMetierException("Ce directeur technique a des écritures au journal du matériel ou des "
                    + "prêts enregistrés : désactivez son compte plutôt que de le supprimer, pour garder l'historique.");
        }
        refreshTokens.revoquerTout(id);
        utilisateurs.delete(u);
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
