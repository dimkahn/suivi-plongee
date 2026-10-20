package fr.club.plongee.admin.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.RefreshTokenRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import fr.club.plongee.securite.service.ReinitialisationMotDePasseService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.Base64;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;

/**
 * Comptes « sécurité surface » (choix du club, 2026) : une personne qui
 * n'est pas moniteur du club et qui, sur une sortie, ne fait que compléter
 * les fiches de sécurité au retour de plongée. Rôle SECURITE_SURFACE seul :
 * ni niveau d'encadrement, ni CACI, ni photo ; elle n'apparaît dans aucune
 * liste de moniteurs. Créée par un ADMIN pour une sortie, une séance ou
 * quelques séances, elle ne voit que les fiches de ces séances, et jusqu'à
 * une date de fin d'accès (incluse) ; on la réactive ensuite pour d'autres
 * séances. Elle définit son mot de passe par le lien d'invitation, comme un
 * moniteur.
 */
@Service
public class AdminSecuriteSurfaceService {

    private static final SecureRandom ALEA = new SecureRandom();

    /** Séances confiées et date de fin d'accès, demandées à la création, à la modification et à la réactivation. */
    public record Acces(List<Long> seanceIds, LocalDate accesJusquAu) {}

    /** Un compte et ses séances, lues dans la même transaction. */
    public record Compte(Utilisateur utilisateur, List<Seance> seances) {}

    private final UtilisateurRepository utilisateurs;
    private final SeanceRepository seances;
    private final PasswordEncoder encodeur;
    private final ReinitialisationMotDePasseService reinitialisations;
    private final RefreshTokenRepository refreshTokens;

    public AdminSecuriteSurfaceService(UtilisateurRepository utilisateurs, SeanceRepository seances,
                                       PasswordEncoder encodeur,
                                       ReinitialisationMotDePasseService reinitialisations,
                                       RefreshTokenRepository refreshTokens) {
        this.utilisateurs = utilisateurs;
        this.seances = seances;
        this.encodeur = encodeur;
        this.reinitialisations = reinitialisations;
        this.refreshTokens = refreshTokens;
    }

    @Transactional(readOnly = true)
    public List<Compte> lister() {
        return utilisateurs.parRole(RoleNom.SECURITE_SURFACE).stream().map(this::compte).toList();
    }

    @Transactional
    public Compte creer(String email, String nom, String prenom, Acces acces) {
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
        confier(u, acces);
        byte[] brut = new byte[32];
        ALEA.nextBytes(brut);
        // Mot de passe connu de personne : écrasé dès que le lien d'invitation a servi.
        u.setMotDePasse(encodeur.encode(Base64.getUrlEncoder().encodeToString(brut)));
        utilisateurs.save(u);
        reinitialisations.inviter(u);
        return compte(u);
    }

    @Transactional
    public Compte modifier(Long id, String email, String nom, String prenom, Acces acces) {
        Utilisateur u = utilisateur(id);
        String adresse = email.trim();
        boolean emailChange = !adresse.equalsIgnoreCase(u.getEmail());
        if (emailChange && utilisateurs.existsByEmailIgnoreCase(adresse)) {
            throw new RegleMetierException("Un compte existe déjà avec cet e-mail.");
        }
        u.setEmail(adresse);
        u.setNom(nom.trim());
        u.setPrenom(prenom.trim());
        confier(u, acces);
        utilisateurs.save(u);
        // Le jeton d'accès porte l'e-mail : on se reconnecte avec la nouvelle adresse.
        if (emailChange) refreshTokens.revoquerTout(id);
        return compte(u);
    }

    /** Réactiver demande les séances confiées et une nouvelle date de fin d'accès ; désactiver, rien. */
    @Transactional
    public Compte changerActivation(Long id, boolean actif, Acces acces) {
        Utilisateur u = utilisateur(id);
        if (actif) confier(u, acces);
        u.setActif(actif);
        utilisateurs.save(u);
        if (!actif) refreshTokens.revoquerTout(id);
        return compte(u);
    }

    @Transactional
    public void envoyerLienReinitialisation(Long id) {
        Utilisateur u = utilisateur(id);
        if (!u.estActifLe(Calendrier.aujourdhui())) {
            throw new RegleMetierException(
                    "Ce compte est désactivé : réactivez-le avant d'envoyer un lien de réinitialisation.");
        }
        reinitialisations.demander(u);
    }

    /** Rien ne garde trace de son auteur dans le complément d'une fiche : la suppression est toujours possible. */
    @Transactional
    public void supprimer(Long id) {
        Utilisateur u = utilisateur(id);
        refreshTokens.revoquerTout(id);
        utilisateurs.delete(u);
    }

    private void confier(Utilisateur u, Acces acces) {
        List<Long> ids = acces.seanceIds() == null ? List.of()
                : acces.seanceIds().stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            throw new RegleMetierException("Choisissez au moins une séance dont la personne complétera la fiche.");
        }
        LocalDate fin = acces.accesJusquAu();
        if (fin == null) {
            throw new RegleMetierException("Indiquez la date de fin d'accès : le compte se désactive le lendemain.");
        }
        if (fin.isBefore(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date de fin d'accès est déjà passée : choisissez aujourd'hui ou plus tard.");
        }
        List<Seance> choisies = seances.findAllById(ids);
        if (choisies.size() != ids.size()) {
            throw new RessourceIntrouvableException("Séance introuvable");
        }
        u.setSeancesSecuriteSurface(new HashSet<>(ids));
        u.setAccesJusquAu(fin);
    }

    private Compte compte(Utilisateur u) {
        List<Seance> liste = seances.findAllById(u.getSeancesSecuriteSurface()).stream()
                .sorted(Comparator.comparing(Seance::getDateSeance).thenComparing(Seance::getOrdre))
                .toList();
        return new Compte(u, liste);
    }

    private Utilisateur utilisateur(Long id) {
        Utilisateur u = utilisateurs.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte de sécurité surface introuvable"));
        if (!u.getRoles().contains(RoleNom.SECURITE_SURFACE)) {
            throw new RessourceIntrouvableException("Compte de sécurité surface introuvable");
        }
        return u;
    }
}
