package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.sejour.domaine.port.AccesParLien;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Colonne {@code sejour.code_frais}, tables {@code sejour_code_acces} et {@code sejour_jeton_acces} (V77). */
@Repository
class AccesParLienJdbc implements AccesParLien {

    /** Ces comptes sont dans l'appli : ils n'entrent pas par le lien. */
    private static final String EST_ENCADRANT = """
            EXISTS (SELECT 1 FROM utilisateur_role r
                     WHERE r.role IN ('MONITEUR', 'ADMIN', 'DIRECTEUR_TECHNIQUE')
                       AND (r.utilisateur_id = p.utilisateur_id OR r.utilisateur_id = e.utilisateur_id))""";

    private final NamedParameterJdbcTemplate jdbc;

    AccesParLienJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean sortieExiste(Long sortieId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sortie WHERE id = :sortie",
                new MapSqlParameterSource("sortie", sortieId), Integer.class) > 0;
    }

    @Override
    public Optional<String> codeFrais(Long sortieId) {
        return jdbc.queryForList("SELECT code_frais FROM sejour WHERE sortie_id = :sortie",
                new MapSqlParameterSource("sortie", sortieId), String.class).stream()
                .filter(Objects::nonNull).findFirst();
    }

    @Override
    public void poserCodeFrais(Long sortieId, String code) {
        var s = new MapSqlParameterSource("sortie", sortieId).addValue("code", code);
        if (jdbc.update("UPDATE sejour SET code_frais = :code WHERE sortie_id = :sortie", s) == 0) {
            jdbc.update("INSERT INTO sejour (sortie_id, code_frais) VALUES (:sortie, :code)", s);
        }
    }

    @Override
    public Optional<Entete> entete(String code) {
        return jdbc.query("""
                SELECT so.nom, so.lieu, so.date_debut, so.date_fin FROM sejour s JOIN sortie so ON so.id = s.sortie_id
                 WHERE s.code_frais = :code""", new MapSqlParameterSource("code", code),
                (rs, i) -> new Entete(rs.getString(1), rs.getString(2), rs.getObject(3, LocalDate.class),
                        rs.getObject(4, LocalDate.class))).stream().findFirst();
    }

    @Override
    public List<Destinataire> destinataires(Long sortieId, Collection<Long> choisis) {
        var p = new MapSqlParameterSource("sortie", sortieId).addValue("pids", choisis);
        return jdbc.query("""
                SELECT p.id, p.prenom, p.nom, p.email, CASE WHEN %s THEN 1 ELSE 0 END AS encadrant
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie""".formatted(EST_ENCADRANT)
                + (choisis == null ? "" : " AND p.id IN (:pids)") + " ORDER BY p.nom, p.prenom", p,
                (rs, i) -> new Destinataire(rs.getLong("id"), rs.getString("prenom"), rs.getString("nom"),
                        rs.getString("email"), rs.getInt("encadrant") == 1));
    }

    @Override
    public Optional<Long> participantPourLien(String code, String emailMinuscule) {
        return jdbc.queryForList("""
                SELECT p.id FROM sejour_participant p
                  JOIN sejour s ON s.sortie_id = p.sortie_id
                  LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE s.code_frais = :code AND LOWER(p.email) = :email AND NOT %s
                 ORDER BY p.id""".formatted(EST_ENCADRANT),
                new MapSqlParameterSource("code", code).addValue("email", emailMinuscule), Long.class)
                .stream().findFirst();
    }

    @Override
    public boolean codeEnvoyeDepuis(Long participantId, LocalDateTime depuis) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sejour_code_acces WHERE participant_id = :p AND cree_le > :depuis",
                new MapSqlParameterSource("p", participantId).addValue("depuis", depuis), Integer.class) > 0;
    }

    @Override
    public void remplacerCode(Long participantId, String empreinte, LocalDateTime expire, LocalDateTime maintenant) {
        var p = new MapSqlParameterSource("p", participantId);
        jdbc.update("DELETE FROM sejour_code_acces WHERE participant_id = :p", p);
        jdbc.update("""
                INSERT INTO sejour_code_acces (participant_id, empreinte, expire_le, cree_le)
                VALUES (:p, :empreinte, :expire, :maintenant)""",
                p.addValue("empreinte", empreinte).addValue("expire", expire).addValue("maintenant", maintenant));
    }

    @Override
    public List<CodeEnBase> codes(Long participantId) {
        return jdbc.query("""
                SELECT id, empreinte, expire_le, essais FROM sejour_code_acces WHERE participant_id = :p
                 ORDER BY id DESC""", new MapSqlParameterSource("p", participantId),
                (rs, i) -> new CodeEnBase(rs.getLong(1), rs.getString(2), rs.getObject(3, LocalDateTime.class),
                        rs.getInt(4)));
    }

    @Override
    public void compterEssai(long codeId) {
        jdbc.update("UPDATE sejour_code_acces SET essais = essais + 1 WHERE id = :id",
                new MapSqlParameterSource("id", codeId));
    }

    @Override
    public void effacerCodes(Long participantId) {
        jdbc.update("DELETE FROM sejour_code_acces WHERE participant_id = :p", new MapSqlParameterSource("p", participantId));
    }

    @Override
    public void creerJeton(Long participantId, String empreinte, LocalDateTime expire, LocalDateTime maintenant) {
        jdbc.update("""
                INSERT INTO sejour_jeton_acces (participant_id, empreinte, expire_le, cree_le)
                VALUES (:p, :empreinte, :expire, :maintenant)""",
                new MapSqlParameterSource("p", participantId).addValue("empreinte", empreinte)
                        .addValue("expire", expire).addValue("maintenant", maintenant));
    }

    @Override
    public void effacerJeton(String empreinte) {
        jdbc.update("DELETE FROM sejour_jeton_acces WHERE empreinte = :e", new MapSqlParameterSource("e", empreinte));
    }

    @Override
    public Optional<Acces> acces(String code, String empreinteJeton, LocalDateTime maintenant) {
        return jdbc.query("""
                SELECT p.sortie_id, p.id FROM sejour_jeton_acces j
                  JOIN sejour_participant p ON p.id = j.participant_id
                  JOIN sejour s ON s.sortie_id = p.sortie_id
                 WHERE j.empreinte = :e AND s.code_frais = :code AND j.expire_le > :maintenant""",
                new MapSqlParameterSource("e", empreinteJeton).addValue("code", code)
                        .addValue("maintenant", maintenant),
                (rs, i) -> new Acces(rs.getLong(1), rs.getLong(2))).stream().findFirst();
    }

    @Override
    public List<ParticipantCourt> participantsCourts(Long sortieId) {
        return jdbc.query("""
                SELECT id, prenom, nom FROM sejour_participant WHERE sortie_id = :s ORDER BY LOWER(nom), LOWER(prenom)""",
                new MapSqlParameterSource("s", sortieId),
                (rs, i) -> new ParticipantCourt(rs.getLong(1), rs.getString(2), rs.getString(3)));
    }

    @Override
    public String email(Long participantId) {
        return jdbc.queryForObject("SELECT email FROM sejour_participant WHERE id = :p",
                new MapSqlParameterSource("p", participantId), String.class);
    }
}
