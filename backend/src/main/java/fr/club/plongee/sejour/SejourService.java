package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.formation.service.SortieService.SortieVue;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Le séjour d'une sortie (V75) : participants et leurs trajets, voitures,
 * logements et chambres, affaires à prévoir, programme et infos pratiques.
 * Tables lues et écrites en SQL (pas d'entité, comme l'identité de la
 * structure) : tout dépend de la sortie et disparaît avec elle.
 * <p>
 * Modifié par son créateur et les organisateurs qu'il a désignés
 * ({@link DroitsSejour}, V80) ; lu en entier par les encadrants. Un participant qui a un compte (son dossier
 * élève ou son compte d'encadrant) lit le « carnet » : les mêmes données
 * sans les coordonnées, régimes et personnes à prévenir des autres.
 * <p>
 * Aucune donnée de santé (règle du club) : le régime alimentaire est une
 * liste de cases ({@link RegimeAlimentaire}) et une précision pour la
 * cuisine.
 * <p>
 * Les avertissements (voiture ou chambre trop pleine, participant sans
 * chambre...) sont calculés ici et ne bloquent jamais : l'organisateur
 * peut avoir ses raisons. Seule exception : une personne n'est que dans
 * une seule voiture, conducteur ou passager (refus à l'enregistrement) ;
 * l'avertissement « plusieurs voitures » ne sert plus qu'aux séjours
 * saisis avant cette règle.
 * <p>
 * Un participant qui plonge peut être lié à un plongeur d'un groupe de
 * plongeurs de la saison (V79) : deux fiches, mais nom, prénom et e-mail
 * suivent de l'une à l'autre. Un accompagnant n'a pas de lien.
 */
@Service
public class SejourService {

    /** Un rendez-vous du programme peut tomber un peu avant ou après la sortie (voyage). */
    static final int JOURS_AUTOUR_DU_PROGRAMME = 7;
    static final int AFFAIRES_MAX = 200;
    /** Une adresse plausible : quelque chose, une arobase, un domaine avec un point. */
    private static final java.util.regex.Pattern EMAIL = java.util.regex.Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    /**
     * Un voyage. Pour l'arrivée : {@code heure} et {@code lieu} sont ceux où
     * l'on arrive sur place, {@code heureDepart} et {@code lieuDepart} ceux
     * d'où part l'avion ou le train (pour conseiller l'heure à laquelle être à
     * l'aéroport). Pour le départ : {@code heure} et {@code lieu} sont déjà
     * ceux du départ, {@code heureArrivee} l'heure à laquelle l'avion ou le
     * train arrive au retour (V85), {@code lieuArrivee} l'aéroport ou la
     * gare où il arrive (V89) ; {@code heureDepart} et
     * {@code lieuDepart} restent vides. À l'aller, {@code heureArrivee} et
     * {@code lieuArrivee} restent vides ({@code heure} et {@code lieu} sont
     * déjà ceux de l'arrivée).
     * <p>
     * {@code dateDepart} (aller) et {@code dateArrivee} (retour) sont leurs
     * jours (V87), pour un vol long qui part ou arrive un autre jour. Vides :
     * le jour de {@code date}, la veille pour un vol aller de nuit.
     * <p>
     * La réservation (V96) : {@code terminal} de départ, {@code ouvertureEnregistrement}
     * (quand ouvre l'enregistrement en ligne), {@code dossier} (numéro de
     * réservation) et {@code lienEnregistrement}. Dossier et lien permettent
     * de modifier ou d'annuler le billet : seuls le voyageur et les
     * organisateurs les lisent ({@link #sansReservation()}).
     * <p>
     * {@code carteEmbarquement} : le type (PDF, photo) de la carte
     * d'embarquement jointe au voyage (V98, {@link CartesEmbarquementService}),
     * null sans carte ; lue comme le dossier, ignorée à l'écriture.
     */
    public record Trajet(LocalDate date, LocalTime heure, MoyenTransport transport,
                         @Size(max = 30) String numero, @Size(max = 120) String lieu,
                         LocalTime heureDepart, @Size(max = 120) String lieuDepart, LocalTime heureArrivee,
                         LocalDate dateDepart, LocalDate dateArrivee, @Size(max = 120) String lieuArrivee,
                         @Size(max = 30) String terminal, @Size(max = 30) String dossier,
                         @Size(max = 500) String lienEnregistrement, LocalDateTime ouvertureEnregistrement,
                         String carteEmbarquement) {
        boolean vide() {
            return date == null && heure == null && transport == null && blanc(numero) && blanc(lieu)
                    && heureDepart == null && blanc(lieuDepart) && heureArrivee == null
                    && dateDepart == null && dateArrivee == null && blanc(lieuArrivee)
                    && blanc(terminal) && blanc(dossier) && blanc(lienEnregistrement) && ouvertureEnregistrement == null;
        }

        /** Le même voyage, sans ce qui permet d'agir sur le billet : pour qui n'est ni le voyageur ni organisateur. */
        Trajet sansReservation() {
            return new Trajet(date, heure, transport, numero, lieu, heureDepart, lieuDepart, heureArrivee,
                    dateDepart, dateArrivee, lieuArrivee, terminal, null, null, ouvertureEnregistrement, null);
        }

        /**
         * Refus si l'avion ou le train arrive un jour avant celui où il part,
         * ou si le lien d'enregistrement n'est pas une adresse web (il devient
         * un lien cliquable).
         */
        static void verifier(Trajet t) {
            if (t == null) return;
            String lien = t.lienEnregistrement() == null ? "" : t.lienEnregistrement().trim().toLowerCase(Locale.ROOT);
            if (!lien.isEmpty() && !lien.startsWith("https://") && !lien.startsWith("http://")) {
                throw new RegleMetierException("Le lien d'enregistrement doit être une adresse web commençant par https://");
            }
            if (t.date() == null) return;
            if ((t.dateDepart() != null && t.dateDepart().isAfter(t.date()))
                    || (t.dateArrivee() != null && t.dateArrivee().isBefore(t.date()))) {
                throw new RegleMetierException("L'avion ou le train arrive avant de partir : vérifiez les jours.");
            }
        }
    }

    /**
     * {@code moi} : ce participant est le compte connecté. Dans le carnet
     * d'un participant, coordonnées, régimes, personne à prévenir et
     * remarques des autres sont vides. {@code membreGroupeId} : le plongeur
     * d'un groupe de plongeurs qu'il est aussi (V79), {@code groupe} le nom
     * de ce groupe ; null pour un accompagnant ou un plongeur hors groupe.
     * {@code attestationAssurance} : le type (PDF, photo) de son attestation
     * d'assurance (V99, {@link AttestationsAssuranceService}), null sans
     * attestation ; renvoyée comme la carte d'embarquement, au seul
     * participant et aux organisateurs.
     */
    public record ParticipantVue(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                                 boolean plongeur, String telephone, String email,
                                 Set<RegimeAlimentaire> regimes, String regimePrecision,
                                 String urgenceNom, String urgenceTelephone,
                                 Trajet arrivee, Trajet depart, String remarques, boolean moi,
                                 Long membreGroupeId, String groupe, String attestationAssurance) {}

    public record DemandeParticipant(Long eleveId, Long utilisateurId,
                                     @NotBlank @Size(max = 120) String nom, @NotBlank @Size(max = 120) String prenom,
                                     boolean plongeur, @Size(max = 30) String telephone,
                                     @Size(max = 180) String email, Set<RegimeAlimentaire> regimes,
                                     @Size(max = 300) String regimePrecision,
                                     @Size(max = 120) String urgenceNom, @Size(max = 30) String urgenceTelephone,
                                     @Valid Trajet arrivee, @Valid Trajet depart, String remarques,
                                     Long membreGroupeId) {}

    /**
     * Ce qu'un participant renseigne lui-même, par le lien reçu par e-mail
     * ou par « Mon séjour » dans l'appli : ses coordonnées, son voyage, ses
     * repas, la personne à prévenir. Ni nom, ni rôle de plongeur, ni dossier :
     * cela reste à l'organisateur.
     */
    public record DemandeMesInformations(@Size(max = 30) String telephone, Set<RegimeAlimentaire> regimes,
                                         @Size(max = 300) String regimePrecision,
                                         @Size(max = 120) String urgenceNom, @Size(max = 30) String urgenceTelephone,
                                         @Valid Trajet arrivee, @Valid Trajet depart, String remarques) {}

    public record VoitureVue(Long id, String nom, int places, Long conducteurId, String trajet, String remarques,
                             List<Long> passagerIds) {}

    public record DemandeVoiture(@NotBlank @Size(max = 120) String nom, @NotNull Integer places, Long conducteurId,
                                 @Size(max = 200) String trajet, String remarques, List<Long> passagerIds) {}

    public record ChambreVue(Long id, String nom, int couchages, String remarques, List<Long> occupantIds) {}

    public record LogementVue(Long id, String nom, String adresse, String remarques, List<ChambreVue> chambres) {}

    public record DemandeChambre(@NotBlank @Size(max = 120) String nom, @NotNull Integer couchages,
                                 @Size(max = 300) String remarques, List<Long> occupantIds) {}

    public record DemandeLogement(@NotBlank @Size(max = 120) String nom, @Size(max = 300) String adresse,
                                  String remarques, List<@Valid DemandeChambre> chambres) {}

    public record AffaireVue(Long id, CategorieAffaire categorie, String libelle, boolean indispensable) {}

    public record DemandeAffaire(@NotNull CategorieAffaire categorie, @NotBlank @Size(max = 200) String libelle,
                                 boolean indispensable) {}

    public record EvenementVue(Long id, LocalDate jour, LocalTime heureDebut, LocalTime heureFin, String titre,
                               String lieu, String details) {}

    public record DemandeEvenement(@NotNull LocalDate jour, LocalTime heureDebut, LocalTime heureFin,
                                   @NotBlank @Size(max = 160) String titre, @Size(max = 160) String lieu,
                                   String details) {}

    /** Un plongeur d'un groupe, auquel lier un participant. */
    public record PlongeurGroupeVue(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                                    String email, String aptitude) {}

    /**
     * Un groupe de plongeurs de la saison de la sortie, pour en inscrire tous
     * les membres d'un coup, ou lier un participant à l'un d'eux.
     */
    public record GroupeProposeVue(Long id, String nom, int membres, List<PlongeurGroupeVue> plongeurs) {}

    /** Un compte qui modifie le séjour : son créateur ou un organisateur qu'il a désigné. */
    public record OrganisateurVue(Long id, String nomComplet, boolean createur) {}

    /**
     * {@code gere} : le compte peut modifier le séjour (créateur ou
     * organisateur) ; {@code encadrant} : il voit tout (sinon, c'est le
     * carnet d'un participant) ; {@code peutDesigner} : il choisit les
     * organisateurs (le créateur, ou un ADMIN). {@code palanquees} : celles
     * des plongées de la sortie, toutes pour un encadrant, la sienne seulement
     * pour un participant. {@code conseilAssurance} : le texte de
     * l'organisateur montré à qui n'a pas joint son attestation d'assurance
     * (V99), null sans conseil.
     */
    public record SejourVue(SortieVue sortie, boolean gere, boolean encadrant, String infosPratiques,
                            List<ParticipantVue> participants, List<VoitureVue> voitures,
                            List<LogementVue> logements, List<AffaireVue> affaires,
                            List<EvenementVue> evenements, List<JourneesSejourService.JourneeVue> journees,
                            FraisService.FraisVue frais, List<String> avertissements,
                            List<GroupeProposeVue> groupesProposes, List<OrganisateurVue> organisateurs,
                            boolean peutDesigner, List<PalanqueesSejourService.PalanqueeVue> palanquees,
                            String conseilAssurance) {}

    /** Une ligne de la liste des séjours. */
    public record SejourResumeVue(Long sortieId, String nom, String lieu, LocalDate dateDebut, LocalDate dateFin,
                                  int participants, boolean jeParticipe) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;
    private final FraisService frais;
    private final DroitsSejour droits;
    private final PalanqueesSejourService palanquees;
    private final JourneesSejourService journees;

    public SejourService(NamedParameterJdbcTemplate jdbc, SortieService sorties, FraisService frais,
                         DroitsSejour droits, PalanqueesSejourService palanquees, JourneesSejourService journees) {
        this.jdbc = jdbc;
        this.sorties = sorties;
        this.frais = frais;
        this.droits = droits;
        this.palanquees = palanquees;
        this.journees = journees;
    }

    // ------------------------------------------------------------------
    //  Droits
    // ------------------------------------------------------------------

    static boolean encadrant(UtilisateurPrincipal p) {
        return aRole(p, "MONITEUR") || aRole(p, "ADMIN") || aRole(p, "DIRECTEUR_TECHNIQUE");
    }

    private static boolean aRole(UtilisateurPrincipal p, String role) {
        return p.getAuthorities().stream().anyMatch(a -> ("ROLE_" + role).equals(a.getAuthority()));
    }

    // ------------------------------------------------------------------
    //  Lecture
    // ------------------------------------------------------------------

    /**
     * Encadrants : les séjours à venir ou finis depuis peu (ou tous) ; les
     * autres comptes : ceux où ils sont inscrits, quelle que soit la date.
     */
    @Transactional(readOnly = true)
    public List<SejourResumeVue> lister(boolean toutes, UtilisateurPrincipal principal) {
        boolean encadrant = encadrant(principal);
        var params = new MapSqlParameterSource("moi", principal.id())
                .addValue("depuis", Calendrier.aujourdhui().minusDays(SortieService.JOURS_SORTIES_RECENTES))
                .addValue("toutes", toutes || !encadrant);
        String sql = """
                SELECT s.id, s.nom, s.lieu, s.date_debut, s.date_fin,
                       (SELECT COUNT(*) FROM sejour_participant p WHERE p.sortie_id = s.id) AS nombre,
                       (SELECT COUNT(*) FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                         WHERE p.sortie_id = s.id
                           AND (p.utilisateur_id = :moi OR e.utilisateur_id = :moi)) AS moi
                  FROM sortie s
                 WHERE (:toutes = TRUE OR s.date_fin >= :depuis)
                 ORDER BY s.date_debut DESC, s.id DESC""";
        List<SejourResumeVue> liste = jdbc.query(sql, params, (rs, i) -> new SejourResumeVue(
                rs.getLong("id"), rs.getString("nom"), rs.getString("lieu"),
                rs.getObject("date_debut", LocalDate.class), rs.getObject("date_fin", LocalDate.class),
                rs.getInt("nombre"), rs.getInt("moi") > 0));
        if (!encadrant) return liste.stream().filter(SejourResumeVue::jeParticipe).toList();
        if (toutes) return liste;
        // À venir : du plus proche au plus lointain.
        List<SejourResumeVue> aVenir = new ArrayList<>(liste);
        Collections.reverse(aVenir);
        return aVenir;
    }

    @Transactional(readOnly = true)
    public SejourVue lire(Long sortieId, UtilisateurPrincipal principal) {
        return lire(sortieId, principal, false);
    }

    /**
     * {@code commeParticipant} : un encadrant (organisateur ou non) voit le
     * séjour comme un participant, filtré comme le carnet, et les frais sans
     * les droits d'organisateur (demande du club, 2026). Ce n'est qu'une
     * vue : ses droits d'écriture ne changent pas.
     */
    @Transactional(readOnly = true)
    public SejourVue lire(Long sortieId, UtilisateurPrincipal principal, boolean commeParticipant) {
        boolean encadrant = encadrant(principal);
        if (encadrant && commeParticipant) {
            FraisService.ActeurFrais a = frais.acteur(sortieId, principal);
            SejourVue complet = vueComplete(sortieId, principal.id(), false, false);
            return carnet(avecFrais(complet, frais.lire(sortieId,
                    new FraisService.ActeurFrais(a.utilisateurId(), a.participantId(), false, a.moniteur()))));
        }
        boolean gere = encadrant && droits.organise(sortieId, principal.id());
        SejourVue complet = vueComplete(sortieId, principal.id(), gere, encadrant);
        complet = avecFrais(complet, frais.lire(sortieId, frais.acteur(sortieId, principal)));
        if (encadrant) {
            return avecDesignation(gere ? complet : sansReservationsDesAutres(complet),
                    droits.peutDesigner(sortieId, principal));
        }
        if (complet.participants().stream().noneMatch(ParticipantVue::moi)) {
            throw new AccessDeniedException("Ce séjour n'est ouvert qu'à ses participants et aux encadrants.");
        }
        return carnet(complet);
    }

    /** Tout le séjour, sans filtre : pour les encadrants et pour l'envoi du carnet par e-mail. */
    @Transactional(readOnly = true)
    public SejourVue vueComplete(Long sortieId, Long moi, boolean gere, boolean encadrant) {
        SortieVue sortie = sorties.lire(sortieId);
        var id = new MapSqlParameterSource("id", sortieId).addValue("moi", moi);

        List<String> infos = jdbc.queryForList(
                "SELECT infos_pratiques FROM sejour WHERE sortie_id = :id", id, String.class);
        List<String> conseil = jdbc.queryForList(
                "SELECT conseil_assurance FROM sejour WHERE sortie_id = :id", id, String.class);
        List<ParticipantVue> participants = jdbc.query(SELECT_PARTICIPANT + " WHERE p.sortie_id = :id", id,
                (rs, i) -> participant(rs, moi));
        participants = participants.stream()
                .sorted(Comparator.comparing((ParticipantVue p) -> p.nom().toLowerCase(Locale.ROOT))
                        .thenComparing(p -> p.prenom().toLowerCase(Locale.ROOT)))
                .toList();

        Map<Long, List<Long>> passagers = new HashMap<>();
        jdbc.query("""
                SELECT vp.voiture_id, vp.participant_id
                  FROM sejour_voiture_passager vp
                  JOIN sejour_voiture v ON v.id = vp.voiture_id
                  JOIN sejour_participant p ON p.id = vp.participant_id
                 WHERE v.sortie_id = :id
                 ORDER BY p.nom, p.prenom""", id,
                rs -> { passagers.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        List<VoitureVue> voitures = jdbc.query(
                "SELECT * FROM sejour_voiture WHERE sortie_id = :id ORDER BY id", id,
                (rs, i) -> new VoitureVue(rs.getLong("id"), rs.getString("nom"), rs.getInt("places"),
                        (Long) rs.getObject("conducteur_id", Long.class), rs.getString("trajet"),
                        rs.getString("remarques"), passagers.getOrDefault(rs.getLong("id"), List.of())));

        Map<Long, List<Long>> occupants = new HashMap<>();
        jdbc.query("""
                SELECT o.chambre_id, o.participant_id
                  FROM sejour_chambre_occupant o
                  JOIN sejour_chambre c ON c.id = o.chambre_id
                  JOIN sejour_logement l ON l.id = c.logement_id
                  JOIN sejour_participant p ON p.id = o.participant_id
                 WHERE l.sortie_id = :id
                 ORDER BY p.nom, p.prenom""", id,
                rs -> { occupants.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        Map<Long, List<ChambreVue>> chambres = new HashMap<>();
        jdbc.query("""
                SELECT c.* FROM sejour_chambre c JOIN sejour_logement l ON l.id = c.logement_id
                 WHERE l.sortie_id = :id ORDER BY c.ordre, c.id""", id,
                rs -> {
                    chambres.computeIfAbsent(rs.getLong("logement_id"), k -> new ArrayList<>())
                            .add(new ChambreVue(rs.getLong("id"), rs.getString("nom"), rs.getInt("couchages"),
                                    rs.getString("remarques"), occupants.getOrDefault(rs.getLong("id"), List.of())));
                });
        List<LogementVue> logements = jdbc.query(
                "SELECT * FROM sejour_logement WHERE sortie_id = :id ORDER BY id", id,
                (rs, i) -> new LogementVue(rs.getLong("id"), rs.getString("nom"), rs.getString("adresse"),
                        rs.getString("remarques"), chambres.getOrDefault(rs.getLong("id"), List.of())));

        List<AffaireVue> affaires = affaires(sortieId);
        List<EvenementVue> evenements = evenements(sortieId);

        List<GroupeProposeVue> groupes = !gere ? List.of() : groupesProposes(sortie.dateDebut());
        Long monId = participants.stream().filter(ParticipantVue::moi).map(ParticipantVue::id).findFirst().orElse(null);

        return new SejourVue(sortie, gere, encadrant, infos.isEmpty() ? null : infos.getFirst(), participants,
                voitures, logements, affaires, evenements, journees.journees(sortieId), frais.lire(sortieId, FraisService.ActeurFrais.LECTURE),
                avertissements(participants, voitures, logements), groupes, organisateurs(sortieId), false,
                palanquees.palanquees(sortieId, monId, encadrant), conseil.isEmpty() ? null : conseil.getFirst());
    }

    /** Le créateur d'abord, puis les organisateurs qu'il a désignés. */
    private List<OrganisateurVue> organisateurs(Long sortieId) {
        var id = new MapSqlParameterSource("id", sortieId);
        List<Long> createur = jdbc.queryForList(
                "SELECT createur_id FROM sejour WHERE sortie_id = :id AND createur_id IS NOT NULL", id, Long.class);
        List<OrganisateurVue> liste = new ArrayList<>(jdbc.query("""
                SELECT id, prenom, nom FROM utilisateur
                 WHERE id IN (SELECT createur_id FROM sejour WHERE sortie_id = :id)
                    OR id IN (SELECT utilisateur_id FROM sejour_organisateur WHERE sortie_id = :id)""", id,
                (rs, i) -> new OrganisateurVue(rs.getLong("id"), rs.getString("prenom") + " " + rs.getString("nom"),
                        createur.contains(rs.getLong("id")))));
        liste.sort(Comparator.comparing((OrganisateurVue o) -> !o.createur())
                .thenComparing(o -> o.nomComplet().toLowerCase(Locale.ROOT)));
        return liste;
    }

    /** Le compte qui crée la sortie devient le créateur de son séjour. */
    @Transactional
    public void noterCreateur(Long sortieId, Long utilisateurId) {
        var p = new MapSqlParameterSource("id", sortieId).addValue("moi", utilisateurId);
        if (jdbc.update("UPDATE sejour SET createur_id = :moi WHERE sortie_id = :id", p) == 0) {
            jdbc.update("INSERT INTO sejour (sortie_id, createur_id) VALUES (:id, :moi)", p);
        }
    }

    /**
     * Les organisateurs désignés (le créateur n'y figure pas : il l'est
     * toujours). Seulement des comptes d'encadrant actifs : ils modifient le
     * séjour depuis l'appli.
     */
    @Transactional
    public void definirOrganisateurs(Long sortieId, List<Long> utilisateurIds) {
        sorties.lire(sortieId);
        Set<Long> choisis = new LinkedHashSet<>(utilisateurIds);
        var id = new MapSqlParameterSource("id", sortieId);
        choisis.removeAll(jdbc.queryForList(
                "SELECT createur_id FROM sejour WHERE sortie_id = :id AND createur_id IS NOT NULL", id, Long.class));
        if (!choisis.isEmpty()) {
            List<Long> encadrants = jdbc.queryForList("""
                    SELECT DISTINCT u.id FROM utilisateur u JOIN utilisateur_role r ON r.utilisateur_id = u.id
                     WHERE u.id IN (:ids) AND u.actif = TRUE
                       AND r.role IN ('MONITEUR', 'ADMIN', 'DIRECTEUR_TECHNIQUE')""",
                    new MapSqlParameterSource("ids", choisis), Long.class);
            if (encadrants.size() != choisis.size()) {
                throw new RegleMetierException("Seul un encadrant qui a un compte actif peut organiser le séjour.");
            }
        }
        jdbc.update("DELETE FROM sejour_organisateur WHERE sortie_id = :id", id);
        for (Long u : choisis) {
            jdbc.update("INSERT INTO sejour_organisateur (sortie_id, utilisateur_id) VALUES (:id, :u)",
                    new MapSqlParameterSource("id", sortieId).addValue("u", u));
        }
    }

    private static final String SELECT_PARTICIPANT = """
            SELECT p.*, e.utilisateur_id AS compte_eleve, g.nom AS nom_groupe,
                   (SELECT c.type_contenu FROM sejour_carte_embarquement c
                     WHERE c.participant_id = p.id AND c.sens = 'ARRIVEE') AS arrivee_carte_embarquement,
                   (SELECT c.type_contenu FROM sejour_carte_embarquement c
                     WHERE c.participant_id = p.id AND c.sens = 'DEPART') AS depart_carte_embarquement,
                   (SELECT a.type_contenu FROM sejour_attestation_assurance a
                     WHERE a.participant_id = p.id) AS attestation_assurance
              FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
              LEFT JOIN membre_groupe_plongeurs m ON m.id = p.membre_groupe_id
              LEFT JOIN groupe_plongeurs g ON g.id = m.groupe_id""";

    /** Les groupes de plongeurs de la saison du séjour, avec leurs plongeurs. */
    private List<GroupeProposeVue> groupesProposes(LocalDate debut) {
        var saison = new MapSqlParameterSource("debut", debut);
        Map<Long, List<PlongeurGroupeVue>> plongeurs = new HashMap<>();
        jdbc.query("""
                SELECT m.*, COALESCE(m.email, e.email, u.email) AS email_effectif
                  FROM membre_groupe_plongeurs m
                  JOIN groupe_plongeurs g ON g.id = m.groupe_id JOIN saison s ON s.id = g.saison_id
                  LEFT JOIN eleve e ON e.id = m.eleve_id LEFT JOIN utilisateur u ON u.id = m.utilisateur_id
                 WHERE :debut BETWEEN s.date_debut AND s.date_fin
                 ORDER BY LOWER(m.nom), LOWER(m.prenom)""", saison,
                rs -> {
                    plongeurs.computeIfAbsent(rs.getLong("groupe_id"), k -> new ArrayList<>()).add(new PlongeurGroupeVue(
                            rs.getLong("id"), rs.getObject("eleve_id", Long.class),
                            rs.getObject("utilisateur_id", Long.class), rs.getString("nom"), rs.getString("prenom"),
                            rs.getString("email_effectif"), rs.getString("aptitude")));
                });
        return jdbc.query("""
                SELECT g.id, g.nom FROM groupe_plongeurs g JOIN saison s ON s.id = g.saison_id
                 WHERE :debut BETWEEN s.date_debut AND s.date_fin
                 ORDER BY g.nom""", saison,
                (rs, i) -> {
                    List<PlongeurGroupeVue> liste = plongeurs.getOrDefault(rs.getLong("id"), List.of());
                    return new GroupeProposeVue(rs.getLong("id"), rs.getString("nom"), liste.size(), liste);
                });
    }

    /**
     * Le programme (rendez-vous et plongées de la sortie) et les affaires à
     * prévoir, pour la page du participant entré par le lien : son encart
     * « Aujourd'hui ». Rien de personnel, hormis sa palanquée.
     */
    public record ProgrammeVue(List<EvenementVue> evenements, List<SortieService.SeanceSortieVue> plongees,
                               List<AffaireVue> affaires, List<PalanqueesSejourService.PalanqueeVue> palanquees,
                               List<JourneesSejourService.JourneeVue> journees) {}

    @Transactional(readOnly = true)
    public ProgrammeVue programme(Long sortieId, Long participantId) {
        return new ProgrammeVue(evenements(sortieId), sorties.lire(sortieId).seances(), affaires(sortieId),
                palanquees.palanquees(sortieId, participantId, false), journees.journees(sortieId));
    }

    private List<AffaireVue> affaires(Long sortieId) {
        return jdbc.query("SELECT * FROM sejour_affaire WHERE sortie_id = :id ORDER BY ordre, id",
                new MapSqlParameterSource("id", sortieId),
                (rs, i) -> new AffaireVue(rs.getLong("id"), CategorieAffaire.valueOf(rs.getString("categorie")),
                        rs.getString("libelle"), rs.getBoolean("indispensable")));
    }

    private List<EvenementVue> evenements(Long sortieId) {
        return jdbc.query("SELECT * FROM sejour_evenement WHERE sortie_id = :id", new MapSqlParameterSource("id", sortieId),
                        (rs, i) -> new EvenementVue(rs.getLong("id"), rs.getObject("jour", LocalDate.class),
                                rs.getObject("heure_debut", LocalTime.class), rs.getObject("heure_fin", LocalTime.class),
                                rs.getString("titre"), rs.getString("lieu"), rs.getString("details")))
                .stream()
                .sorted(Comparator.comparing(EvenementVue::jour)
                        .thenComparing(e -> e.heureDebut() == null ? LocalTime.MIN : e.heureDebut())
                        .thenComparing(EvenementVue::id))
                .toList();
    }

    /**
     * Le carnet d'un participant entré par le lien et le code (sans compte) :
     * le même que celui d'un participant connecté à l'appli, « moi » étant
     * repéré par sa ligne et non par un compte.
     */
    @Transactional(readOnly = true)
    public SejourVue carnetDuParticipant(Long sortieId, Long participantId) {
        SejourVue complet = vueComplete(sortieId, null, false, false);
        List<ParticipantVue> participants = complet.participants().stream()
                .map(p -> !p.id().equals(participantId) ? p : new ParticipantVue(p.id(), p.eleveId(), p.utilisateurId(),
                        p.nom(), p.prenom(), p.plongeur(), p.telephone(), p.email(), p.regimes(), p.regimePrecision(),
                        p.urgenceNom(), p.urgenceTelephone(), p.arrivee(), p.depart(), p.remarques(), true,
                        p.membreGroupeId(), p.groupe(), p.attestationAssurance()))
                .toList();
        return carnet(new SejourVue(complet.sortie(), false, false, complet.infosPratiques(), participants,
                complet.voitures(), complet.logements(), complet.affaires(), complet.evenements(), complet.journees(),
                frais.lire(sortieId, frais.acteurParticipant(participantId)), List.of(), List.of(),
                complet.organisateurs(), false, palanquees.palanquees(sortieId, participantId, false),
                complet.conseilAssurance()));
    }

    /** Le même séjour, avec les frais vus par celui qui agit (ce qu'il peut saisir, modifier). */
    private static SejourVue avecFrais(SejourVue s, FraisService.FraisVue f) {
        return new SejourVue(s.sortie(), s.gere(), s.encadrant(), s.infosPratiques(), s.participants(), s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.journees(),f, s.avertissements(), s.groupesProposes(),
                s.organisateurs(), s.peutDesigner(), s.palanquees(), s.conseilAssurance());
    }

    private static SejourVue avecDesignation(SejourVue s, boolean peutDesigner) {
        return new SejourVue(s.sortie(), s.gere(), s.encadrant(), s.infosPratiques(), s.participants(), s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.journees(),s.frais(), s.avertissements(), s.groupesProposes(),
                s.organisateurs(), peutDesigner, s.palanquees(), s.conseilAssurance());
    }

    /** Le carnet d'un participant : ses propres données, et des autres seulement ce qui organise le séjour. */
    private static SejourVue carnet(SejourVue s) {
        List<ParticipantVue> participants = s.participants().stream()
                .map(p -> p.moi() ? p : new ParticipantVue(p.id(), null, null, p.nom(), p.prenom(), p.plongeur(),
                        null, null, Set.of(), null, null, null, sansReservation(p.arrivee()),
                        sansReservation(p.depart()), null, false, null, null, null))
                .toList();
        return new SejourVue(s.sortie(), false, false, s.infosPratiques(), participants, s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.journees(),s.frais(), List.of(), List.of(),
                s.organisateurs(), false, s.palanquees(), s.conseilAssurance());
    }

    /**
     * Pour un encadrant qui n'organise pas : tout, sauf le dossier, le lien
     * d'enregistrement et l'attestation d'assurance des autres.
     */
    private static SejourVue sansReservationsDesAutres(SejourVue s) {
        List<ParticipantVue> participants = s.participants().stream()
                .map(p -> p.moi() ? p : new ParticipantVue(p.id(), p.eleveId(), p.utilisateurId(), p.nom(),
                        p.prenom(), p.plongeur(), p.telephone(), p.email(), p.regimes(), p.regimePrecision(),
                        p.urgenceNom(), p.urgenceTelephone(), sansReservation(p.arrivee()),
                        sansReservation(p.depart()), p.remarques(), false, p.membreGroupeId(), p.groupe(), null))
                .toList();
        return new SejourVue(s.sortie(), s.gere(), s.encadrant(), s.infosPratiques(), participants, s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.journees(),s.frais(), s.avertissements(), s.groupesProposes(),
                s.organisateurs(), s.peutDesigner(), s.palanquees(), s.conseilAssurance());
    }

    private static Trajet sansReservation(Trajet t) {
        return t == null ? null : t.sansReservation();
    }

    private static ParticipantVue participant(ResultSet rs, Long moi) throws SQLException {
        Long utilisateur = rs.getObject("utilisateur_id", Long.class);
        Long compteEleve = rs.getObject("compte_eleve", Long.class);
        boolean estMoi = moi != null && (moi.equals(utilisateur) || moi.equals(compteEleve));
        return new ParticipantVue(rs.getLong("id"), rs.getObject("eleve_id", Long.class), utilisateur,
                rs.getString("nom"), rs.getString("prenom"), rs.getBoolean("plongeur"),
                rs.getString("telephone"), rs.getString("email"), lireRegimes(rs.getString("regimes")),
                rs.getString("regime_precision"), rs.getString("urgence_nom"), rs.getString("urgence_telephone"),
                trajet(rs, "arrivee"), trajet(rs, "depart"), rs.getString("remarques"), estMoi,
                rs.getObject("membre_groupe_id", Long.class), rs.getString("nom_groupe"),
                rs.getString("attestation_assurance"));
    }

    private static Trajet trajet(ResultSet rs, String sens) throws SQLException {
        String transport = rs.getString(sens + "_transport");
        boolean aller = sens.equals("arrivee");
        Trajet t = new Trajet(rs.getObject(sens + "_date", LocalDate.class), rs.getObject(sens + "_heure", LocalTime.class),
                transport == null ? null : MoyenTransport.valueOf(transport),
                rs.getString(sens + "_numero"), rs.getString(sens + "_lieu"),
                aller ? rs.getObject("arrivee_heure_depart", LocalTime.class) : null,
                aller ? rs.getString("arrivee_lieu_depart") : null,
                aller ? null : rs.getObject("depart_heure_arrivee", LocalTime.class),
                aller ? rs.getObject("arrivee_date_depart", LocalDate.class) : null,
                aller ? null : rs.getObject("depart_date_arrivee", LocalDate.class),
                aller ? null : rs.getString("depart_lieu_arrivee"),
                rs.getString(sens + "_terminal"), rs.getString(sens + "_dossier"),
                rs.getString(sens + "_lien_enregistrement"),
                rs.getObject(sens + "_ouverture_enregistrement", LocalDateTime.class),
                rs.getString(sens + "_carte_embarquement"));
        return t.vide() ? null : t;
    }

    private static Set<RegimeAlimentaire> lireRegimes(String texte) {
        if (blanc(texte)) return Set.of();
        Set<RegimeAlimentaire> regimes = EnumSet.noneOf(RegimeAlimentaire.class);
        for (String code : texte.split(",")) {
            try {
                regimes.add(RegimeAlimentaire.valueOf(code.trim()));
            } catch (IllegalArgumentException ignore) {
                // Code retiré de l'énumération : ignoré plutôt que de casser la lecture.
            }
        }
        return regimes;
    }

    // ------------------------------------------------------------------
    //  Avertissements
    // ------------------------------------------------------------------

    static List<String> avertissements(List<ParticipantVue> participants, List<VoitureVue> voitures,
                                       List<LogementVue> logements) {
        Map<Long, String> noms = participants.stream()
                .collect(Collectors.toMap(ParticipantVue::id, p -> p.prenom() + " " + p.nom()));
        List<String> resultat = new ArrayList<>();

        Map<Long, List<String>> voituresDe = new LinkedHashMap<>();
        for (VoitureVue v : voitures) {
            int aBord = v.passagerIds().size() + (v.conducteurId() == null ? 0 : 1);
            if (aBord > v.places()) {
                resultat.add("Voiture « " + v.nom() + " » : " + aBord + " personnes pour " + v.places() + " places.");
            }
            if (v.conducteurId() == null) {
                resultat.add("Voiture « " + v.nom() + " » : pas encore de conducteur.");
            } else {
                voituresDe.computeIfAbsent(v.conducteurId(), k -> new ArrayList<>()).add(v.nom());
            }
            v.passagerIds().forEach(p -> voituresDe.computeIfAbsent(p, k -> new ArrayList<>()).add(v.nom()));
        }
        voituresDe.forEach((p, liste) -> {
            if (liste.size() > 1) {
                resultat.add(noms.get(p) + " est dans plusieurs voitures (« " + String.join(" », « ", liste)
                        + " ») : retirez-le de l'une d'elles.");
            }
        });

        Set<Long> loges = new HashSet<>();
        for (LogementVue l : logements) {
            for (ChambreVue c : l.chambres()) {
                loges.addAll(c.occupantIds());
                if (c.occupantIds().size() > c.couchages()) {
                    resultat.add("Chambre « " + c.nom() + " » (" + l.nom() + ") : " + c.occupantIds().size()
                            + " occupants pour " + c.couchages() + " couchage" + (c.couchages() > 1 ? "s" : "") + ".");
                }
            }
        }
        if (!logements.isEmpty()) {
            List<String> sansChambre = participants.stream().filter(p -> !loges.contains(p.id()))
                    .map(p -> p.prenom() + " " + p.nom()).toList();
            if (!sansChambre.isEmpty()) {
                resultat.add("Sans chambre : " + String.join(", ", sansChambre) + ".");
            }
        }
        return resultat;
    }

    // ------------------------------------------------------------------
    //  Infos pratiques
    // ------------------------------------------------------------------

    @Transactional
    public void definirInfos(Long sortieId, String infos) {
        sorties.sortie(sortieId);
        var p = new MapSqlParameterSource("id", sortieId).addValue("infos", nettoyer(infos));
        // La ligne garde aussi le code de l'adresse des frais (V77) : on ne la remplace pas.
        if (jdbc.update("UPDATE sejour SET infos_pratiques = :infos WHERE sortie_id = :id", p) == 0) {
            jdbc.update("INSERT INTO sejour (sortie_id, infos_pratiques) VALUES (:id, :infos)", p);
        }
    }

    /** Le conseil d'assurance (V99) : vide, plus d'encart dans « Mon séjour ». */
    @Transactional
    public void definirConseilAssurance(Long sortieId, String conseil) {
        sorties.sortie(sortieId);
        var p = new MapSqlParameterSource("id", sortieId).addValue("conseil", nettoyer(conseil));
        if (jdbc.update("UPDATE sejour SET conseil_assurance = :conseil WHERE sortie_id = :id", p) == 0) {
            jdbc.update("INSERT INTO sejour (sortie_id, conseil_assurance) VALUES (:id, :conseil)", p);
        }
    }

    // ------------------------------------------------------------------
    //  Participants
    // ------------------------------------------------------------------

    @Transactional
    public void ajouterParticipant(Long sortieId, DemandeParticipant d) {
        sorties.sortie(sortieId);
        verifier(sortieId, null, d);
        DemandeParticipant complet = completerDuDossier(d);
        inserer(sortieId, complet);
        reporterSurLePlongeur(complet);
    }

    @Transactional
    public void modifierParticipant(Long sortieId, Long participantId, DemandeParticipant d) {
        verifierParticipants(sortieId, List.of(participantId));
        verifier(sortieId, participantId, d);
        var p = parametres(sortieId, d).addValue("pid", participantId);
        // Rattaché à une autre personne : l'accord pour montrer sa photo aux participants ne la suit pas.
        jdbc.update("""
                UPDATE sejour_participant SET photo_visible_participants = FALSE,
                       photo_visible_accord_par = NULL, photo_visible_accord_le = NULL
                 WHERE id = :pid AND (eleve_id IS DISTINCT FROM :eleve OR utilisateur_id IS DISTINCT FROM :utilisateur
                       OR membre_groupe_id IS DISTINCT FROM :membreGroupe)""", p);
        jdbc.update("""
                UPDATE sejour_participant SET eleve_id = :eleve, utilisateur_id = :utilisateur, nom = :nom,
                       prenom = :prenom, plongeur = :plongeur, membre_groupe_id = :membreGroupe,
                       telephone = :telephone, email = :email,
                       regimes = :regimes, regime_precision = :regimePrecision, urgence_nom = :urgenceNom,
                       urgence_telephone = :urgenceTelephone,
                       arrivee_date = :arriveeDate, arrivee_heure = :arriveeHeure,
                       arrivee_transport = :arriveeTransport, arrivee_numero = :arriveeNumero,
                       arrivee_lieu = :arriveeLieu, arrivee_heure_depart = :arriveeHeureDepart,
                       arrivee_lieu_depart = :arriveeLieuDepart,
                       depart_date = :departDate, depart_heure = :departHeure,
                       depart_transport = :departTransport, depart_numero = :departNumero,
                       depart_lieu = :departLieu, depart_heure_arrivee = :departHeureArrivee,
                       arrivee_date_depart = :arriveeDateDepart, depart_date_arrivee = :departDateArrivee,
                       depart_lieu_arrivee = :departLieuArrivee,%s
                       remarques = :remarques
                 WHERE id = :pid""".formatted(RESERVATIONS), p);
        oublierCartesSansVoyage(sortieId);
        jdbc.update(TrombinoscopeSejourService.OUBLIER_PHOTOS_DES_NON_INVITES, Map.of());
        reporterSurLePlongeur(d);
    }

    /**
     * Le participant est aussi un plongeur d'un groupe de plongeurs : nom,
     * prénom et e-mail suivent dans le groupe (l'inverse est fait par
     * {@code GroupePlongeursService}). Un e-mail vide laisse celui du groupe ;
     * celui du dossier de l'élève ou de l'encadrant vide l'e-mail du groupe,
     * qui suit alors le dossier (sinon une adresse changée plus tard dans le
     * dossier resterait l'ancienne dans le groupe).
     */
    private void reporterSurLePlongeur(DemandeParticipant d) {
        if (d.membreGroupeId() == null) return;
        var p = new MapSqlParameterSource("membre", d.membreGroupeId());
        List<Map<String, Object>> lignes = jdbc.queryForList("""
                SELECT m.email, COALESCE(e.email, u.email) AS email_dossier FROM membre_groupe_plongeurs m
                  LEFT JOIN eleve e ON e.id = m.eleve_id LEFT JOIN utilisateur u ON u.id = m.utilisateur_id
                 WHERE m.id = :membre""", p);
        if (lignes.isEmpty()) return;
        String email = nettoyer(d.email());
        String emailDossier = nettoyer((String) lignes.getFirst().get("email_dossier"));
        String emailGroupe = email == null ? (String) lignes.getFirst().get("email")
                : email.equalsIgnoreCase(emailDossier == null ? "" : emailDossier) ? null : email;
        jdbc.update("UPDATE membre_groupe_plongeurs SET nom = :nom, prenom = :prenom, email = :email WHERE id = :membre",
                p.addValue("nom", d.nom().trim()).addValue("prenom", d.prenom().trim())
                        .addValue("email", emailGroupe, Types.VARCHAR));
    }

    /** Sa propre ligne, entière (il la voit et la complète lui-même). */
    @Transactional(readOnly = true)
    public ParticipantVue participant(Long participantId) {
        List<ParticipantVue> lignes = jdbc.query(SELECT_PARTICIPANT + " WHERE p.id = :pid",
                new MapSqlParameterSource("pid", participantId), (rs, i) -> participant(rs, null));
        if (lignes.isEmpty()) throw new RessourceIntrouvableException("Participant introuvable");
        ParticipantVue p = lignes.getFirst();
        return new ParticipantVue(p.id(), p.eleveId(), p.utilisateurId(), p.nom(), p.prenom(), p.plongeur(),
                p.telephone(), p.email(), p.regimes(), p.regimePrecision(), p.urgenceNom(), p.urgenceTelephone(),
                p.arrivee(), p.depart(), p.remarques(), true, p.membreGroupeId(), p.groupe(), p.attestationAssurance());
    }

    /** Le participant complète ses informations : le reste de sa ligne ne change pas. */
    @Transactional
    public void modifierMesInformations(Long participantId, DemandeMesInformations d) {
        ParticipantVue actuel = participant(participantId);
        Trajet.verifier(d.arrivee());
        Trajet.verifier(d.depart());
        LocalDateTime arrivee = moment(d.arrivee());
        LocalDateTime depart = moment(d.depart());
        if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
            throw new RegleMetierException("Votre départ est avant votre arrivée : vérifiez les dates.");
        }
        var p = parametres(null, new DemandeParticipant(actuel.eleveId(), actuel.utilisateurId(), actuel.nom(),
                actuel.prenom(), actuel.plongeur(), d.telephone(), actuel.email(), d.regimes(), d.regimePrecision(),
                d.urgenceNom(), d.urgenceTelephone(), d.arrivee(), d.depart(), d.remarques(), actuel.membreGroupeId()))
                .addValue("pid", participantId);
        jdbc.update("""
                UPDATE sejour_participant SET telephone = :telephone, regimes = :regimes,
                       regime_precision = :regimePrecision, urgence_nom = :urgenceNom,
                       urgence_telephone = :urgenceTelephone,
                       arrivee_date = :arriveeDate, arrivee_heure = :arriveeHeure,
                       arrivee_transport = :arriveeTransport, arrivee_numero = :arriveeNumero,
                       arrivee_lieu = :arriveeLieu, arrivee_heure_depart = :arriveeHeureDepart,
                       arrivee_lieu_depart = :arriveeLieuDepart,
                       depart_date = :departDate, depart_heure = :departHeure,
                       depart_transport = :departTransport, depart_numero = :departNumero,
                       depart_lieu = :departLieu, depart_heure_arrivee = :departHeureArrivee,
                       arrivee_date_depart = :arriveeDateDepart, depart_date_arrivee = :departDateArrivee,
                       depart_lieu_arrivee = :departLieuArrivee,%s
                       remarques = :remarques
                 WHERE id = :pid""".formatted(RESERVATIONS), p);
        oublierCartesSansVoyage(jdbc.queryForObject("SELECT sortie_id FROM sejour_participant WHERE id = :pid",
                p, Long.class));
    }

    /** Les colonnes de réservation des deux voyages (V96), dans un UPDATE. */
    private static final String RESERVATIONS = """

                       arrivee_terminal = :arriveeTerminal, arrivee_dossier = :arriveeDossier,
                       arrivee_lien_enregistrement = :arriveeLien, arrivee_ouverture_enregistrement = :arriveeOuverture,
                       depart_terminal = :departTerminal, depart_dossier = :departDossier,
                       depart_lien_enregistrement = :departLien, depart_ouverture_enregistrement = :departOuverture,""";

    /** Le même vol (ou train) pour plusieurs participants : arrivée ou départ, sans rien recopier. */
    public enum SensTrajet { ARRIVEE, DEPART }

    public record DemandeTrajetCommun(@NotNull SensTrajet sens, @Valid Trajet trajet, @NotNull List<Long> participantIds) {}

    /**
     * Pose ce trajet sur chacun des participants donnés (les autres ne
     * changent pas). Refus, sans rien écrire, si l'un d'eux partirait avant
     * d'arriver.
     */
    @Transactional
    public void appliquerTrajet(Long sortieId, DemandeTrajetCommun d) {
        sorties.sortie(sortieId);
        List<Long> ids = d.participantIds().stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) throw new RegleMetierException("Cochez au moins un participant.");
        verifierParticipants(sortieId, ids);
        Trajet t = d.trajet() == null || d.trajet().vide() ? null : d.trajet();
        Trajet.verifier(t);
        for (Long id : ids) {
            ParticipantVue p = participant(id);
            LocalDateTime arrivee = moment(d.sens() == SensTrajet.ARRIVEE ? t : p.arrivee());
            LocalDateTime depart = moment(d.sens() == SensTrajet.DEPART ? t : p.depart());
            if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
                throw new RegleMetierException("Le départ de " + p.prenom() + " " + p.nom()
                        + " serait avant son arrivée : vérifiez la date.");
            }
        }
        String sens = d.sens() == SensTrajet.ARRIVEE ? "arrivee" : "depart";
        var p = new MapSqlParameterSource("ids", ids).addValue("sortie", sortieId);
        trajet(p, "t", t);
        String autreHoraire = d.sens() == SensTrajet.ARRIVEE
                ? ", arrivee_heure_depart = :tHeureDepart, arrivee_lieu_depart = :tLieuDepart,"
                  + " arrivee_date_depart = :tDateDepart"
                : ", depart_heure_arrivee = :tHeureArrivee, depart_date_arrivee = :tDateArrivee,"
                  + " depart_lieu_arrivee = :tLieuArrivee";
        // Le dossier et le lien sont souvent propres à chacun : laissés vides, ils ne changent pas.
        if (t != null && !blanc(t.dossier())) autreHoraire += ", %s_dossier = :tDossier".formatted(sens);
        if (t != null && !blanc(t.lienEnregistrement())) autreHoraire += ", %s_lien_enregistrement = :tLien".formatted(sens);
        jdbc.update("""
                UPDATE sejour_participant SET %1$s_date = :tDate, %1$s_heure = :tHeure, %1$s_transport = :tTransport,
                       %1$s_numero = :tNumero, %1$s_lieu = :tLieu, %1$s_terminal = :tTerminal,
                       %1$s_ouverture_enregistrement = :tOuverture%2$s
                 WHERE sortie_id = :sortie AND id IN (:ids)""".formatted(sens, autreHoraire), p);
        oublierCartesSansVoyage(sortieId);
    }

    /**
     * Un voyage effacé emporte sa carte d'embarquement (V98) : elle ne se
     * voit plus sans voyage, et ne doit pas rester en base sans être vue.
     */
    private void oublierCartesSansVoyage(Long sortieId) {
        for (String sens : List.of("arrivee", "depart")) {
            jdbc.update("""
                    DELETE FROM sejour_carte_embarquement WHERE sens = :sens AND participant_id IN (
                        SELECT id FROM sejour_participant WHERE sortie_id = :sortie
                           AND %1$s_date IS NULL AND %1$s_heure IS NULL
                           AND %1$s_transport IS NULL AND %1$s_numero IS NULL)""".formatted(sens),
                    new MapSqlParameterSource("sortie", sortieId).addValue("sens", sens.toUpperCase(Locale.ROOT)));
        }
    }

    /** Il quitte aussi sa voiture et sa chambre ; une voiture qu'il conduisait n'a plus de conducteur. */
    @Transactional
    public void supprimerParticipant(Long sortieId, Long participantId) {
        verifierParticipants(sortieId, List.of(participantId));
        int frais = compter("""
                SELECT (SELECT COUNT(*) FROM sejour_depense WHERE payeur_id = :x)
                     + (SELECT COUNT(*) FROM sejour_depense_part WHERE participant_id = :x)
                     + (SELECT COUNT(*) FROM sejour_versement WHERE de_id = :x OR a_id = :x)""", participantId);
        if (frais > 0) {
            throw new RegleMetierException(nomDe(participantId) + " figure dans le partage des frais : "
                    + "retirez-le d'abord des dépenses et des remboursements, sinon les comptes seraient faux.");
        }
        jdbc.update("DELETE FROM sejour_participant WHERE id = :pid", new MapSqlParameterSource("pid", participantId));
    }

    /**
     * Inscrit les membres d'un groupe de plongeurs qui ne sont pas déjà du
     * séjour, chacun lié à son plongeur du groupe ; celui qui était déjà
     * inscrit sans lien y est lié s'il a les mêmes nom, prénom et e-mail
     * (sinon l'écran le signale, à lier depuis sa fiche). Renvoie le nombre
     * d'inscrits.
     */
    @Transactional
    public int importerGroupe(Long sortieId, Long groupeId) {
        sorties.sortie(sortieId);
        var g = new MapSqlParameterSource("groupe", groupeId);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM groupe_plongeurs WHERE id = :groupe", g, Integer.class) == 0) {
            throw new RessourceIntrouvableException("Groupe de plongeurs introuvable");
        }
        List<DemandeParticipant> membres = jdbc.query("""
                SELECT id, eleve_id, utilisateur_id, nom, prenom, email FROM membre_groupe_plongeurs
                 WHERE groupe_id = :groupe ORDER BY id""", g,
                (rs, i) -> new DemandeParticipant(rs.getObject("eleve_id", Long.class),
                        rs.getObject("utilisateur_id", Long.class), rs.getString("nom"), rs.getString("prenom"),
                        true, null, rs.getString("email"), Set.of(), null, null, null, null, null, null,
                        rs.getLong("id")));
        int ajoutes = 0;
        for (DemandeParticipant m : membres) {
            if (compter("SELECT COUNT(*) FROM sejour_participant WHERE sortie_id = :sortie AND membre_groupe_id = :x",
                    m.membreGroupeId(), sortieId) > 0) continue;
            Inscrit deja = doublon(sortieId, null, m);
            if (deja != null) {
                if (memesCoordonnees(deja.id(), m)) {
                    jdbc.update("""
                            UPDATE sejour_participant SET membre_groupe_id = :membre, plongeur = TRUE,
                                   photo_visible_participants = FALSE, photo_visible_accord_par = NULL,
                                   photo_visible_accord_le = NULL
                             WHERE id = :pid AND membre_groupe_id IS NULL""",
                            new MapSqlParameterSource("membre", m.membreGroupeId()).addValue("pid", deja.id()));
                }
                continue;
            }
            inserer(sortieId, completerDuDossier(m));
            ajoutes++;
        }
        jdbc.update(TrombinoscopeSejourService.OUBLIER_PHOTOS_DES_NON_INVITES, Map.of());
        return ajoutes;
    }

    private void verifier(Long sortieId, Long participantId, DemandeParticipant d) {
        Inscrit deja = doublon(sortieId, participantId, d);
        if (deja != null) {
            throw new RegleMetierException("« " + deja.nom() + " » participe déjà au séjour.");
        }
        // Le carnet et la demande d'informations partent à cette adresse, et elle passe dans le groupe de plongeurs lié.
        if (!blanc(d.email()) && !EMAIL.matcher(d.email().trim()).matches()) {
            throw new RegleMetierException("L'e-mail « " + d.email().trim() + " » n'est pas valide : vérifiez-le.");
        }
        if (d.membreGroupeId() != null) {
            verifierPlongeurDuGroupe(sortieId, participantId, d.membreGroupeId());
        }
        if (d.eleveId() != null && compter("SELECT COUNT(*) FROM eleve WHERE id = :x", d.eleveId()) == 0) {
            throw new RessourceIntrouvableException("Élève introuvable");
        }
        if (d.utilisateurId() != null
                && compter("SELECT COUNT(*) FROM utilisateur WHERE id = :x", d.utilisateurId()) == 0) {
            throw new RessourceIntrouvableException("Compte introuvable");
        }
        Trajet.verifier(d.arrivee());
        Trajet.verifier(d.depart());
        LocalDateTime arrivee = moment(d.arrivee());
        LocalDateTime depart = moment(d.depart());
        if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
            throw new RegleMetierException("Le départ de " + d.prenom().trim() + " " + d.nom().trim()
                    + " est avant son arrivée : vérifiez les dates.");
        }
    }

    /**
     * Le participant déjà inscrit a les mêmes nom, prénom et e-mail que le
     * plongeur du groupe (un e-mail vide d'un côté ne compte pas). Sinon on ne
     * le lie pas tout seul : le report suivant écraserait ce qui a été saisi
     * dans le séjour sans que personne l'ait vu. L'organisateur le lie depuis
     * sa fiche, où il voit les deux.
     */
    private boolean memesCoordonnees(Long participantId, DemandeParticipant membre) {
        Map<String, Object> p = jdbc.queryForMap("SELECT nom, prenom, email FROM sejour_participant WHERE id = :p",
                new MapSqlParameterSource("p", participantId));
        String email = (String) p.get("email");
        return membre.nom().trim().equalsIgnoreCase(((String) p.get("nom")).trim())
                && membre.prenom().trim().equalsIgnoreCase(((String) p.get("prenom")).trim())
                && (blanc(email) || blanc(membre.email()) || email.trim().equalsIgnoreCase(membre.email().trim()));
    }

    /** Un plongeur d'un groupe de la saison du séjour, qui n'est pas déjà lié à un autre participant. */
    private void verifierPlongeurDuGroupe(Long sortieId, Long participantId, Long membreId) {
        var p = new MapSqlParameterSource("membre", membreId).addValue("debut", sorties.lire(sortieId).dateDebut());
        Integer trouve = jdbc.queryForObject("""
                SELECT COUNT(*) FROM membre_groupe_plongeurs m
                  JOIN groupe_plongeurs g ON g.id = m.groupe_id JOIN saison s ON s.id = g.saison_id
                 WHERE m.id = :membre AND :debut BETWEEN s.date_debut AND s.date_fin""", p, Integer.class);
        if (trouve == null || trouve == 0) {
            throw new RegleMetierException("Ce plongeur n'est dans aucun groupe de plongeurs de la saison du séjour.");
        }
        List<String> autres = jdbc.queryForList("""
                SELECT prenom || ' ' || nom FROM sejour_participant
                 WHERE sortie_id = :sortie AND membre_groupe_id = :membre AND id <> :pid""",
                p.addValue("sortie", sortieId).addValue("pid", participantId == null ? -1L : participantId),
                String.class);
        if (!autres.isEmpty()) {
            throw new RegleMetierException("Ce plongeur du groupe est déjà lié à « " + autres.getFirst()
                    + " » dans ce séjour.");
        }
    }

    private record Inscrit(Long id, String nom) {}

    /** Celui qui est déjà inscrit : même dossier, même compte, ou mêmes nom et prénom. */
    private Inscrit doublon(Long sortieId, Long participantId, DemandeParticipant d) {
        var p = new MapSqlParameterSource("id", sortieId).addValue("pid", participantId == null ? -1L : participantId)
                .addValue("eleve", d.eleveId()).addValue("utilisateur", d.utilisateurId())
                .addValue("nom", d.nom().trim().toLowerCase(Locale.ROOT))
                .addValue("prenom", d.prenom().trim().toLowerCase(Locale.ROOT));
        // Conditions écrites seulement pour un lien donné : Postgres ne sait pas typer « :x IS NULL ».
        String memeDossier = (d.eleveId() == null ? "" : " OR eleve_id = :eleve")
                + (d.utilisateurId() == null ? "" : " OR utilisateur_id = :utilisateur");
        List<Inscrit> inscrits = jdbc.query("""
                SELECT id, prenom || ' ' || nom FROM sejour_participant
                 WHERE sortie_id = :id AND id <> :pid
                   AND ((LOWER(nom) = :nom AND LOWER(prenom) = :prenom)""" + memeDossier + ") ORDER BY id", p,
                (rs, i) -> new Inscrit(rs.getLong(1), rs.getString(2)));
        return inscrits.isEmpty() ? null : inscrits.getFirst();
    }

    /** Coordonnées et personne à prévenir reprises du dossier élève (ou l'e-mail du compte) quand elles manquent. */
    private DemandeParticipant completerDuDossier(DemandeParticipant d) {
        String telephone = d.telephone();
        String email = d.email();
        String urgenceNom = d.urgenceNom();
        String urgenceTelephone = d.urgenceTelephone();
        if (d.eleveId() != null) {
            var dossier = jdbc.queryForMap("""
                    SELECT email, telephone, contact_urgence_nom, contact_urgence_telephone
                      FROM eleve WHERE id = :x""", new MapSqlParameterSource("x", d.eleveId()));
            if (blanc(telephone)) telephone = (String) dossier.get("telephone");
            if (blanc(email)) email = (String) dossier.get("email");
            if (blanc(urgenceNom) && blanc(urgenceTelephone)) {
                urgenceNom = (String) dossier.get("contact_urgence_nom");
                urgenceTelephone = (String) dossier.get("contact_urgence_telephone");
            }
        }
        if (blanc(email) && d.utilisateurId() != null) {
            email = jdbc.queryForObject("SELECT email FROM utilisateur WHERE id = :x",
                    new MapSqlParameterSource("x", d.utilisateurId()), String.class);
        }
        return new DemandeParticipant(d.eleveId(), d.utilisateurId(), d.nom(), d.prenom(), d.plongeur(), telephone,
                email, d.regimes(), d.regimePrecision(), urgenceNom, urgenceTelephone, d.arrivee(), d.depart(),
                d.remarques(), d.membreGroupeId());
    }

    private void inserer(Long sortieId, DemandeParticipant d) {
        jdbc.update("""
                INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur,
                       membre_groupe_id, telephone, email, regimes, regime_precision, urgence_nom, urgence_telephone,
                       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
                       arrivee_heure_depart, arrivee_lieu_depart, arrivee_date_depart,
                       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu,
                       depart_heure_arrivee, depart_date_arrivee, depart_lieu_arrivee,
                       arrivee_terminal, arrivee_dossier, arrivee_lien_enregistrement, arrivee_ouverture_enregistrement,
                       depart_terminal, depart_dossier, depart_lien_enregistrement, depart_ouverture_enregistrement,
                       remarques)
                VALUES (:sortie, :eleve, :utilisateur, :nom, :prenom, :plongeur, :membreGroupe, :telephone, :email, :regimes,
                       :regimePrecision, :urgenceNom, :urgenceTelephone,
                       :arriveeDate, :arriveeHeure, :arriveeTransport, :arriveeNumero, :arriveeLieu,
                       :arriveeHeureDepart, :arriveeLieuDepart, :arriveeDateDepart,
                       :departDate, :departHeure, :departTransport, :departNumero, :departLieu,
                       :departHeureArrivee, :departDateArrivee, :departLieuArrivee,
                       :arriveeTerminal, :arriveeDossier, :arriveeLien, :arriveeOuverture,
                       :departTerminal, :departDossier, :departLien, :departOuverture,
                       :remarques)""",
                parametres(sortieId, d));
    }

    private static MapSqlParameterSource parametres(Long sortieId, DemandeParticipant d) {
        var p = new MapSqlParameterSource("sortie", sortieId)
                .addValue("eleve", d.eleveId()).addValue("utilisateur", d.utilisateurId())
                .addValue("nom", d.nom().trim()).addValue("prenom", d.prenom().trim())
                // Lié à un plongeur d'un groupe : il plonge (un accompagnant n'a pas de lien).
                .addValue("plongeur", d.plongeur() || d.membreGroupeId() != null)
                .addValue("membreGroupe", d.membreGroupeId(), Types.BIGINT)
                .addValue("telephone", nettoyer(d.telephone())).addValue("email", nettoyer(d.email()))
                .addValue("regimes", d.regimes() == null || d.regimes().isEmpty() ? null
                        : d.regimes().stream().sorted().map(Enum::name).collect(Collectors.joining(",")))
                .addValue("regimePrecision", nettoyer(d.regimePrecision()))
                .addValue("urgenceNom", nettoyer(d.urgenceNom()))
                .addValue("urgenceTelephone", nettoyer(d.urgenceTelephone()))
                .addValue("remarques", nettoyer(d.remarques()));
        trajet(p, "arrivee", d.arrivee());
        trajet(p, "depart", d.depart());
        return p;
    }

    private static void trajet(MapSqlParameterSource p, String sens, Trajet t) {
        p.addValue(sens + "Date", t == null ? null : t.date())
                .addValue(sens + "Heure", t == null ? null : t.heure())
                .addValue(sens + "Transport", t == null || t.transport() == null ? null : t.transport().name())
                .addValue(sens + "Numero", t == null ? null : nettoyer(t.numero()))
                .addValue(sens + "Lieu", t == null ? null : nettoyer(t.lieu()))
                .addValue(sens + "HeureDepart", t == null ? null : t.heureDepart())
                .addValue(sens + "LieuDepart", t == null ? null : nettoyer(t.lieuDepart()))
                .addValue(sens + "HeureArrivee", t == null ? null : t.heureArrivee())
                .addValue(sens + "DateDepart", t == null ? null : t.dateDepart())
                .addValue(sens + "DateArrivee", t == null ? null : t.dateArrivee())
                .addValue(sens + "LieuArrivee", t == null ? null : nettoyer(t.lieuArrivee()))
                .addValue(sens + "Terminal", t == null ? null : nettoyer(t.terminal()))
                .addValue(sens + "Dossier", t == null ? null : nettoyer(t.dossier()))
                .addValue(sens + "Lien", t == null ? null : nettoyer(t.lienEnregistrement()))
                .addValue(sens + "Ouverture", t == null ? null : t.ouvertureEnregistrement());
    }

    private static LocalDateTime moment(Trajet t) {
        if (t == null || t.date() == null) return null;
        return t.date().atTime(t.heure() == null ? LocalTime.NOON : t.heure());
    }

    // ------------------------------------------------------------------
    //  Voitures
    // ------------------------------------------------------------------

    @Transactional
    public void creerVoiture(Long sortieId, DemandeVoiture d) {
        sorties.sortie(sortieId);
        List<Long> passagers = verifier(sortieId, null, d);
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO sejour_voiture (sortie_id, nom, places, conducteur_id, trajet, remarques)
                VALUES (:sortie, :nom, :places, :conducteur, :trajet, :remarques)""",
                parametres(sortieId, d), cle, new String[]{"id"});
        ecrirePassagers(cle.getKey().longValue(), passagers);
    }

    @Transactional
    public void modifierVoiture(Long sortieId, Long voitureId, DemandeVoiture d) {
        voitureDe(sortieId, voitureId);
        List<Long> passagers = verifier(sortieId, voitureId, d);
        jdbc.update("""
                UPDATE sejour_voiture SET nom = :nom, places = :places, conducteur_id = :conducteur,
                       trajet = :trajet, remarques = :remarques WHERE id = :voiture""",
                parametres(sortieId, d).addValue("voiture", voitureId));
        jdbc.update("DELETE FROM sejour_voiture_passager WHERE voiture_id = :v", new MapSqlParameterSource("v", voitureId));
        ecrirePassagers(voitureId, passagers);
    }

    @Transactional
    public void supprimerVoiture(Long sortieId, Long voitureId) {
        voitureDe(sortieId, voitureId);
        jdbc.update("DELETE FROM sejour_voiture WHERE id = :v", new MapSqlParameterSource("v", voitureId));
    }

    /**
     * Les passagers retenus : sans doublon, et sans le conducteur, qui ne se compte pas deux fois.
     * Chacun n'est que dans une seule voiture du séjour, conducteur ou passager (choix du club,
     * 2026) : un conducteur ne peut pas être passager d'une autre voiture.
     */
    private List<Long> verifier(Long sortieId, Long voitureId, DemandeVoiture d) {
        if (d.places() < 1 || d.places() > 9) {
            throw new RegleMetierException("Une voiture compte de 1 à 9 places, conducteur compris.");
        }
        List<Long> passagers = d.passagerIds() == null ? List.of() : d.passagerIds().stream()
                .filter(Objects::nonNull).distinct().filter(p -> !p.equals(d.conducteurId())).toList();
        List<Long> tous = new ArrayList<>(passagers);
        if (d.conducteurId() != null) tous.add(d.conducteurId());
        verifierParticipants(sortieId, tous);
        if (!tous.isEmpty()) {
            MapSqlParameterSource p = new MapSqlParameterSource("sortie", sortieId).addValue("ids", tous)
                    .addValue("voiture", voitureId == null ? -1L : voitureId);
            List<String> dejaPris = jdbc.query("""
                    SELECT pa.prenom || ' ' || pa.nom AS qui, v.nom AS voiture, 'conducteur' AS role
                      FROM sejour_voiture v JOIN sejour_participant pa ON pa.id = v.conducteur_id
                     WHERE v.sortie_id = :sortie AND v.id <> :voiture AND v.conducteur_id IN (:ids)
                    UNION ALL
                    SELECT pa.prenom || ' ' || pa.nom, v.nom, 'passager'
                      FROM sejour_voiture_passager vp
                      JOIN sejour_voiture v ON v.id = vp.voiture_id
                      JOIN sejour_participant pa ON pa.id = vp.participant_id
                     WHERE v.sortie_id = :sortie AND v.id <> :voiture AND vp.participant_id IN (:ids)""",
                    p, (rs, i) -> rs.getString(1) + " est déjà " + rs.getString(3)
                            + " de la voiture « " + rs.getString(2) + " »");
            if (!dejaPris.isEmpty()) {
                throw new RegleMetierException(String.join(" ; ", dejaPris)
                        + ". Une personne ne peut être que dans une seule voiture : retirez-la d'abord de l'autre.");
            }
        }
        return passagers;
    }

    private static MapSqlParameterSource parametres(Long sortieId, DemandeVoiture d) {
        return new MapSqlParameterSource("sortie", sortieId).addValue("nom", d.nom().trim())
                .addValue("places", d.places()).addValue("conducteur", d.conducteurId())
                .addValue("trajet", nettoyer(d.trajet())).addValue("remarques", nettoyer(d.remarques()));
    }

    private void ecrirePassagers(Long voitureId, List<Long> passagers) {
        for (Long p : passagers) {
            jdbc.update("INSERT INTO sejour_voiture_passager (voiture_id, participant_id) VALUES (:v, :p)",
                    new MapSqlParameterSource("v", voitureId).addValue("p", p));
        }
    }

    private void voitureDe(Long sortieId, Long voitureId) {
        if (compter("SELECT COUNT(*) FROM sejour_voiture WHERE id = :x AND sortie_id = :sortie", voitureId,
                sortieId) == 0) {
            throw new RessourceIntrouvableException("Voiture introuvable");
        }
    }

    // ------------------------------------------------------------------
    //  Logements et chambres
    // ------------------------------------------------------------------

    @Transactional
    public void creerLogement(Long sortieId, DemandeLogement d) {
        sorties.sortie(sortieId);
        verifier(sortieId, null, d);
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("INSERT INTO sejour_logement (sortie_id, nom, adresse, remarques) VALUES (:sortie, :nom, :adresse, :remarques)",
                parametres(sortieId, d), cle, new String[]{"id"});
        ecrireChambres(cle.getKey().longValue(), d.chambres());
    }

    /** Les chambres sont remplacées d'un bloc, avec leurs occupants. */
    @Transactional
    public void modifierLogement(Long sortieId, Long logementId, DemandeLogement d) {
        logementDe(sortieId, logementId);
        verifier(sortieId, logementId, d);
        jdbc.update("UPDATE sejour_logement SET nom = :nom, adresse = :adresse, remarques = :remarques WHERE id = :logement",
                parametres(sortieId, d).addValue("logement", logementId));
        jdbc.update("DELETE FROM sejour_chambre WHERE logement_id = :l", new MapSqlParameterSource("l", logementId));
        ecrireChambres(logementId, d.chambres());
    }

    @Transactional
    public void supprimerLogement(Long sortieId, Long logementId) {
        logementDe(sortieId, logementId);
        jdbc.update("DELETE FROM sejour_logement WHERE id = :l", new MapSqlParameterSource("l", logementId));
    }

    /** Un participant dort dans une seule chambre de tout le séjour. */
    private void verifier(Long sortieId, Long logementId, DemandeLogement d) {
        List<DemandeChambre> chambres = d.chambres() == null ? List.of() : d.chambres();
        Map<Long, String> place = new HashMap<>();
        for (DemandeChambre c : chambres) {
            if (c.couchages() < 1 || c.couchages() > 30) {
                throw new RegleMetierException("Chambre « " + c.nom().trim() + " » : de 1 à 30 couchages.");
            }
            for (Long o : c.occupantIds() == null ? List.<Long>of() : c.occupantIds()) {
                String autre = place.put(o, c.nom().trim());
                if (autre != null && !autre.equals(c.nom().trim())) {
                    throw new RegleMetierException(nomDe(o) + " est placé dans deux chambres (« " + autre
                            + " » et « " + c.nom().trim() + " »).");
                }
            }
        }
        verifierParticipants(sortieId, new ArrayList<>(place.keySet()));
        if (place.isEmpty()) return;
        var p = new MapSqlParameterSource("sortie", sortieId).addValue("ids", place.keySet())
                .addValue("logement", logementId == null ? -1L : logementId);
        List<String> deja = jdbc.query("""
                SELECT p.prenom, p.nom, c.nom AS chambre, l.nom AS logement FROM sejour_chambre_occupant o
                  JOIN sejour_participant p ON p.id = o.participant_id
                  JOIN sejour_chambre c ON c.id = o.chambre_id
                  JOIN sejour_logement l ON l.id = c.logement_id
                 WHERE l.sortie_id = :sortie AND l.id <> :logement AND o.participant_id IN (:ids)""", p,
                (rs, i) -> rs.getString("prenom") + " " + rs.getString("nom") + " dort déjà dans la chambre « "
                        + rs.getString("chambre") + " » (" + rs.getString("logement") + ") : retirez-l'en d'abord.");
        if (!deja.isEmpty()) throw new RegleMetierException(deja.getFirst());
    }

    private static MapSqlParameterSource parametres(Long sortieId, DemandeLogement d) {
        return new MapSqlParameterSource("sortie", sortieId).addValue("nom", d.nom().trim())
                .addValue("adresse", nettoyer(d.adresse())).addValue("remarques", nettoyer(d.remarques()));
    }

    private void ecrireChambres(Long logementId, List<DemandeChambre> chambres) {
        if (chambres == null) return;
        int ordre = 0;
        for (DemandeChambre c : chambres) {
            KeyHolder cle = new GeneratedKeyHolder();
            jdbc.update("""
                    INSERT INTO sejour_chambre (logement_id, nom, couchages, remarques, ordre)
                    VALUES (:logement, :nom, :couchages, :remarques, :ordre)""",
                    new MapSqlParameterSource("logement", logementId).addValue("nom", c.nom().trim())
                            .addValue("couchages", c.couchages()).addValue("remarques", nettoyer(c.remarques()))
                            .addValue("ordre", ordre++), cle, new String[]{"id"});
            long chambreId = cle.getKey().longValue();
            for (Long o : c.occupantIds() == null ? List.<Long>of() : c.occupantIds().stream().distinct().toList()) {
                jdbc.update("INSERT INTO sejour_chambre_occupant (chambre_id, participant_id) VALUES (:c, :p)",
                        new MapSqlParameterSource("c", chambreId).addValue("p", o));
            }
        }
    }

    private void logementDe(Long sortieId, Long logementId) {
        if (compter("SELECT COUNT(*) FROM sejour_logement WHERE id = :x AND sortie_id = :sortie", logementId,
                sortieId) == 0) {
            throw new RessourceIntrouvableException("Logement introuvable");
        }
    }

    // ------------------------------------------------------------------
    //  Affaires à prévoir
    // ------------------------------------------------------------------

    /** La liste entière est remplacée, dans l'ordre donné. */
    @Transactional
    public void definirAffaires(Long sortieId, List<DemandeAffaire> affaires) {
        sorties.sortie(sortieId);
        if (affaires.size() > AFFAIRES_MAX) {
            throw new RegleMetierException("La liste des affaires est limitée à " + AFFAIRES_MAX + " lignes.");
        }
        var s = new MapSqlParameterSource("sortie", sortieId);
        jdbc.update("DELETE FROM sejour_affaire WHERE sortie_id = :sortie", s);
        int ordre = 0;
        for (DemandeAffaire a : affaires) {
            jdbc.update("""
                    INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
                    VALUES (:sortie, :categorie, :libelle, :indispensable, :ordre)""",
                    new MapSqlParameterSource("sortie", sortieId).addValue("categorie", a.categorie().name())
                            .addValue("libelle", a.libelle().trim()).addValue("indispensable", a.indispensable())
                            .addValue("ordre", ordre++));
        }
    }

    // ------------------------------------------------------------------
    //  Programme
    // ------------------------------------------------------------------

    @Transactional
    public void creerEvenement(Long sortieId, DemandeEvenement d) {
        verifier(sortieId, d);
        jdbc.update("""
                INSERT INTO sejour_evenement (sortie_id, jour, heure_debut, heure_fin, titre, lieu, details)
                VALUES (:sortie, :jour, :debut, :fin, :titre, :lieu, :details)""", parametres(sortieId, d));
    }

    @Transactional
    public void modifierEvenement(Long sortieId, Long evenementId, DemandeEvenement d) {
        evenementDe(sortieId, evenementId);
        verifier(sortieId, d);
        jdbc.update("""
                UPDATE sejour_evenement SET jour = :jour, heure_debut = :debut, heure_fin = :fin, titre = :titre,
                       lieu = :lieu, details = :details WHERE id = :evenement""",
                parametres(sortieId, d).addValue("evenement", evenementId));
    }

    @Transactional
    public void supprimerEvenement(Long sortieId, Long evenementId) {
        evenementDe(sortieId, evenementId);
        jdbc.update("DELETE FROM sejour_evenement WHERE id = :e", new MapSqlParameterSource("e", evenementId));
    }

    private void verifier(Long sortieId, DemandeEvenement d) {
        SortieVue s = sorties.lire(sortieId);
        if (d.jour().isBefore(s.dateDebut().minusDays(JOURS_AUTOUR_DU_PROGRAMME))
                || d.jour().isAfter(s.dateFin().plusDays(JOURS_AUTOUR_DU_PROGRAMME))) {
            throw new RegleMetierException("Le " + d.jour().format(Calendrier.DATE_FR)
                    + " est loin des dates de la sortie : vérifiez le jour.");
        }
        if (d.heureDebut() != null && d.heureFin() != null && d.heureFin().isBefore(d.heureDebut())) {
            throw new RegleMetierException("L'heure de fin est avant l'heure de début.");
        }
    }

    private static MapSqlParameterSource parametres(Long sortieId, DemandeEvenement d) {
        return new MapSqlParameterSource("sortie", sortieId).addValue("jour", d.jour())
                .addValue("debut", d.heureDebut()).addValue("fin", d.heureFin())
                .addValue("titre", d.titre().trim()).addValue("lieu", nettoyer(d.lieu()))
                .addValue("details", nettoyer(d.details()));
    }

    private void evenementDe(Long sortieId, Long evenementId) {
        if (compter("SELECT COUNT(*) FROM sejour_evenement WHERE id = :x AND sortie_id = :sortie", evenementId,
                sortieId) == 0) {
            throw new RessourceIntrouvableException("Rendez-vous introuvable");
        }
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    /** Chacun des participants donnés est bien inscrit à ce séjour. */
    private void verifierParticipants(Long sortieId, Collection<Long> ids) {
        if (ids.isEmpty()) return;
        Set<Long> distincts = new HashSet<>(ids);
        Integer trouves = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE sortie_id = :sortie AND id IN (:ids)",
                new MapSqlParameterSource("sortie", sortieId).addValue("ids", distincts), Integer.class);
        if (trouves == null || trouves != distincts.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
    }

    private String nomDe(Long participantId) {
        List<String> noms = jdbc.queryForList("SELECT prenom || ' ' || nom FROM sejour_participant WHERE id = :p",
                new MapSqlParameterSource("p", participantId), String.class);
        return noms.isEmpty() ? "Un participant" : noms.getFirst();
    }

    private int compter(String sql, Long x) {
        return jdbc.queryForObject(sql, new MapSqlParameterSource("x", x), Integer.class);
    }

    private int compter(String sql, Long x, Long sortieId) {
        return jdbc.queryForObject(sql, new MapSqlParameterSource("x", x).addValue("sortie", sortieId), Integer.class);
    }

    static boolean blanc(String texte) {
        return texte == null || texte.isBlank();
    }

    private static String nettoyer(String texte) {
        return blanc(texte) ? null : texte.trim();
    }
}
