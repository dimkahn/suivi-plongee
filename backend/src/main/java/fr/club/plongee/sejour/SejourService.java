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
 * Géré par un ADMIN ou le directeur technique, comme les sorties ; lu en
 * entier par les encadrants. Un participant qui a un compte (son dossier
 * élève ou son compte d'encadrant) lit le « carnet » : les mêmes données
 * sans les coordonnées, régimes et personnes à prévenir des autres.
 * <p>
 * Aucune donnée de santé (règle du club) : le régime alimentaire est une
 * liste de cases ({@link RegimeAlimentaire}) et une précision pour la
 * cuisine.
 * <p>
 * Les avertissements (voiture ou chambre trop pleine, participant sans
 * chambre...) sont calculés ici et ne bloquent jamais : l'organisateur
 * peut avoir ses raisons (une voiture à l'aller, une autre au retour).
 */
@Service
public class SejourService {

    /** Un rendez-vous du programme peut tomber un peu avant ou après la sortie (voyage). */
    static final int JOURS_AUTOUR_DU_PROGRAMME = 7;
    static final int AFFAIRES_MAX = 200;

    public record Trajet(LocalDate date, LocalTime heure, MoyenTransport transport,
                         @Size(max = 30) String numero, @Size(max = 120) String lieu) {
        boolean vide() {
            return date == null && heure == null && transport == null && blanc(numero) && blanc(lieu);
        }
    }

    /**
     * {@code moi} : ce participant est le compte connecté. Dans le carnet
     * d'un participant, coordonnées, régimes, personne à prévenir et
     * remarques des autres sont vides.
     */
    public record ParticipantVue(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                                 boolean plongeur, String telephone, String email,
                                 Set<RegimeAlimentaire> regimes, String regimePrecision,
                                 String urgenceNom, String urgenceTelephone,
                                 Trajet arrivee, Trajet depart, String remarques, boolean moi) {}

    public record DemandeParticipant(Long eleveId, Long utilisateurId,
                                     @NotBlank @Size(max = 120) String nom, @NotBlank @Size(max = 120) String prenom,
                                     boolean plongeur, @Size(max = 30) String telephone,
                                     @Size(max = 180) String email, Set<RegimeAlimentaire> regimes,
                                     @Size(max = 300) String regimePrecision,
                                     @Size(max = 120) String urgenceNom, @Size(max = 30) String urgenceTelephone,
                                     @Valid Trajet arrivee, @Valid Trajet depart, String remarques) {}

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

    /** Un groupe de plongeurs de la saison de la sortie, pour en inscrire tous les membres d'un coup. */
    public record GroupeProposeVue(Long id, String nom, int membres) {}

    /**
     * {@code gere} : le compte peut modifier le séjour ; {@code encadrant} :
     * il voit tout (sinon, c'est le carnet d'un participant).
     */
    public record SejourVue(SortieVue sortie, boolean gere, boolean encadrant, String infosPratiques,
                            List<ParticipantVue> participants, List<VoitureVue> voitures,
                            List<LogementVue> logements, List<AffaireVue> affaires,
                            List<EvenementVue> evenements, FraisService.FraisVue frais, List<String> avertissements,
                            List<GroupeProposeVue> groupesProposes) {}

    /** Une ligne de la liste des séjours. */
    public record SejourResumeVue(Long sortieId, String nom, String lieu, LocalDate dateDebut, LocalDate dateFin,
                                  int participants, boolean jeParticipe) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;
    private final FraisService frais;

    public SejourService(NamedParameterJdbcTemplate jdbc, SortieService sorties, FraisService frais) {
        this.jdbc = jdbc;
        this.sorties = sorties;
        this.frais = frais;
    }

    // ------------------------------------------------------------------
    //  Droits
    // ------------------------------------------------------------------

    static boolean encadrant(UtilisateurPrincipal p) {
        return aRole(p, "MONITEUR") || aRole(p, "ADMIN") || aRole(p, "DIRECTEUR_TECHNIQUE");
    }

    static boolean gere(UtilisateurPrincipal p) {
        return aRole(p, "ADMIN") || aRole(p, "DIRECTEUR_TECHNIQUE");
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
        boolean encadrant = encadrant(principal);
        SejourVue complet = vueComplete(sortieId, principal.id(), gere(principal), encadrant);
        complet = avecFrais(complet, frais.lire(sortieId, frais.acteur(sortieId, principal)));
        if (encadrant) return complet;
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
        List<ParticipantVue> participants = jdbc.query("""
                SELECT p.*, e.utilisateur_id AS compte_eleve
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :id""", id, (rs, i) -> participant(rs, moi));
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

        List<AffaireVue> affaires = jdbc.query(
                "SELECT * FROM sejour_affaire WHERE sortie_id = :id ORDER BY ordre, id", id,
                (rs, i) -> new AffaireVue(rs.getLong("id"), CategorieAffaire.valueOf(rs.getString("categorie")),
                        rs.getString("libelle"), rs.getBoolean("indispensable")));

        List<EvenementVue> evenements = jdbc.query(
                        "SELECT * FROM sejour_evenement WHERE sortie_id = :id", id,
                        (rs, i) -> new EvenementVue(rs.getLong("id"), rs.getObject("jour", LocalDate.class),
                                rs.getObject("heure_debut", LocalTime.class), rs.getObject("heure_fin", LocalTime.class),
                                rs.getString("titre"), rs.getString("lieu"), rs.getString("details")))
                .stream()
                .sorted(Comparator.comparing(EvenementVue::jour)
                        .thenComparing(e -> e.heureDebut() == null ? LocalTime.MIN : e.heureDebut())
                        .thenComparing(EvenementVue::id))
                .toList();

        List<GroupeProposeVue> groupes = !gere ? List.of() : jdbc.query("""
                SELECT g.id, g.nom, (SELECT COUNT(*) FROM membre_groupe_plongeurs m WHERE m.groupe_id = g.id) AS n
                  FROM groupe_plongeurs g JOIN saison s ON s.id = g.saison_id
                 WHERE :debut BETWEEN s.date_debut AND s.date_fin
                 ORDER BY g.nom""", new MapSqlParameterSource("debut", sortie.dateDebut()),
                (rs, i) -> new GroupeProposeVue(rs.getLong("id"), rs.getString("nom"), rs.getInt("n")));

        return new SejourVue(sortie, gere, encadrant, infos.isEmpty() ? null : infos.getFirst(), participants,
                voitures, logements, affaires, evenements, frais.lire(sortieId, FraisService.ActeurFrais.LECTURE),
                avertissements(participants, voitures, logements), groupes);
    }

    /** Le même séjour, avec les frais vus par celui qui agit (ce qu'il peut saisir, modifier). */
    private static SejourVue avecFrais(SejourVue s, FraisService.FraisVue f) {
        return new SejourVue(s.sortie(), s.gere(), s.encadrant(), s.infosPratiques(), s.participants(), s.voitures(),
                s.logements(), s.affaires(), s.evenements(), f, s.avertissements(), s.groupesProposes());
    }

    /** Le carnet d'un participant : ses propres données, et des autres seulement ce qui organise le séjour. */
    private static SejourVue carnet(SejourVue s) {
        List<ParticipantVue> participants = s.participants().stream()
                .map(p -> p.moi() ? p : new ParticipantVue(p.id(), null, null, p.nom(), p.prenom(), p.plongeur(),
                        null, null, Set.of(), null, null, null, p.arrivee(), p.depart(), null, false))
                .toList();
        return new SejourVue(s.sortie(), false, false, s.infosPratiques(), participants, s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.frais(), List.of(), List.of());
    }

    private static ParticipantVue participant(ResultSet rs, Long moi) throws SQLException {
        Long utilisateur = rs.getObject("utilisateur_id", Long.class);
        Long compteEleve = rs.getObject("compte_eleve", Long.class);
        boolean estMoi = moi != null && (moi.equals(utilisateur) || moi.equals(compteEleve));
        return new ParticipantVue(rs.getLong("id"), rs.getObject("eleve_id", Long.class), utilisateur,
                rs.getString("nom"), rs.getString("prenom"), rs.getBoolean("plongeur"),
                rs.getString("telephone"), rs.getString("email"), lireRegimes(rs.getString("regimes")),
                rs.getString("regime_precision"), rs.getString("urgence_nom"), rs.getString("urgence_telephone"),
                trajet(rs, "arrivee"), trajet(rs, "depart"), rs.getString("remarques"), estMoi);
    }

    private static Trajet trajet(ResultSet rs, String sens) throws SQLException {
        String transport = rs.getString(sens + "_transport");
        Trajet t = new Trajet(rs.getObject(sens + "_date", LocalDate.class), rs.getObject(sens + "_heure", LocalTime.class),
                transport == null ? null : MoyenTransport.valueOf(transport),
                rs.getString(sens + "_numero"), rs.getString(sens + "_lieu"));
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
                        + " ») : vérifiez que c'est voulu (aller et retour ?).");
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

    // ------------------------------------------------------------------
    //  Participants
    // ------------------------------------------------------------------

    @Transactional
    public void ajouterParticipant(Long sortieId, DemandeParticipant d) {
        sorties.sortie(sortieId);
        verifier(sortieId, null, d);
        inserer(sortieId, completerDuDossier(d));
    }

    @Transactional
    public void modifierParticipant(Long sortieId, Long participantId, DemandeParticipant d) {
        verifierParticipants(sortieId, List.of(participantId));
        verifier(sortieId, participantId, d);
        var p = parametres(sortieId, d).addValue("pid", participantId);
        jdbc.update("""
                UPDATE sejour_participant SET eleve_id = :eleve, utilisateur_id = :utilisateur, nom = :nom,
                       prenom = :prenom, plongeur = :plongeur, telephone = :telephone, email = :email,
                       regimes = :regimes, regime_precision = :regimePrecision, urgence_nom = :urgenceNom,
                       urgence_telephone = :urgenceTelephone,
                       arrivee_date = :arriveeDate, arrivee_heure = :arriveeHeure,
                       arrivee_transport = :arriveeTransport, arrivee_numero = :arriveeNumero,
                       arrivee_lieu = :arriveeLieu,
                       depart_date = :departDate, depart_heure = :departHeure,
                       depart_transport = :departTransport, depart_numero = :departNumero,
                       depart_lieu = :departLieu, remarques = :remarques
                 WHERE id = :pid""", p);
    }

    /** Sa propre ligne, entière (il la voit et la complète lui-même). */
    @Transactional(readOnly = true)
    public ParticipantVue participant(Long participantId) {
        List<ParticipantVue> lignes = jdbc.query("""
                SELECT p.*, e.utilisateur_id AS compte_eleve
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.id = :pid""", new MapSqlParameterSource("pid", participantId), (rs, i) -> participant(rs, null));
        if (lignes.isEmpty()) throw new RessourceIntrouvableException("Participant introuvable");
        ParticipantVue p = lignes.getFirst();
        return new ParticipantVue(p.id(), p.eleveId(), p.utilisateurId(), p.nom(), p.prenom(), p.plongeur(),
                p.telephone(), p.email(), p.regimes(), p.regimePrecision(), p.urgenceNom(), p.urgenceTelephone(),
                p.arrivee(), p.depart(), p.remarques(), true);
    }

    /** Le participant complète ses informations : le reste de sa ligne ne change pas. */
    @Transactional
    public void modifierMesInformations(Long participantId, DemandeMesInformations d) {
        ParticipantVue actuel = participant(participantId);
        LocalDateTime arrivee = moment(d.arrivee());
        LocalDateTime depart = moment(d.depart());
        if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
            throw new RegleMetierException("Votre départ est avant votre arrivée : vérifiez les dates.");
        }
        var p = parametres(null, new DemandeParticipant(actuel.eleveId(), actuel.utilisateurId(), actuel.nom(),
                actuel.prenom(), actuel.plongeur(), d.telephone(), actuel.email(), d.regimes(), d.regimePrecision(),
                d.urgenceNom(), d.urgenceTelephone(), d.arrivee(), d.depart(), d.remarques()))
                .addValue("pid", participantId);
        jdbc.update("""
                UPDATE sejour_participant SET telephone = :telephone, regimes = :regimes,
                       regime_precision = :regimePrecision, urgence_nom = :urgenceNom,
                       urgence_telephone = :urgenceTelephone,
                       arrivee_date = :arriveeDate, arrivee_heure = :arriveeHeure,
                       arrivee_transport = :arriveeTransport, arrivee_numero = :arriveeNumero,
                       arrivee_lieu = :arriveeLieu,
                       depart_date = :departDate, depart_heure = :departHeure,
                       depart_transport = :departTransport, depart_numero = :departNumero,
                       depart_lieu = :departLieu, remarques = :remarques
                 WHERE id = :pid""", p);
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

    /** Inscrit les membres d'un groupe de plongeurs qui ne sont pas déjà du séjour ; renvoie leur nombre. */
    @Transactional
    public int importerGroupe(Long sortieId, Long groupeId) {
        sorties.sortie(sortieId);
        var g = new MapSqlParameterSource("groupe", groupeId);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM groupe_plongeurs WHERE id = :groupe", g, Integer.class) == 0) {
            throw new RessourceIntrouvableException("Groupe de plongeurs introuvable");
        }
        List<DemandeParticipant> membres = jdbc.query("""
                SELECT eleve_id, utilisateur_id, nom, prenom, email FROM membre_groupe_plongeurs
                 WHERE groupe_id = :groupe ORDER BY id""", g,
                (rs, i) -> new DemandeParticipant(rs.getObject("eleve_id", Long.class),
                        rs.getObject("utilisateur_id", Long.class), rs.getString("nom"), rs.getString("prenom"),
                        true, null, rs.getString("email"), Set.of(), null, null, null, null, null, null));
        int ajoutes = 0;
        for (DemandeParticipant m : membres) {
            if (doublon(sortieId, null, m) != null) continue;
            inserer(sortieId, completerDuDossier(m));
            ajoutes++;
        }
        return ajoutes;
    }

    private void verifier(Long sortieId, Long participantId, DemandeParticipant d) {
        String deja = doublon(sortieId, participantId, d);
        if (deja != null) {
            throw new RegleMetierException("« " + deja + " » participe déjà au séjour.");
        }
        if (d.eleveId() != null && compter("SELECT COUNT(*) FROM eleve WHERE id = :x", d.eleveId()) == 0) {
            throw new RessourceIntrouvableException("Élève introuvable");
        }
        if (d.utilisateurId() != null
                && compter("SELECT COUNT(*) FROM utilisateur WHERE id = :x", d.utilisateurId()) == 0) {
            throw new RessourceIntrouvableException("Compte introuvable");
        }
        LocalDateTime arrivee = moment(d.arrivee());
        LocalDateTime depart = moment(d.depart());
        if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
            throw new RegleMetierException("Le départ de " + d.prenom().trim() + " " + d.nom().trim()
                    + " est avant son arrivée : vérifiez les dates.");
        }
    }

    /** Le nom de celui qui est déjà inscrit : même dossier, même compte, ou mêmes nom et prénom. */
    private String doublon(Long sortieId, Long participantId, DemandeParticipant d) {
        var p = new MapSqlParameterSource("id", sortieId).addValue("pid", participantId == null ? -1L : participantId)
                .addValue("eleve", d.eleveId()).addValue("utilisateur", d.utilisateurId())
                .addValue("nom", d.nom().trim().toLowerCase(Locale.ROOT))
                .addValue("prenom", d.prenom().trim().toLowerCase(Locale.ROOT));
        // Conditions écrites seulement pour un lien donné : Postgres ne sait pas typer « :x IS NULL ».
        String memeDossier = (d.eleveId() == null ? "" : " OR eleve_id = :eleve")
                + (d.utilisateurId() == null ? "" : " OR utilisateur_id = :utilisateur");
        List<String> noms = jdbc.queryForList("""
                SELECT prenom || ' ' || nom FROM sejour_participant
                 WHERE sortie_id = :id AND id <> :pid
                   AND ((LOWER(nom) = :nom AND LOWER(prenom) = :prenom)""" + memeDossier + ")", p, String.class);
        return noms.isEmpty() ? null : noms.getFirst();
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
                d.remarques());
    }

    private void inserer(Long sortieId, DemandeParticipant d) {
        jdbc.update("""
                INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur,
                       telephone, email, regimes, regime_precision, urgence_nom, urgence_telephone,
                       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
                       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu, remarques)
                VALUES (:sortie, :eleve, :utilisateur, :nom, :prenom, :plongeur, :telephone, :email, :regimes,
                       :regimePrecision, :urgenceNom, :urgenceTelephone,
                       :arriveeDate, :arriveeHeure, :arriveeTransport, :arriveeNumero, :arriveeLieu,
                       :departDate, :departHeure, :departTransport, :departNumero, :departLieu, :remarques)""",
                parametres(sortieId, d));
    }

    private static MapSqlParameterSource parametres(Long sortieId, DemandeParticipant d) {
        var p = new MapSqlParameterSource("sortie", sortieId)
                .addValue("eleve", d.eleveId()).addValue("utilisateur", d.utilisateurId())
                .addValue("nom", d.nom().trim()).addValue("prenom", d.prenom().trim())
                .addValue("plongeur", d.plongeur())
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
                .addValue(sens + "Lieu", t == null ? null : nettoyer(t.lieu()));
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
        List<Long> passagers = verifier(sortieId, d);
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
        List<Long> passagers = verifier(sortieId, d);
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

    /** Les passagers retenus : sans doublon, et sans le conducteur, qui ne se compte pas deux fois. */
    private List<Long> verifier(Long sortieId, DemandeVoiture d) {
        if (d.places() < 1 || d.places() > 9) {
            throw new RegleMetierException("Une voiture compte de 1 à 9 places, conducteur compris.");
        }
        List<Long> passagers = d.passagerIds() == null ? List.of() : d.passagerIds().stream()
                .filter(Objects::nonNull).distinct().filter(p -> !p.equals(d.conducteurId())).toList();
        List<Long> tous = new ArrayList<>(passagers);
        if (d.conducteurId() != null) tous.add(d.conducteurId());
        verifierParticipants(sortieId, tous);
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
