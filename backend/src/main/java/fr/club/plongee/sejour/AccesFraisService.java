package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.notification.service.ServiceNotification;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Accès aux frais d'un séjour sans compte (V77) : pour un participant qui
 * n'a ni compte ni dossier élève relié à un compte, mais dont on connaît
 * l'e-mail (un invité, un conjoint...).
 * <p>
 * L'organisateur lui envoie l'adresse des frais du séjour,
 * {@code /frais/{code}} ({@code sejour.code_frais}, secret, tiré au
 * hasard). Sur cette page il donne son e-mail et reçoit un code à usage
 * unique de 6 chiffres (10 minutes, 5 essais, un envoi par minute au
 * plus) ; le bon code ouvre un jeton, gardé par son navigateur, valable
 * jusqu'à 60 jours après la fin du séjour. En base, ni code ni jeton en
 * clair : leur empreinte SHA-256 seulement.
 * <p>
 * Ce qu'il peut faire ensuite est réglé par {@link FraisService} : lire les
 * frais, et saisir les dépenses qu'il a payées, sauf s'il est élève.
 * La réponse à une demande de code est la même que l'e-mail soit connu ou
 * non : la page ne dit pas qui participe.
 */
@Service
public class AccesFraisService {

    static final int MINUTES_VALIDITE_CODE = 10;
    static final int ESSAIS_MAX = 5;
    static final int SECONDES_ENTRE_DEUX_ENVOIS = 60;
    static final int JOURS_APRES_LE_SEJOUR = 60;

    /** L'en-tête de la page publique : de quel séjour il s'agit. */
    public record EnteteVue(String nom, String lieu, LocalDate dateDebut, LocalDate dateFin) {}

    public record Connexion(String jeton, Long participantId, String prenom, String nom) {}

    public record ParticipantCourtVue(Long id, String prenom, String nom) {}

    /** Les frais vus par un participant entré par le lien. */
    public record FraisPublicVue(EnteteVue sejour, ParticipantCourtVue moi, List<ParticipantCourtVue> participants,
                                 FraisService.FraisVue frais) {}

    public record BilanEnvoiAcces(List<String> envoyes, List<String> sansEmail, List<String> echecs) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final FraisService frais;
    private final ServiceNotification notification;
    private final IdentiteStructureService identite;
    private final String urlFrontend;
    private final SecureRandom hasard = new SecureRandom();

    public AccesFraisService(NamedParameterJdbcTemplate jdbc, FraisService frais, ServiceNotification notification,
                             IdentiteStructureService identite, @Value("${app.frontend-url}") String urlFrontend) {
        this.jdbc = jdbc;
        this.frais = frais;
        this.notification = notification;
        this.identite = identite;
        this.urlFrontend = urlFrontend;
    }

    // ------------------------------------------------------------------
    //  Côté organisateur
    // ------------------------------------------------------------------

    /**
     * Envoie l'adresse des frais aux participants sans compte qui ont un
     * e-mail ({@code participantId} null : à tous ceux-là).
     */
    @Transactional
    public BilanEnvoiAcces envoyerAcces(Long sortieId, Long participantId) {
        String code = codeFrais(sortieId);
        EnteteVue sejour = entete(code);
        var p = new MapSqlParameterSource("sortie", sortieId).addValue("pid", participantId);
        List<Map<String, Object>> sansCompte = jdbc.queryForList("""
                SELECT p.id, p.prenom, p.nom, p.email FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie AND p.utilisateur_id IS NULL AND e.utilisateur_id IS NULL"""
                + (participantId == null ? "" : " AND p.id = :pid") + " ORDER BY p.nom, p.prenom", p);
        if (participantId != null && sansCompte.isEmpty()) {
            throw new RegleMetierException("Ce participant a un compte : il voit les frais dans l'appli, menu « Séjours ».");
        }
        List<String> envoyes = new ArrayList<>(), sansEmail = new ArrayList<>(), echecs = new ArrayList<>();
        String lien = urlFrontend + "/frais/" + code;
        for (Map<String, Object> ligne : sansCompte) {
            String nom = ligne.get("prenom") + " " + ligne.get("nom");
            String email = (String) ligne.get("email");
            if (SejourService.blanc(email)) {
                sansEmail.add(nom);
                continue;
            }
            String corps = "Bonjour " + ligne.get("prenom") + ",\n\n"
                    + "Voici l'adresse des frais partagés du séjour « " + sejour.nom() + " » : vous y verrez les "
                    + "dépenses de chacun et qui doit combien à qui, et vous pourrez y noter ce que vous avez payé, "
                    + "avec la photo de la note.\n\n" + lien + "\n\n"
                    + "Donnez-y cette adresse e-mail (" + email.trim() + ") : vous recevrez un code à 6 chiffres "
                    + "pour entrer. Pas de compte ni de mot de passe à créer.\n\n"
                    + "Bon séjour,\n" + identite.nom() + "\n";
            if (notification.envoyerCourriel(email.trim(), "Frais du séjour — " + sejour.nom(), corps)) {
                envoyes.add(nom);
            } else {
                echecs.add(nom);
            }
        }
        return new BilanEnvoiAcces(envoyes, sansEmail, echecs);
    }

