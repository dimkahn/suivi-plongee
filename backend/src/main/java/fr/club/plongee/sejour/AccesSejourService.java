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
 * Le séjour par un lien et un code reçu par e-mail (V77), pour tout
 * participant qui n'est pas encadrant (moniteur, admin, directeur
 * technique) : élève, invité, conjoint... qu'il ait un compte ou non. Il y
 * renseigne ses informations (voyage, repas, personne à prévenir) et
 * y voit et saisit les frais.
 * <p>
 * L'organisateur envoie la demande d'informations à chacun
 * ({@link #envoyerInvitations}) : l'encadrant reçoit l'adresse du séjour
 * dans l'appli, où il est connecté ; les autres l'adresse
 * {@code /sejour/{code}} ({@code sejour.code_frais}, secret, tiré au
 * hasard). Sur cette page on donne son e-mail et reçoit un code à usage
 * unique de 6 chiffres (10 minutes, 5 essais, un envoi par minute au
 * plus) ; le bon code ouvre un jeton, gardé par son navigateur, valable
 * jusqu'à 60 jours après la fin du séjour. En base, ni code ni jeton en
 * clair : leur empreinte SHA-256 seulement.
 * <p>
 * Les droits sur les frais sont ceux de {@link FraisService} (chacun saisit
 * ce qu'il a payé) ; ses informations, chacun les modifie. La réponse à
 * une demande de code est la même que l'e-mail soit connu ou non : la page
 * ne dit pas qui participe.
 */
@Service
public class AccesSejourService {

    /** Ces comptes sont dans l'appli : ils n'entrent pas par le lien. */
    private static final String EST_ENCADRANT = """
            EXISTS (SELECT 1 FROM utilisateur_role r
                     WHERE r.role IN ('MONITEUR', 'ADMIN', 'DIRECTEUR_TECHNIQUE')
                       AND (r.utilisateur_id = p.utilisateur_id OR r.utilisateur_id = e.utilisateur_id))""";

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

    /**
     * Ce que le participant entré par le lien renseigne lui-même, le séjour
     * dont il s'agit, et son programme (encart « Aujourd'hui »).
     */
    public record MesInformationsVue(EnteteVue sejour, SejourService.ParticipantVue moi,
                                     SejourService.ProgrammeVue programme) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final FraisService frais;
    private final SejourService sejours;
    private final ServiceNotification notification;
    private final IdentiteStructureService identite;
    private final String urlFrontend;
    private final SecureRandom hasard = new SecureRandom();

    public AccesSejourService(NamedParameterJdbcTemplate jdbc, FraisService frais, SejourService sejours,
                              ServiceNotification notification, IdentiteStructureService identite,
                              @Value("${app.frontend-url}") String urlFrontend) {
        this.jdbc = jdbc;
        this.frais = frais;
        this.sejours = sejours;
        this.notification = notification;
        this.identite = identite;
        this.urlFrontend = urlFrontend;
    }

    // ------------------------------------------------------------------
    //  Côté organisateur
    // ------------------------------------------------------------------

    /**
     * Demande à chaque participant qui a un e-mail de renseigner ses
     * informations pour le séjour et lui donne accès aux frais
     * ({@code participantIds} null : à tous ; sinon aux seuls participants
     * choisis, pour relancer ceux qui ne l'ont pas reçu). L'encadrant reçoit
     * le lien du séjour dans l'appli ; les autres le lien et la façon
     * d'entrer par code.
     */
    @Transactional
    public BilanEnvoiAcces envoyerInvitations(Long sortieId, Collection<Long> participantIds) {
        Set<Long> choisis = participantIds == null ? null : new HashSet<>(participantIds);
        if (choisis != null && choisis.isEmpty()) {
            throw new RegleMetierException("Choisissez au moins un participant.");
        }
        String code = codeFrais(sortieId);
        EnteteVue sejour = entete(code);
        var p = new MapSqlParameterSource("sortie", sortieId).addValue("pids", choisis);
        List<Map<String, Object>> participants = jdbc.queryForList("""
                SELECT p.id, p.prenom, p.nom, p.email, CASE WHEN %s THEN 1 ELSE 0 END AS encadrant
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie""".formatted(EST_ENCADRANT)
                + (choisis == null ? "" : " AND p.id IN (:pids)") + " ORDER BY p.nom, p.prenom", p);
        if (choisis != null && participants.size() < choisis.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
        List<String> envoyes = new ArrayList<>(), sansEmail = new ArrayList<>(), echecs = new ArrayList<>();
        for (Map<String, Object> ligne : participants) {
            String nom = ligne.get("prenom") + " " + ligne.get("nom");
            String email = (String) ligne.get("email");
            if (SejourService.blanc(email)) {
                sansEmail.add(nom);
                continue;
            }
            boolean encadrant = ((Number) ligne.get("encadrant")).intValue() == 1;
            String debut = "Bonjour " + ligne.get("prenom") + ",\n\n"
                    + "Pour préparer le séjour « " + sejour.nom() + " » (" + periode(sejour) + "), merci de "
                    + "renseigner vos informations : votre arrivée et votre départ (avec le numéro de vol ou de "
                    + "train), votre téléphone, vos repas (régime alimentaire) et la personne à prévenir en cas "
                    + "d'urgence. Vous y trouverez aussi les frais partagés du séjour : notez-y ce que vous payez, "
                    + "avec la photo de la note ; et déclarez-y le matériel du club que vous empruntez.\n\n";
            String corps = encadrant
                    ? debut + "Dans l'appli, menu « Séjours », puis « Modifier mes informations » :\n"
                            + urlFrontend + "/sejours/" + sortieId + "\n\n"
                    : debut + urlFrontend + "/sejour/" + code + "\n\n"
                            + "Donnez-y cette adresse e-mail (" + email.trim() + ") : vous recevrez un code à "
                            + "6 chiffres pour entrer. Pas de compte ni de mot de passe à créer.\n\n";
            corps += "Bon séjour,\n" + identite.nom() + "\n";
            if (notification.envoyerCourriel(email.trim(), "Vos informations pour le séjour — " + sejour.nom(), corps)) {
                envoyes.add(nom);
            } else {
                echecs.add(nom);
            }
        }
        return new BilanEnvoiAcces(envoyes, sansEmail, echecs);
    }

    private static String periode(EnteteVue s) {
        return s.dateFin() == null || s.dateFin().equals(s.dateDebut())
                ? "le " + s.dateDebut().format(Calendrier.DATE_FR)
                : "du " + s.dateDebut().format(Calendrier.DATE_FR) + " au " + s.dateFin().format(Calendrier.DATE_FR);
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
        Optional<Long> participant = participantPourLien(code, email);
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
        notification.envoyerCourriel(adresse.trim(), "Votre code — séjour " + sejour.nom(),
                "Votre code pour entrer dans le séjour « " + sejour.nom() + " » : " + chiffres + "\n\n"
                        + "Il est valable " + MINUTES_VALIDITE_CODE + " minutes. Si vous n'avez rien demandé, "
                        + "ignorez ce message.\n\n" + identite.nom() + "\n");
    }

    /** Le bon code ouvre un jeton ; un mauvais compte un essai. */
    @Transactional(noRollbackFor = RegleMetierException.class)
    public Connexion connecter(String code, String email, String saisie) {
        EnteteVue sejour = entete(code);
        Long participant = participantPourLien(code, email)
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

    /** L'entrée depuis la page de connexion : le séjour ouvert et son adresse, que la page n'avait pas. */
    public record ConnexionSansLien(String sejour, String jeton, Long participantId, String prenom, String nom) {}

    /**
     * Sans le lien, depuis la page de connexion : le code part pour le séjour
     * le plus proche de cet e-mail ({@link #sejourPourEmail}) ; sinon rien,
     * sans le dire, comme {@link #demanderCode}.
     */
    @Transactional
    public void demanderCodeSansLien(String email) {
        sejourPourEmail(email).ifPresent(code -> demanderCode(code, email));
    }

    /**
     * Le bon code ouvre le même séjour que celui du code envoyé, et donne son
     * adresse. Tout refus a le même message : sans le secret de l'adresse,
     * un e-mail suffit, et la réponse ne doit pas dire s'il participe.
     */
    @Transactional(noRollbackFor = RegleMetierException.class)
    public ConnexionSansLien connecterSansLien(String email, String saisie) {
        String refus = "Code incorrect ou expiré : demandez-en un nouveau.";
        String code = sejourPourEmail(email).orElseThrow(() -> new RegleMetierException(refus));
        Connexion c;
        try {
            c = connecter(code, email, saisie);
        } catch (RegleMetierException e) {
            throw new RegleMetierException(refus);
        }
        return new ConnexionSansLien(code, c.jeton(), c.participantId(), c.prenom(), c.nom());
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

    @Transactional(readOnly = true)
    public MesInformationsVue mesInformations(String code, Acces a) {
        return new MesInformationsVue(entete(code), sejours.participant(a.participantId()),
                sejours.programme(a.sortieId(), a.participantId()));
    }

    /** Tout le séjour vu par ce participant : son carnet, sans les coordonnées ni les régimes des autres. */
    @Transactional(readOnly = true)
    public SejourService.SejourVue carnet(Acces a) {
        return sejours.carnetDuParticipant(a.sortieId(), a.participantId());
    }

    @Transactional
    public MesInformationsVue modifierMesInformations(String code, Acces a, SejourService.DemandeMesInformations d) {
        sejours.modifierMesInformations(a.participantId(), d);
        return mesInformations(code, a);
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    /** Le participant de cet e-mail, s'il peut entrer par le lien : tout participant qui n'est pas encadrant. */
    private Optional<Long> participantPourLien(String code, String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        List<Long> ids = jdbc.queryForList("""
                SELECT p.id FROM sejour_participant p
                  JOIN sejour s ON s.sortie_id = p.sortie_id
                  LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE s.code_frais = :code AND LOWER(p.email) = :email AND NOT %s
                 ORDER BY p.id""".formatted(EST_ENCADRANT),
                new MapSqlParameterSource("code", code).addValue("email", email.trim().toLowerCase(Locale.ROOT)),
                Long.class);
        return ids.isEmpty() ? Optional.empty() : Optional.of(ids.getFirst());
    }

    /**
     * L'adresse du séjour où cet e-mail entre sans le lien : parmi ceux où il
     * pourrait entrer par le lien (demande d'informations envoyée, jeton encore
     * possible), le séjour en cours ou le prochain, sinon le dernier fini.
     */
    private Optional<String> sejourPourEmail(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        LocalDate aujourdhui = maintenant().toLocalDate();
        record Candidat(String code, LocalDate debut, LocalDate fin, long sortieId) {}
        List<Candidat> candidats = jdbc.query("""
                SELECT s.code_frais, so.date_debut, COALESCE(so.date_fin, so.date_debut), so.id FROM sejour_participant p
                  JOIN sejour s ON s.sortie_id = p.sortie_id
                  JOIN sortie so ON so.id = s.sortie_id
                  LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE s.code_frais IS NOT NULL AND LOWER(p.email) = :email AND NOT %s
                   AND COALESCE(so.date_fin, so.date_debut) >= :limite""".formatted(EST_ENCADRANT),
                new MapSqlParameterSource("email", email.trim().toLowerCase(Locale.ROOT))
                        .addValue("limite", aujourdhui.minusDays(JOURS_APRES_LE_SEJOUR)),
                (rs, i) -> new Candidat(rs.getString(1), rs.getObject(2, LocalDate.class), rs.getObject(3, LocalDate.class),
                        rs.getLong(4)));
        Comparator<Candidat> aVenirDabord = Comparator.comparing((Candidat c) -> c.fin().isBefore(aujourdhui));
        // Départage stable : la demande de code et la connexion doivent choisir le même séjour.
        return candidats.stream()
                .min(aVenirDabord.thenComparing(c -> c.fin().isBefore(aujourdhui)
                        ? -c.fin().toEpochDay() : c.debut().toEpochDay()).thenComparing(Candidat::sortieId))
                .map(Candidat::code);
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
