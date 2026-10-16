package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Inscription au club à jour, saison par saison (table {@code inscription_club},
 * V86) : une ligne = OK, pas de ligne = KO. Noter deux fois ne change rien.
 */
@Service
public class InscriptionClubService {

    public record InscriptionClubVue(Long eleveId, Long saisonId, LocalDateTime inscritLe, String saisiPar) {}

    private final NamedParameterJdbcTemplate jdbc;

    public InscriptionClubService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<InscriptionClubVue> deLaSaison(Long saisonId) {
        return jdbc.query("""
                SELECT i.eleve_id, i.saison_id, i.inscrit_le, u.prenom, u.nom
                  FROM inscription_club i LEFT JOIN utilisateur u ON u.id = i.saisi_par_id
                 WHERE i.saison_id = :saison ORDER BY i.eleve_id""",
                new MapSqlParameterSource("saison", saisonId),
                (rs, n) -> new InscriptionClubVue(rs.getLong("eleve_id"), rs.getLong("saison_id"),
                        rs.getObject("inscrit_le", LocalDateTime.class),
                        rs.getString("nom") == null ? null : rs.getString("prenom") + " " + rs.getString("nom")));
    }

    @Transactional
    public void noter(Long saisonId, Long eleveId, Long auteurId) {
        var p = new MapSqlParameterSource("saison", saisonId).addValue("eleve", eleveId).addValue("auteur", auteurId);
        if (compter("SELECT COUNT(*) FROM saison WHERE id = :saison", p) == 0) {
            throw new RessourceIntrouvableException("Saison introuvable");
        }
        List<Boolean> archive = jdbc.queryForList(
                "SELECT archive_le IS NOT NULL FROM eleve WHERE id = :eleve", p, Boolean.class);
        if (archive.isEmpty()) throw new RessourceIntrouvableException("Élève introuvable");
        if (archive.getFirst()) {
            throw new RegleMetierException("Cet élève est archivé : désarchivez-le avant de noter son inscription au club.");
        }
        if (compter("SELECT COUNT(*) FROM inscription_club WHERE saison_id = :saison AND eleve_id = :eleve", p) > 0) return;
        jdbc.update("""
                INSERT INTO inscription_club (eleve_id, saison_id, saisi_par_id)
                VALUES (:eleve, :saison, :auteur)""", p);
    }

    @Transactional
    public void retirer(Long saisonId, Long eleveId) {
        jdbc.update("DELETE FROM inscription_club WHERE saison_id = :saison AND eleve_id = :eleve",
                new MapSqlParameterSource("saison", saisonId).addValue("eleve", eleveId));
    }

    private int compter(String sql, MapSqlParameterSource p) {
        Integer n = jdbc.queryForObject(sql, p, Integer.class);
        return n == null ? 0 : n;
    }
}
