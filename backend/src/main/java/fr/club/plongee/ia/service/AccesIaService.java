package fr.club.plongee.ia.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verrou de l'assistant IA : en plus des rôles ADMIN et IA, il faut un code
 * à usage unique (OTP), envoyé à une adresse fixée par la configuration
 * ({@code app.ia.email-code}) et à elle seule, quel que soit l'admin qui le
 * demande. Le code vaut {@code app.ia.validite-code-minutes} (une heure par
 * défaut) à partir de son envoi : il se saisit dans ce délai, et l'accès
 * qu'il ouvre se referme à la fin de ce même délai.
 *
 * <p>Tout est en mémoire, comme la base du profil dev : un redémarrage
 * referme l'accès. Le code n'est gardé que haché ; cinq erreurs
 * l'invalident. Chaque événement est inscrit dans {@code journal.log}.
 *
 * <p>Nom de bean {@code accesIa} : utilisé par le {@code @PreAuthorize}
 * d'{@code IaController}.
 */
@Service("accesIa")
@ConditionalOnProperty(name = "app.ia.active", havingValue = "true")
public class AccesIaService {

    static final int ESSAIS_MAX = 5;
    /** Sans 0/O ni 1/I/L : se recopie sans erreur depuis un téléphone. */
    private static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int LONGUEUR_CODE = 8;
    private static final SecureRandom ALEA = new SecureRandom();

    public record EtatAcces(boolean ouvert, Instant ouvertJusquA, String destinataire, boolean codeEnvoye) {}

    private record CodeEnAttente(byte[] empreinte, Instant expireLe, Instant demandeLe, int essais) {}

    private final EnvoiCodeIa envoi;
    private final JournalIaService journaliste;
    private final UtilisateurRepository utilisateurs;
    private final String destinataire;
    /** Validité du code, et donc de l'accès qu'il ouvre, à compter de l'envoi. */
    private final Duration validite;
    /** Entre deux demandes de code d'une même personne : évite d'inonder la boîte de réception. */
    private final Duration delaiEntreDemandes;

    private final Map<Long, CodeEnAttente> codes = new ConcurrentHashMap<>();
    private final Map<Long, Instant> acces = new ConcurrentHashMap<>();

    public AccesIaService(EnvoiCodeIa envoi, JournalIaService journaliste, UtilisateurRepository utilisateurs,
                          @Value("${app.ia.email-code}") String destinataire,
                          @Value("${app.ia.validite-code-minutes:60}") int validiteMinutes,
                          @Value("${app.ia.delai-entre-codes-secondes:60}") int delaiEntreCodesSecondes) {
        this.envoi = envoi;
        this.journaliste = journaliste;
        this.utilisateurs = utilisateurs;
        this.destinataire = destinataire.strip();
        this.validite = Duration.ofMinutes(validiteMinutes);
        this.delaiEntreDemandes = Duration.ofSeconds(delaiEntreCodesSecondes);
        if (this.destinataire.isEmpty()) {
            throw new IllegalStateException("app.ia.email-code doit indiquer l'adresse qui reçoit les codes d'accès.");
        }
    }

    /** Pour {@code @PreAuthorize} : l'accès de cette personne est-il ouvert ? */
    public boolean ouvert(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof UtilisateurPrincipal p
                && ouvert(p.id());
    }

    private boolean ouvert(Long utilisateurId) {
        Instant fin = acces.get(utilisateurId);
        if (fin == null) return false;
        if (fin.isAfter(Instant.now())) return true;
        acces.remove(utilisateurId, fin);
        return false;
    }

    public EtatAcces etat(Long utilisateurId) {
        CodeEnAttente c = codes.get(utilisateurId);
        return new EtatAcces(ouvert(utilisateurId), ouvert(utilisateurId) ? acces.get(utilisateurId) : null,
                masquer(destinataire), c != null && c.expireLe().isAfter(Instant.now()));
    }

    public void demanderCode(Long utilisateurId) {
        CodeEnAttente precedent = codes.get(utilisateurId);
        if (precedent != null && precedent.demandeLe().plus(delaiEntreDemandes).isAfter(Instant.now())) {
            throw new RegleMetierException("Un code vient d'être envoyé : attendez une minute avant d'en redemander un.");
        }
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < LONGUEUR_CODE; i++) code.append(ALPHABET.charAt(ALEA.nextInt(ALPHABET.length())));
        Instant maintenant = Instant.now();
        String demandeur = nom(utilisateurId);
        // Envoyé d'abord : un envoi en échec ne laisse pas de code valable derrière lui.
        envoi.envoyer(destinataire, code.toString(), demandeur, (int) validite.toMinutes());
        codes.put(utilisateurId, new CodeEnAttente(empreinte(code.toString()),
                maintenant.plus(validite), maintenant, 0));
        journaliste.noterHorsSession("Code d'accès envoyé à " + destinataire + ", demandé par " + demandeur + ".");
    }

    public EtatAcces valider(Long utilisateurId, String saisi) {
        CodeEnAttente c = codes.get(utilisateurId);
        if (c == null || c.expireLe().isBefore(Instant.now())) {
            codes.remove(utilisateurId);
            throw new RegleMetierException("Aucun code en cours de validité : demandez-en un nouveau.");
        }
        String propre = saisi == null ? "" : saisi.replaceAll("[\\s-]", "").toUpperCase();
        if (!MessageDigest.isEqual(c.empreinte(), empreinte(propre))) {
            int essais = c.essais() + 1;
            if (essais >= ESSAIS_MAX) {
                codes.remove(utilisateurId);
                journaliste.noterHorsSession("Code d'accès invalidé après " + ESSAIS_MAX + " erreurs de "
                        + nom(utilisateurId) + ".");
                throw new RegleMetierException("Code incorrect, " + ESSAIS_MAX + " fois : il est annulé. "
                        + "Demandez-en un nouveau.");
            }
            codes.put(utilisateurId, new CodeEnAttente(c.empreinte(), c.expireLe(), c.demandeLe(), essais));
            throw new RegleMetierException("Code incorrect (" + (ESSAIS_MAX - essais) + " essai(s) restant(s)).");
        }
        codes.remove(utilisateurId);
        // L'accès finit avec le code : saisi au bout de 50 minutes, il ne reste que 10 minutes.
        Instant fin = c.expireLe();
        acces.put(utilisateurId, fin);
        journaliste.noterHorsSession("Accès à l'assistant ouvert pour " + nom(utilisateurId) + " jusqu'à " + fin + ".");
        return etat(utilisateurId);
    }

    public void fermer(Long utilisateurId) {
        if (acces.remove(utilisateurId) != null) {
            journaliste.noterHorsSession("Accès à l'assistant refermé par " + nom(utilisateurId) + ".");
        }
    }

    /** « k•••i@gmail.com » : la page dit où regarder sans afficher l'adresse entière. */
    static String masquer(String adresse) {
        int arobase = adresse.indexOf('@');
        if (arobase < 2) return adresse;
        return adresse.charAt(0) + "•••" + adresse.charAt(arobase - 1) + adresse.substring(arobase);
    }

    private String nom(Long utilisateurId) {
        return utilisateurs.findById(utilisateurId).map(Utilisateur::nomComplet).orElse("utilisateur " + utilisateurId);
    }

    private static byte[] empreinte(String code) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
