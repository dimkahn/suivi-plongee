package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.sejour.domaine.FicheParticipant;
import fr.club.plongee.sejour.domaine.MoyenTransport;
import fr.club.plongee.sejour.domaine.Participant;
import fr.club.plongee.sejour.domaine.RegimeAlimentaire;
import fr.club.plongee.sejour.domaine.SensTrajet;
import fr.club.plongee.sejour.domaine.Trajet;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

import static fr.club.plongee.sejour.domaine.Textes.blanc;
import static fr.club.plongee.sejour.domaine.Textes.nettoyer;

/** Table {@code sejour_participant} (V75, V78, V79), et les dossiers et groupes qu'on y relie. */
@Repository
class ParticipantsSejourJdbc implements ParticipantsSejour {

    private static final String SELECT_PARTICIPANT = """
            SELECT p.*, e.utilisateur_id AS compte_eleve, g.nom AS nom_groupe
              FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
              LEFT JOIN membre_groupe_plongeurs m ON m.id = p.membre_groupe_id
              LEFT JOIN groupe_plongeurs g ON g.id = m.groupe_id""";

    private static final String COLONNES_INFORMATIONS = """
            telephone = :telephone, regimes = :regimes,
                   regime_precision = :regimePrecision, urgence_nom = :urgenceNom,
                   urgence_telephone = :urgenceTelephone,
                   arrivee_date = :arriveeDate, arrivee_heure = :arriveeHeure,
                   arrivee_transport = :arriveeTransport, arrivee_numero = :arriveeNumero,
                   arrivee_lieu = :arriveeLieu, arrivee_heure_depart = :arriveeHeureDepart,
                   arrivee_lieu_depart = :arriveeLieuDepart,
                   depart_date = :departDate, depart_heure = :departHeure,
                   depart_transport = :departTransport, depart_numero = :departNumero,
                   depart_lieu = :departLieu, remarques = :remarques""";

    private final NamedParameterJdbcTemplate jdbc;

    ParticipantsSejourJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Participant> participants(Long sortieId) {
        return jdbc.query(SELECT_PARTICIPANT + " WHERE p.sortie_id = :id", new MapSqlParameterSource("id", sortieId),
                (rs, i) -> participant(rs));
    }

    @Override
    public Optional<Participant> participant(Long participantId) {
        return jdbc.query(SELECT_PARTICIPANT + " WHERE p.id = :pid", new MapSqlParameterSource("pid", participantId),
                (rs, i) -> participant(rs)).stream().findFirst();
    }

    @Override
    public Optional<Participant> participantDuCompte(Long sortieId, Long utilisateurId) {
        return jdbc.query(SELECT_PARTICIPANT
                        + " WHERE p.sortie_id = :sortie AND (p.utilisateur_id = :moi OR e.utilisateur_id = :moi) ORDER BY p.id",
                new MapSqlParameterSource("sortie", sortieId).addValue("moi", utilisateurId),
                (rs, i) -> participant(rs)).stream().findFirst();
    }

