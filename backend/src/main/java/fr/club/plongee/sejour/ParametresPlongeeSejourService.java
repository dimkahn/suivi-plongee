package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.EnvoiParametresSejourService;
import fr.club.plongee.formation.service.EnvoiParametresSejourService.BilanEnvoi;
import fr.club.plongee.formation.service.EnvoiParametresSejourService.Destinataire;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Les paramètres de plongée envoyés par e-mail aux participants du séjour
 * cochés par l'organisateur (demande du club, 2026) : chacun reçoit les
 * seules plongées de la sortie où il figure, lues sur les fiches de sécurité
 * par {@link EnvoiParametresSejourService}. Le participant y est retrouvé par
 * son dossier élève, son compte, sinon ses nom et prénom.
 */
@Service
public class ParametresPlongeeSejourService {

    private final NamedParameterJdbcTemplate jdbc;
    private final EnvoiParametresSejourService envoi;

    public ParametresPlongeeSejourService(NamedParameterJdbcTemplate jdbc, EnvoiParametresSejourService envoi) {
        this.jdbc = jdbc;
        this.envoi = envoi;
    }

    @Transactional(readOnly = true)
    public BilanEnvoi envoyer(Long sortieId, Collection<Long> participantIds) {
        Set<Long> choisis = participantIds == null ? Set.of() : new HashSet<>(participantIds);
        if (choisis.isEmpty()) throw new RegleMetierException("Choisissez au moins un participant.");
        List<Destinataire> destinataires = jdbc.query("""
                SELECT p.prenom, p.nom, p.eleve_id, COALESCE(p.utilisateur_id, e.utilisateur_id) AS compte, p.email
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie AND p.id IN (:ids)
                 ORDER BY p.nom, p.prenom""",
                new MapSqlParameterSource("sortie", sortieId).addValue("ids", choisis),
                (rs, i) -> new Destinataire(rs.getString("prenom"), rs.getString("nom"),
                        rs.getObject("eleve_id", Long.class), rs.getObject("compte", Long.class), rs.getString("email")));
        if (destinataires.size() < choisis.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
        return envoi.envoyer(sortieId, destinataires);
    }
}
