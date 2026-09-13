package fr.club.plongee.admin;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.delivrance.DelivranceRepository;
import fr.club.plongee.evaluation.EvaluationRepository;
import fr.club.plongee.evaluation.ValidationCompetenceRepository;
import fr.club.plongee.formation.CursusRepository;
import fr.club.plongee.formation.SeanceRepository;
import fr.club.plongee.securite.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;

/**
 * Gestion des comptes moniteurs par un ADMIN : creation, activation,
 * desactivation, changement de mot de passe, suppression. L'authentification
 * elle-meme (connexion, mot de passe oublie) reste dans {@code securite}.
 */
@Service
public class AdminMoniteurService {

    private static final int LONGUEUR_MIN_MOT_DE_PASSE = 10;
    private static final SecureRandom ALEA = new SecureRandom();

    private final UtilisateurRepository utilisateurs;
    private final PasswordEncoder encodeur;
    private final ReinitialisationMotDePasseService reinitialisations;
    private final RefreshTokenRepository refreshTokens;
    private final EvaluationRepository evaluations;
    private final ValidationCompetenceRepository validations;
    private final DelivranceRepository delivrances;
    private final SeanceRepository seances;
    private final CursusRepository cursus;

    public AdminMoniteurService(UtilisateurRepository utilisateurs, PasswordEncoder encodeur,
                               ReinitialisationMotDePasseService reinitialisations,
                               RefreshTokenRepository refreshTokens,
                               EvaluationRepository evaluations,
                               ValidationCompetenceRepository validations,
                               DelivranceRepository delivrances,
                               SeanceRepository seances,
                               CursusRepository cursus) {
        this.utilisateurs = utilisateurs;
        this.encodeur = encodeur;
        this.reinitialisations = reinitialisations;
        this.refreshTokens = refreshTokens;
        this.evaluations = evaluations;
        this.validations = validations;
        this.delivrances = delivrances;
        this.seances = seances;
        this.cursus = cursus;
    }

    @Transactional(readOnly = true)
    public List<Utilisateur> lister() {
        return utilisateurs.parRole(RoleNom.MONITEUR);
    }

    /**
     * Le moniteur cree definit lui-meme son mot de passe via le lien envoye
     * (memes jetons que le "mot de passe oublie") : aucun mot de passe ne
     * transite en clair par l'administrateur.
     */
    @Transactional
    public Utilisateur creer(String email, String nom, String prenom,
                             NiveauEncadrement niveauEncadrement, String numeroLicence) {
        if (utilisateurs.existsByEmailIgnoreCase(email)) {
            throw new RegleMetierException("Un compte existe déjà avec cet e-mail.");
        }

        Utilisateur u = new Utilisateur();
        u.setEmail(email);
        u.setNom(nom);
        u.setPrenom(prenom);
        u.setNiveauEncadrement(niveauEncadrement);
        u.setNumeroLicence(numeroLicence);
        u.setActif(true);
        u.setRoles(EnumSet.of(RoleNom.MONITEUR));

        byte[] brut = new byte[32];
        ALEA.nextBytes(brut);
        // Mot de passe connu de personne : ecrase des que le moniteur suit le lien d'invitation.
        u.setMotDePasse(encodeur.encode(Base64.getUrlEncoder().encodeToString(brut)));

        utilisateurs.save(u);
        reinitialisations.demander(u);
        return u;
    }

    @Transactional
    public Utilisateur changerActivation(Long id, Long auteurId, boolean actif) {
        Utilisateur u = moniteur(id);
        if (!actif && u.getId().equals(auteurId)) {
            throw new RegleMetierException("Vous ne pouvez pas désactiver votre propre compte.");
        }
        u.setActif(actif);
        utilisateurs.save(u);
        // Une desactivation coupe court aux sessions deja ouvertes.
        if (!actif) refreshTokens.revoquerTout(u.getId());
        return u;
    }

    @Transactional
    public void changerMotDePasse(Long id, String nouveauMotDePasse) {
        if (nouveauMotDePasse == null || nouveauMotDePasse.length() < LONGUEUR_MIN_MOT_DE_PASSE) {
            throw new RegleMetierException(
                    "Le mot de passe doit compter au moins " + LONGUEUR_MIN_MOT_DE_PASSE + " caractères.");
        }
        Utilisateur u = moniteur(id);
        u.setMotDePasse(encodeur.encode(nouveauMotDePasse));
        utilisateurs.save(u);
        refreshTokens.revoquerTout(id);
    }

    @Transactional
    public void supprimer(Long id, Long auteurId) {
        Utilisateur u = moniteur(id);
        if (u.getId().equals(auteurId)) {
            throw new RegleMetierException("Vous ne pouvez pas supprimer votre propre compte.");
        }
        if (evaluations.existsByMoniteurId(id) || validations.existsByMoniteurId(id)
                || delivrances.existsByDelivreParId(id) || cursus.existsByMoniteurReferentId(id)
                || seances.existsByDpId(id)) {
            throw new RegleMetierException(
                    "Ce moniteur a des évaluations, validations ou séances enregistrées : "
                            + "désactivez son compte plutôt que de le supprimer, pour garder l'historique.");
        }
        refreshTokens.revoquerTout(id);
        utilisateurs.delete(u);
    }

    private Utilisateur moniteur(Long id) {
        Utilisateur u = utilisateurs.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Moniteur introuvable"));
        if (!u.getRoles().contains(RoleNom.MONITEUR)) {
            throw new RessourceIntrouvableException("Moniteur introuvable");
        }
        return u;
    }
}
