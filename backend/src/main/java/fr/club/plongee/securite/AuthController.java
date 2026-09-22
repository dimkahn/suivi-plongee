package fr.club.plongee.securite;

import fr.club.plongee.securite.domain.*;
import fr.club.plongee.securite.repository.*;
import fr.club.plongee.securite.service.*;

import fr.club.plongee.commun.RegleMetierException;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** seSouvenir absent (ancienne version de l'appli en cache) : comportement historique, persistant. */
    public record DemandeConnexion(@NotBlank @Email String email, @NotBlank String motDePasse,
                                   Boolean seSouvenir) {}

    public record Session(String jetonAcces, long expireDansSecondes, String nomComplet,
                          String email, List<String> roles, String niveauEncadrement,
                          String nom, String prenom, String numeroLicence) {}

    public record DemandeMotDePasseOublie(@NotBlank @Email String email) {}

    public record DemandeReinitialisation(@NotBlank String jeton, @NotBlank String nouveauMotDePasse) {}

    public record DemandeIdentite(@NotBlank String nom, @NotBlank String prenom, String numeroLicence) {}

    public record DemandeChangementEmail(@NotBlank @Email String nouvelEmail, @NotBlank String motDePasseActuel) {}

    public record DemandeChangementMotDePasse(@NotBlank String motDePasseActuel, @NotBlank String nouveauMotDePasse) {}

    private static final String COOKIE_REFRESH = "refresh";
    private static final SecureRandom ALEA = new SecureRandom();
    private static final int LONGUEUR_MIN_MOT_DE_PASSE = MonCompteService.LONGUEUR_MIN_MOT_DE_PASSE;

    private final AuthenticationManager authManager;
    private final DetailsUtilisateurService detailsService;
    private final UtilisateurRepository utilisateurs;
    private final RefreshTokenRepository refreshTokens;
    private final JwtService jwtService;
    private final PasswordEncoder encodeur;
    private final ReinitialisationMotDePasseService reinitialisations;
    private final MonCompteService monCompte;
    private final Duration dureeRefresh;
    private final Duration dureeSession;

    public AuthController(AuthenticationManager authManager, DetailsUtilisateurService detailsService,
                          UtilisateurRepository utilisateurs, RefreshTokenRepository refreshTokens,
                          JwtService jwtService, PasswordEncoder encodeur,
                          ReinitialisationMotDePasseService reinitialisations,
                          MonCompteService monCompte,
                          @Value("${app.jwt.duree-refresh-jours}") long jours,
                          @Value("${app.jwt.duree-session-heures}") long heuresSession) {
        this.authManager = authManager;
        this.detailsService = detailsService;
        this.utilisateurs = utilisateurs;
        this.refreshTokens = refreshTokens;
        this.jwtService = jwtService;
        this.encodeur = encodeur;
        this.reinitialisations = reinitialisations;
        this.monCompte = monCompte;
        this.dureeRefresh = Duration.ofDays(jours);
        this.dureeSession = Duration.ofHours(heuresSession);
    }

    @PostMapping("/connexion")
    @Transactional
    public Session connexion(@Valid @RequestBody DemandeConnexion demande, HttpServletResponse reponse) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(demande.email(), demande.motDePasse()));
        Utilisateur u = utilisateurs.findByEmailIgnoreCase(demande.email()).orElseThrow();
        poserCookieRefresh(u, !Boolean.FALSE.equals(demande.seSouvenir()), reponse);
        return session(UtilisateurPrincipal.de(u), u);
    }

    @PostMapping("/rafraichir")
    @Transactional
    public Session rafraichir(@CookieValue(name = COOKIE_REFRESH, required = false) String jeton,
                              HttpServletResponse reponse) {
        if (jeton == null) throw new BadCredentialsException("Session expiree");
        RefreshToken enregistre = refreshTokens.findByEmpreinteAndRevoqueFalse(empreinte(jeton))
                .filter(t -> t.getExpireLe().isAfter(Instant.now()))
                .orElseThrow(() -> new BadCredentialsException("Session expiree"));

        // rotation : le jeton presente est revoque et remplace
        enregistre.setRevoque(true);
        Utilisateur u = enregistre.getUtilisateur();
        poserCookieRefresh(u, enregistre.isPersistant(), reponse);
        return session(UtilisateurPrincipal.de(u), u);
    }

    @PostMapping("/deconnexion")
    @Transactional
    public ResponseEntity<Void> deconnexion(@AuthenticationPrincipal UtilisateurPrincipal principal,
                                            HttpServletResponse reponse) {
        if (principal != null) refreshTokens.revoquerTout(principal.id());
        reponse.addHeader("Set-Cookie", cookie("", Duration.ZERO).toString());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/moi")
    public Session moi(@AuthenticationPrincipal UtilisateurPrincipal principal) {
        Utilisateur u = utilisateurs.findById(principal.id()).orElseThrow();
        return session(principal, u);
    }

    /*
     * Modification de son propre compte. Chaque reponse renvoie une session
     * a jour : le nom affiche change, et le jeton d'acces porte l'e-mail en
     * sujet, donc l'ancien ne vaut plus rien apres un changement d'e-mail.
     * Le niveau d'encadrement n'est pas modifiable ici (reserve a l'ADMIN).
     */

    @PutMapping("/moi")
    public Session modifierIdentite(@AuthenticationPrincipal UtilisateurPrincipal principal,
                                    @Valid @RequestBody DemandeIdentite demande) {
        Utilisateur u = monCompte.modifierIdentite(principal.id(), demande.nom(), demande.prenom(),
                demande.numeroLicence());
        return session(UtilisateurPrincipal.de(u), u);
    }

    @PutMapping("/moi/email")
    public Session changerEmail(@AuthenticationPrincipal UtilisateurPrincipal principal,
                                @Valid @RequestBody DemandeChangementEmail demande) {
        Utilisateur u = monCompte.changerEmail(principal.id(), demande.nouvelEmail(),
                demande.motDePasseActuel());
        return session(UtilisateurPrincipal.de(u), u);
    }

    /**
     * Les sessions ouvertes ailleurs sont fermees ; celle de cet appareil est
     * rouverte, avec le meme choix « se souvenir de moi » qu'avant.
     */
    @PutMapping("/moi/mot-de-passe")
    @Transactional
    public Session changerMotDePasse(@AuthenticationPrincipal UtilisateurPrincipal principal,
                                     @Valid @RequestBody DemandeChangementMotDePasse demande,
                                     @CookieValue(name = COOKIE_REFRESH, required = false) String jeton,
                                     HttpServletResponse reponse) {
        boolean persistant = jeton == null || refreshTokens.findByEmpreinteAndRevoqueFalse(empreinte(jeton))
                .map(RefreshToken::isPersistant).orElse(true);
        Utilisateur u = monCompte.changerMotDePasse(principal.id(), demande.motDePasseActuel(),
                demande.nouveauMotDePasse());
        poserCookieRefresh(u, persistant, reponse);
        return session(UtilisateurPrincipal.de(u), u);
    }

    /**
     * Toujours la meme reponse, que le compte existe ou non, actif ou pas :
     * on ne revele jamais si un e-mail est enregistre.
     */
    @PostMapping("/mot-de-passe-oublie")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Transactional
    public void motDePasseOublie(@Valid @RequestBody DemandeMotDePasseOublie demande) {
        utilisateurs.findByEmailIgnoreCase(demande.email())
                .filter(Utilisateur::isActif)
                .ifPresent(reinitialisations::demander);
    }

    @PostMapping("/reinitialiser-mot-de-passe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void reinitialiserMotDePasse(@Valid @RequestBody DemandeReinitialisation demande) {
        if (demande.nouveauMotDePasse().length() < LONGUEUR_MIN_MOT_DE_PASSE) {
            throw new RegleMetierException(
                    "Le mot de passe doit compter au moins " + LONGUEUR_MIN_MOT_DE_PASSE + " caractères.");
        }
        Utilisateur u = reinitialisations.consommer(demande.jeton());
        u.setMotDePasse(encodeur.encode(demande.nouveauMotDePasse()));
        utilisateurs.save(u);
        // Un mot de passe change invalide toute session ouverte ailleurs.
        refreshTokens.revoquerTout(u.getId());
    }

    private Session session(UtilisateurPrincipal principal, Utilisateur u) {
        return new Session(
                jwtService.genererAcces(principal),
                jwtService.dureeAccesSecondes(),
                u.nomComplet(),
                u.getEmail(),
                u.getRoles().stream().map(Enum::name).toList(),
                u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name(),
                u.getNom(),
                u.getPrenom(),
                u.getNumeroLicence());
    }

    /**
     * Persistant : cookie avec Max-Age, qui survit a la fermeture du navigateur.
     * Sinon : cookie de session (sans Max-Age) et expiration courte en base.
     */
    private void poserCookieRefresh(Utilisateur u, boolean persistant, HttpServletResponse reponse) {
        byte[] brut = new byte[48];
        ALEA.nextBytes(brut);
        String jeton = Base64.getUrlEncoder().withoutPadding().encodeToString(brut);

        RefreshToken t = new RefreshToken();
        t.setUtilisateur(u);
        t.setEmpreinte(empreinte(jeton));
        t.setPersistant(persistant);
        t.setExpireLe(Instant.now().plus(persistant ? dureeRefresh : dureeSession));
        refreshTokens.save(t);

        reponse.addHeader("Set-Cookie", cookie(jeton, persistant ? dureeRefresh : null).toString());
    }

    /** duree null : cookie de session, efface par le navigateur a sa fermeture. */
    private ResponseCookie cookie(String valeur, Duration duree) {
        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(COOKIE_REFRESH, valeur)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/api/auth");
        if (duree != null) cookie.maxAge(duree);
        return cookie.build();
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