    /** Le code secret de l'adresse des frais, tiré au premier besoin. */
    @Transactional
    public String codeFrais(Long sortieId) {
        var s = new MapSqlParameterSource("sortie", sortieId);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM sortie WHERE id = :sortie", s, Integer.class) == 0) {
            throw new RessourceIntrouvableException("Sortie introuvable");
        }
        List<String> codes = jdbc.queryForList("SELECT code_frais FROM sejour WHERE sortie_id = :sortie", s, String.class);
        if (!codes.isEmpty() && codes.getFirst() != null) return codes.getFirst();
        String code = aleatoire(24);
        if (codes.isEmpty()) {
            jdbc.update("INSERT INTO sejour (sortie_id, code_frais) VALUES (:sortie, :code)", s.addValue("code", code));
        } else {
            jdbc.update("UPDATE sejour SET code_frais = :code WHERE sortie_id = :sortie", s.addValue("code", code));
        }
        return code;
    }

    // ------------------------------------------------------------------
    //  Côté participant, sans compte
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public EnteteVue entete(String code) {
        List<EnteteVue> lignes = jdbc.query("""
                SELECT so.nom, so.lieu, so.date_debut, so.date_fin FROM sejour s JOIN sortie so ON so.id = s.sortie_id
                 WHERE s.code_frais = :code""", new MapSqlParameterSource("code", code),
                (rs, i) -> new EnteteVue(rs.getString(1), rs.getString(2), rs.getObject(3, LocalDate.class),
                        rs.getObject(4, LocalDate.class)));
        if (lignes.isEmpty()) throw new RessourceIntrouvableException("Adresse inconnue : demandez-la à l'organisateur.");
        return lignes.getFirst();
    }

    /** Envoie un code à 6 chiffres si l'e-mail est celui d'un participant sans compte ; sinon, rien, sans le dire. */
    @Transactional
    public void demanderCode(String code, String email) {
        EnteteVue sejour = entete(code);
        Optional<Long> participant = participantSansCompte(code, email);
        if (participant.isEmpty()) return;
        var p = new MapSqlParameterSource("p", participant.get())
                .addValue("depuis", maintenant().minusSeconds(SECONDES_ENTRE_DEUX_ENVOIS));
        if (jdbc.queryForObject("SELECT COUNT(*) FROM sejour_code_acces WHERE participant_id = :p AND cree_le > :depuis",
                p, Integer.class) > 0) {
            return;
        }
        String chiffres = String.format("%06d", hasard.nextInt(1_000_000));
        jdbc.update("DELETE FROM sejour_code_acces WHERE participant_id = :p", p);
        jdbc.update("""
                INSERT INTO sejour_code_acces (participant_id, empreinte, expire_le, cree_le)
                VALUES (:p, :empreinte, :expire, :maintenant)""",
                p.addValue("empreinte", empreinte(chiffres))
                        .addValue("expire", maintenant().plusMinutes(MINUTES_VALIDITE_CODE))
                        .addValue("maintenant", maintenant()));
        // À l'adresse enregistrée pour le participant, pas à celle tapée sur la page.
        String adresse = jdbc.queryForObject("SELECT email FROM sejour_participant WHERE id = :p", p, String.class);
        notification.envoyerCourriel(adresse.trim(), "Votre code — frais du séjour " + sejour.nom(),
                "Votre code pour les frais du séjour « " + sejour.nom() + " » : " + chiffres + "\n\n"
                        + "Il est valable " + MINUTES_VALIDITE_CODE + " minutes. Si vous n'avez rien demandé, "
                        + "ignorez ce message.\n\n" + identite.nom() + "\n");
    }

    /** Le bon code ouvre un jeton ; un mauvais compte un essai. */
    @Transactional(noRollbackFor = RegleMetierException.class)
    public Connexion connecter(String code, String email, String saisie) {
        EnteteVue sejour = entete(code);
        Long participant = participantSansCompte(code, email)
                .orElseThrow(() -> new RegleMetierException("Code incorrect ou expiré : demandez-en un nouveau."));
        var p = new MapSqlParameterSource("p", participant);
        record CodeEnBase(long id, String empreinte, LocalDateTime expire, int essais) {}
        List<CodeEnBase> codes = jdbc.query("""
                SELECT id, empreinte, expire_le, essais FROM sejour_code_acces WHERE participant_id = :p
                 ORDER BY id DESC""", p,
                (rs, i) -> new CodeEnBase(rs.getLong(1), rs.getString(2), rs.getObject(3, LocalDateTime.class),
                        rs.getInt(4)));
        if (codes.isEmpty()) throw new RegleMetierException("Code incorrect ou expiré : demandez-en un nouveau.");
        CodeEnBase c = codes.getFirst();
        if (c.expire().isBefore(maintenant()) || c.essais() >= ESSAIS_MAX) {
            throw new RegleMetierException("Code expiré ou trop d'essais : demandez-en un nouveau.");
        }
        String propre = saisie == null ? "" : saisie.replaceAll("\\s", "");
        if (!MessageDigest.isEqual(empreinte(propre).getBytes(StandardCharsets.US_ASCII),
                c.empreinte().getBytes(StandardCharsets.US_ASCII))) {
            jdbc.update("UPDATE sejour_code_acces SET essais = essais + 1 WHERE id = :id",
                    new MapSqlParameterSource("id", c.id()));
            throw new RegleMetierException("Code incorrect" + (c.essais() + 1 >= ESSAIS_MAX
                    ? " : demandez-en un nouveau." : " : vérifiez les 6 chiffres reçus par e-mail."));
        }
        jdbc.update("DELETE FROM sejour_code_acces WHERE participant_id = :p", p);
        String jeton = aleatoire(32);
        LocalDateTime fin = sejour.dateFin().plusDays(JOURS_APRES_LE_SEJOUR).atTime(23, 59);
        if (fin.isBefore(maintenant().plusDays(1))) fin = maintenant().plusDays(1);
        jdbc.update("""
                INSERT INTO sejour_jeton_acces (participant_id, empreinte, expire_le, cree_le)
                VALUES (:p, :empreinte, :expire, :maintenant)""",
                p.addValue("empreinte", empreinte(jeton)).addValue("expire", fin).addValue("maintenant", maintenant()));
        Map<String, Object> nom = jdbc.queryForMap("SELECT prenom, nom FROM sejour_participant WHERE id = :p", p);
        return new Connexion(jeton, participant, (String) nom.get("prenom"), (String) nom.get("nom"));
    }

    @Transactional
    public void deconnecter(String jeton) {
        if (jeton == null) return;
        jdbc.update("DELETE FROM sejour_jeton_acces WHERE empreinte = :e",
                new MapSqlParameterSource("e", empreinte(jeton)));
    }

    /** Le séjour et le participant d'un jeton valable pour cette adresse ; refus sinon. */
    @Transactional(readOnly = true)
    public Acces acces(String code, String jeton) {
        if (jeton == null || jeton.isBlank()) throw new AccessDeniedException("Connexion nécessaire");
        List<Acces> lignes = jdbc.query("""
                SELECT p.sortie_id, p.id FROM sejour_jeton_acces j
                  JOIN sejour_participant p ON p.id = j.participant_id
                  JOIN sejour s ON s.sortie_id = p.sortie_id
                 WHERE j.empreinte = :e AND s.code_frais = :code AND j.expire_le > :maintenant""",
                new MapSqlParameterSource("e", empreinte(jeton)).addValue("code", code)
                        .addValue("maintenant", maintenant()),
                (rs, i) -> new Acces(rs.getLong(1), rs.getLong(2)));
        if (lignes.isEmpty()) throw new AccessDeniedException("Connexion expirée");
        return lignes.getFirst();
    }

    public record Acces(Long sortieId, Long participantId) {}

    @Transactional(readOnly = true)
    public FraisPublicVue vue(String code, Acces a) {
        List<ParticipantCourtVue> participants = jdbc.query("""
                SELECT id, prenom, nom FROM sejour_participant WHERE sortie_id = :s ORDER BY LOWER(nom), LOWER(prenom)""",
                new MapSqlParameterSource("s", a.sortieId()),
                (rs, i) -> new ParticipantCourtVue(rs.getLong(1), rs.getString(2), rs.getString(3)));
        ParticipantCourtVue moi = participants.stream().filter(p -> p.id().equals(a.participantId())).findFirst()
                .orElseThrow(() -> new AccessDeniedException("Connexion expirée"));
        return new FraisPublicVue(entete(code), moi, participants,
                frais.lire(a.sortieId(), frais.acteurParticipant(a.participantId())));
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    private Optional<Long> participantSansCompte(String code, String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        List<Long> ids = jdbc.queryForList("""
                SELECT p.id FROM sejour_participant p
                  JOIN sejour s ON s.sortie_id = p.sortie_id
                  LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE s.code_frais = :code AND LOWER(p.email) = :email
                   AND p.utilisateur_id IS NULL AND e.utilisateur_id IS NULL
                 ORDER BY p.id""",
                new MapSqlParameterSource("code", code).addValue("email", email.trim().toLowerCase(Locale.ROOT)),
                Long.class);
        return ids.isEmpty() ? Optional.empty() : Optional.of(ids.getFirst());
    }

    private String aleatoire(int octets) {
        byte[] b = new byte[octets];
        hasard.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static String empreinte(String texte) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(texte.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static LocalDateTime maintenant() {
        return LocalDateTime.now(Calendrier.ZONE_CLUB);
    }
}
