package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.sejour.domaine.IdentitePlongeur;
import fr.club.plongee.sejour.domaine.port.PalanqueesSortie;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
import java.util.List;

/** Tables {@code palanquee}, {@code membre_palanquee}, {@code fiche_securite} des séances de la sortie. */
@Repository
class PalanqueesSortieJdbc implements PalanqueesSortie {

    private final NamedParameterJdbcTemplate jdbc;

    PalanqueesSortieJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Palanquee> palanquees(Long sortieId) {
        return jdbc.query("""
                SELECT pa.*, f.seance_id, u.prenom AS dp_prenom, u.nom AS dp_nom
                  FROM palanquee pa
                  JOIN fiche_securite f ON f.id = pa.fiche_securite_id
                  JOIN sortie_seance ss ON ss.seance_id = f.seance_id
                  JOIN seance s ON s.id = f.seance_id
                  LEFT JOIN utilisateur u ON u.id = f.dp_id
                 WHERE ss.sortie_id = :id
                 ORDER BY s.date_seance, COALESCE(s.ordre, 0), s.id, pa.numero""",
                new MapSqlParameterSource("id", sortieId), (rs, i) -> new Palanquee(rs.getLong("id"),
                        rs.getLong("seance_id"), rs.getInt("numero"),
                        rs.getString("dp_nom") == null ? null : rs.getString("dp_prenom") + " " + rs.getString("dp_nom"),
                        rs.getObject("profondeur_prevue", Integer.class), rs.getObject("duree_prevue", Integer.class),
                        rs.getObject("profondeur_realisee", Integer.class), rs.getObject("duree_realisee", Integer.class),
                        rs.getObject("heure_immersion", LocalTime.class)));
    }

    @Override
    public List<MembrePalanquee> membres(Long sortieId) {
        return jdbc.query("""
                SELECT m.palanquee_id, m.eleve_id, m.utilisateur_id, e.utilisateur_id AS compte_eleve,
                       m.nom, m.prenom, m.aptitude, m.qualification_preparee, m.fonction
                  FROM membre_palanquee m
                  JOIN palanquee pa ON pa.id = m.palanquee_id
                  JOIN fiche_securite f ON f.id = pa.fiche_securite_id
                  JOIN sortie_seance ss ON ss.seance_id = f.seance_id
                  LEFT JOIN eleve e ON e.id = m.eleve_id
                 WHERE ss.sortie_id = :id
                 ORDER BY m.id""", new MapSqlParameterSource("id", sortieId), (rs, i) -> {
            Long utilisateur = rs.getObject("utilisateur_id", Long.class);
            Long compte = utilisateur != null ? utilisateur : rs.getObject("compte_eleve", Long.class);
            return new MembrePalanquee(rs.getLong("palanquee_id"),
                    new IdentitePlongeur(rs.getObject("eleve_id", Long.class), compte, rs.getString("nom"),
                            rs.getString("prenom")),
                    FonctionPalanquee.valueOf(rs.getString("fonction")), rs.getString("aptitude"),
                    rs.getString("qualification_preparee"));
        });
    }
}
