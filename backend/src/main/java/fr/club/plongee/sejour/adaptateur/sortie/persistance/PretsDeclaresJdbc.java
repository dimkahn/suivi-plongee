package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.sejour.domaine.port.PretsDeclares;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Table {@code sejour_pret} (V84). */
@Repository
class PretsDeclaresJdbc implements PretsDeclares {

    private final NamedParameterJdbcTemplate jdbc;

    PretsDeclaresJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<PretDeclare> duSejour(Long sortieId) {
        return jdbc.query("""
                SELECT sp.pret_id, sp.participant_id, sp.declare_par_utilisateur_id, sp.declare_par_participant_id
                  FROM sejour_pret sp JOIN pret p ON p.id = sp.pret_id
                 WHERE p.sortie_id = :sortie""", new MapSqlParameterSource("sortie", sortieId),
                (rs, i) -> new PretDeclare(rs.getLong(1), rs.getObject(2, Long.class), rs.getObject(3, Long.class),
                        rs.getObject(4, Long.class)));
    }

    @Override
    public void noter(PretDeclare d) {
        jdbc.update("""
                INSERT INTO sejour_pret (pret_id, participant_id, declare_par_utilisateur_id, declare_par_participant_id)
                VALUES (:pret, :participant, :parUtilisateur, :parParticipant)""",
                new MapSqlParameterSource("pret", d.pretId()).addValue("participant", d.participantId())
                        .addValue("parUtilisateur", d.parUtilisateurId())
                        .addValue("parParticipant", d.parParticipantId()));
    }
}