    @Override
    public int compterDuSejour(Long sortieId, Collection<Long> participantIds) {
        if (participantIds.isEmpty()) return 0;
        Integer trouves = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE sortie_id = :sortie AND id IN (:ids)",
                new MapSqlParameterSource("sortie", sortieId).addValue("ids", participantIds), Integer.class);
        return trouves == null ? 0 : trouves;
    }

    @Override
    public void ajouter(Long sortieId, FicheParticipant d) {
        jdbc.update("""
                INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur,
                       membre_groupe_id, telephone, email, regimes, regime_precision, urgence_nom, urgence_telephone,
                       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
                       arrivee_heure_depart, arrivee_lieu_depart,
                       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu, remarques)
                VALUES (:sortie, :eleve, :utilisateur, :nom, :prenom, :plongeur, :membreGroupe, :telephone, :email, :regimes,
                       :regimePrecision, :urgenceNom, :urgenceTelephone,
                       :arriveeDate, :arriveeHeure, :arriveeTransport, :arriveeNumero, :arriveeLieu,
                       :arriveeHeureDepart, :arriveeLieuDepart,
                       :departDate, :departHeure, :departTransport, :departNumero, :departLieu, :remarques)""",
                parametres(d).addValue("sortie", sortieId));
    }

    @Override
    public void modifier(Long participantId, FicheParticipant d) {
        jdbc.update("""
                UPDATE sejour_participant SET eleve_id = :eleve, utilisateur_id = :utilisateur, nom = :nom,
                       prenom = :prenom, plongeur = :plongeur, membre_groupe_id = :membreGroupe,
                       email = :email, %s
                 WHERE id = :pid""".formatted(COLONNES_INFORMATIONS), parametres(d).addValue("pid", participantId));
    }

    @Override
    public void modifierInformations(Long participantId, FicheParticipant d) {
        jdbc.update("UPDATE sejour_participant SET %s WHERE id = :pid".formatted(COLONNES_INFORMATIONS),
                parametres(d).addValue("pid", participantId));
    }

    @Override
    public void poserTrajet(Long sortieId, Collection<Long> participantIds, SensTrajet sensTrajet, Trajet t) {
        String sens = sensTrajet == SensTrajet.ARRIVEE ? "arrivee" : "depart";
        var p = new MapSqlParameterSource("ids", participantIds).addValue("sortie", sortieId);
        trajet(p, "t", t);
        String departAller = sensTrajet == SensTrajet.ARRIVEE
                ? ", arrivee_heure_depart = :tHeureDepart, arrivee_lieu_depart = :tLieuDepart" : "";
        jdbc.update("""
                UPDATE sejour_participant SET %1$s_date = :tDate, %1$s_heure = :tHeure, %1$s_transport = :tTransport,
                       %1$s_numero = :tNumero, %1$s_lieu = :tLieu%2$s
                 WHERE sortie_id = :sortie AND id IN (:ids)""".formatted(sens, departAller), p);
    }

    @Override
    public void supprimer(Long participantId) {
        jdbc.update("DELETE FROM sejour_participant WHERE id = :pid", new MapSqlParameterSource("pid", participantId));
    }

    @Override
    public int lignesDeFrais(Long participantId) {
        return compter("""
                SELECT (SELECT COUNT(*) FROM sejour_depense WHERE payeur_id = :x)
                     + (SELECT COUNT(*) FROM sejour_depense_part WHERE participant_id = :x)
                     + (SELECT COUNT(*) FROM sejour_versement WHERE de_id = :x OR a_id = :x)""", participantId);
    }

    @Override
    public Optional<Inscrit> doublon(Long sortieId, Long exclu, Long eleveId, Long utilisateurId, String nom,
                                     String prenom) {
        var p = new MapSqlParameterSource("id", sortieId).addValue("pid", exclu == null ? -1L : exclu)
                .addValue("eleve", eleveId).addValue("utilisateur", utilisateurId)
                .addValue("nom", nom.trim().toLowerCase(Locale.ROOT))
                .addValue("prenom", prenom.trim().toLowerCase(Locale.ROOT));
        // Conditions écrites seulement pour un lien donné : Postgres ne sait pas typer « :x IS NULL ».
        String memeDossier = (eleveId == null ? "" : " OR eleve_id = :eleve")
                + (utilisateurId == null ? "" : " OR utilisateur_id = :utilisateur");
        return jdbc.query("""
                SELECT id, prenom || ' ' || nom FROM sejour_participant
                 WHERE sortie_id = :id AND id <> :pid
                   AND ((LOWER(nom) = :nom AND LOWER(prenom) = :prenom)""" + memeDossier + ") ORDER BY id", p,
                (rs, i) -> new Inscrit(rs.getLong(1), rs.getString(2))).stream().findFirst();
    }

    @Override
    public boolean eleveExiste(Long eleveId) {
        return compter("SELECT COUNT(*) FROM eleve WHERE id = :x", eleveId) > 0;
    }

    @Override
    public boolean compteExiste(Long utilisateurId) {
        return compter("SELECT COUNT(*) FROM utilisateur WHERE id = :x", utilisateurId) > 0;
    }

    @Override
    public Optional<DossierEleve> dossierEleve(Long eleveId) {
        return jdbc.query("""
                SELECT email, telephone, contact_urgence_nom, contact_urgence_telephone
                  FROM eleve WHERE id = :x""", new MapSqlParameterSource("x", eleveId),
                (rs, i) -> new DossierEleve(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)))
                .stream().findFirst();
    }

    @Override
    public String emailDuCompte(Long utilisateurId) {
        return jdbc.queryForObject("SELECT email FROM utilisateur WHERE id = :x",
                new MapSqlParameterSource("x", utilisateurId), String.class);
    }

    @Override
    public boolean groupeExiste(Long groupeId) {
        return compter("SELECT COUNT(*) FROM groupe_plongeurs WHERE id = :x", groupeId) > 0;
    }

    @Override
    public List<FicheParticipant> membresDuGroupe(Long groupeId) {
        return jdbc.query("""
                SELECT id, eleve_id, utilisateur_id, nom, prenom, email FROM membre_groupe_plongeurs
                 WHERE groupe_id = :groupe ORDER BY id""", new MapSqlParameterSource("groupe", groupeId),
                (rs, i) -> new FicheParticipant(rs.getObject("eleve_id", Long.class),
                        rs.getObject("utilisateur_id", Long.class), rs.getString("nom"), rs.getString("prenom"),
                        true, null, rs.getString("email"), Set.of(), null, null, null, null, null, null,
                        rs.getLong("id")));
    }

    @Override
    public boolean membreInscrit(Long sortieId, Long membreId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE sortie_id = :sortie AND membre_groupe_id = :x",
                new MapSqlParameterSource("x", membreId).addValue("sortie", sortieId), Integer.class) > 0;
    }

    @Override
    public void lierAuMembre(Long participantId, Long membreId) {
        jdbc.update("""
                UPDATE sejour_participant SET membre_groupe_id = :membre, plongeur = TRUE
                 WHERE id = :pid AND membre_groupe_id IS NULL""",
                new MapSqlParameterSource("membre", membreId).addValue("pid", participantId));
    }

    @Override
    public boolean membreDeLaSaison(Long membreId, LocalDate jour) {
        Integer trouve = jdbc.queryForObject("""
                SELECT COUNT(*) FROM membre_groupe_plongeurs m
                  JOIN groupe_plongeurs g ON g.id = m.groupe_id JOIN saison s ON s.id = g.saison_id
                 WHERE m.id = :membre AND :debut BETWEEN s.date_debut AND s.date_fin""",
                new MapSqlParameterSource("membre", membreId).addValue("debut", jour), Integer.class);
        return trouve != null && trouve > 0;
    }

    @Override
    public List<String> autresLiesAuMembre(Long sortieId, Long membreId, Long exclu) {
        return jdbc.queryForList("""
                SELECT prenom || ' ' || nom FROM sejour_participant
                 WHERE sortie_id = :sortie AND membre_groupe_id = :membre AND id <> :pid""",
                new MapSqlParameterSource("membre", membreId).addValue("sortie", sortieId)
                        .addValue("pid", exclu == null ? -1L : exclu), String.class);
    }

    @Override
    public Optional<EmailsMembre> emailsDuMembre(Long membreId) {
        return jdbc.query("""
                SELECT m.email, COALESCE(e.email, u.email) AS email_dossier FROM membre_groupe_plongeurs m
                  LEFT JOIN eleve e ON e.id = m.eleve_id LEFT JOIN utilisateur u ON u.id = m.utilisateur_id
                 WHERE m.id = :membre""", new MapSqlParameterSource("membre", membreId),
                (rs, i) -> new EmailsMembre(rs.getString(1), rs.getString(2))).stream().findFirst();
    }

    @Override
    public void reporterSurLeMembre(Long membreId, String nom, String prenom, String email) {
        jdbc.update("UPDATE membre_groupe_plongeurs SET nom = :nom, prenom = :prenom, email = :email WHERE id = :membre",
                new MapSqlParameterSource("membre", membreId).addValue("nom", nom).addValue("prenom", prenom)
                        .addValue("email", email, Types.VARCHAR));
    }

    // ------------------------------------------------------------------

    private static Participant participant(ResultSet rs) throws SQLException {
        return new Participant(rs.getLong("id"), rs.getObject("eleve_id", Long.class),
                rs.getObject("utilisateur_id", Long.class), rs.getObject("compte_eleve", Long.class),
                rs.getString("nom"), rs.getString("prenom"), rs.getBoolean("plongeur"),
                rs.getString("telephone"), rs.getString("email"), lireRegimes(rs.getString("regimes")),
                rs.getString("regime_precision"), rs.getString("urgence_nom"), rs.getString("urgence_telephone"),
                trajet(rs, "arrivee"), trajet(rs, "depart"), rs.getString("remarques"),
                rs.getObject("membre_groupe_id", Long.class), rs.getString("nom_groupe"));
    }

    private static Trajet trajet(ResultSet rs, String sens) throws SQLException {
        String transport = rs.getString(sens + "_transport");
        boolean aller = sens.equals("arrivee");
        Trajet t = new Trajet(rs.getObject(sens + "_date", LocalDate.class), rs.getObject(sens + "_heure", LocalTime.class),
                transport == null ? null : MoyenTransport.valueOf(transport),
                rs.getString(sens + "_numero"), rs.getString(sens + "_lieu"),
                aller ? rs.getObject("arrivee_heure_depart", LocalTime.class) : null,
                aller ? rs.getString("arrivee_lieu_depart") : null);
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

    private static MapSqlParameterSource parametres(FicheParticipant d) {
        var p = new MapSqlParameterSource("eleve", d.eleveId()).addValue("utilisateur", d.utilisateurId())
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
                .addValue(sens + "LieuDepart", t == null ? null : nettoyer(t.lieuDepart()));
    }

    private int compter(String sql, Long x) {
        return jdbc.queryForObject(sql, new MapSqlParameterSource("x", x), Integer.class);
    }
}
