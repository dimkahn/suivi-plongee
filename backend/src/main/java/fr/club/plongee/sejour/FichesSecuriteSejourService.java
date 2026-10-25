package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.domain.Sortie;
import fr.club.plongee.formation.repository.FicheSecuriteRepository;
import fr.club.plongee.formation.repository.ParticipationRepository;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.formation.service.SortieService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Les fiches de sécurité d'un séjour, gérées depuis sa page (demande du
 * club, 2026) : une ligne par plongée de la sortie, avec l'état de sa fiche.
 * Les organisateurs y ajoutent une plongée (une séance rattachée à la
 * sortie) et suppriment celle qui n'a encore servi à rien ; la fiche
 * elle-même s'établit, se complète et se signe dans ses écrans habituels,
 * avec leurs droits ({@code FicheSecuriteController}).
 */
@Service
public class FichesSecuriteSejourService {

    /**
     * Une plongée du séjour et sa fiche : {@code dp} et {@code dpId} absents
     * sans fiche ; {@code supprimable} : ni fiche, ni présence, ni évaluation.
     */
    public record PlongeeSejourVue(Long seanceId, LocalDate date, Integer ordre, String milieu, String lieu,
                                   String site, Integer profondeurMax, String commentaire, boolean fiche,
                                   boolean signee, Long dpId, String dp, int palanquees, int plongeurs,
                                   boolean realise, boolean supprimable) {}

    /**
     * {@code peutAjouter} : organisateur du séjour (ajout et suppression des
     * plongées) ; {@code peutEtablir} : établir ou modifier les fiches ;
     * {@code peutSupprimerFiche} : un administrateur, comme partout ailleurs.
     */
    public record FichesSecuriteSejourVue(boolean peutAjouter, boolean peutEtablir, boolean peutSupprimerFiche,
                                          List<PlongeeSejourVue> plongees) {}

    /** {@code ordre} absent : la plongée suivante de ce jour-là. */
    public record DemandePlongee(@NotNull LocalDate date, @Min(1) @Max(9) Integer ordre, @NotNull Milieu milieu,
                                 @Size(max = 120) String lieu, @Size(max = 120) String site,
                                 @Min(0) @Max(120) Integer profondeurMax, @Size(max = 500) String commentaire) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;
    private final SeanceRepository seances;
    private final SaisonRepository saisons;
    private final FicheSecuriteRepository fiches;
    private final ParticipationRepository participations;
    private final EvaluationRepository evaluations;

    public FichesSecuriteSejourService(NamedParameterJdbcTemplate jdbc, SortieService sorties,
                                       SeanceRepository seances, SaisonRepository saisons,
                                       FicheSecuriteRepository fiches, ParticipationRepository participations,
                                       EvaluationRepository evaluations) {
        this.jdbc = jdbc;
        this.sorties = sorties;
        this.seances = seances;
        this.saisons = saisons;
        this.fiches = fiches;
        this.participations = participations;
        this.evaluations = evaluations;
    }

    /** Les plongées de la sortie, par date puis n° de plongée. */
    @Transactional(readOnly = true)
    public List<PlongeeSejourVue> plongees(Long sortieId) {
        sorties.sortie(sortieId);
        return jdbc.query("""
                SELECT se.id, se.date_seance, se.ordre, se.milieu, se.lieu, se.site, se.profondeur_max, se.commentaire,
                       f.id AS fiche_id, f.signataire_id, u.id AS dp_id, u.prenom AS dp_prenom, u.nom AS dp_nom,
                       (SELECT COUNT(*) FROM palanquee pa WHERE pa.fiche_securite_id = f.id) AS palanquees,
                       (SELECT COUNT(*) FROM membre_palanquee m JOIN palanquee pa ON pa.id = m.palanquee_id
                         WHERE pa.fiche_securite_id = f.id) AS plongeurs,
                       (SELECT COUNT(*) FROM palanquee pa WHERE pa.fiche_securite_id = f.id
                           AND (pa.profondeur_realisee IS NOT NULL OR pa.duree_realisee IS NOT NULL)) AS realisees,
                       (SELECT COUNT(*) FROM participation p WHERE p.seance_id = se.id)
                     + (SELECT COUNT(*) FROM evaluation e WHERE e.seance_id = se.id) AS usages
                  FROM sortie_seance ss
                  JOIN seance se ON se.id = ss.seance_id
                  LEFT JOIN fiche_securite f ON f.seance_id = se.id
                  LEFT JOIN utilisateur u ON u.id = f.dp_id
                 WHERE ss.sortie_id = :sortie
                 ORDER BY se.date_seance, se.ordre, se.id""",
                new MapSqlParameterSource("sortie", sortieId), (rs, i) -> {
                    boolean fiche = rs.getObject("fiche_id") != null;
                    Long dpId = rs.getObject("dp_id", Long.class);
                    return new PlongeeSejourVue(rs.getLong("id"), rs.getObject("date_seance", LocalDate.class),
                            rs.getObject("ordre", Integer.class), rs.getString("milieu"), rs.getString("lieu"),
                            rs.getString("site"), rs.getObject("profondeur_max", Integer.class),
                            rs.getString("commentaire"), fiche, rs.getObject("signataire_id") != null, dpId,
                            dpId == null ? null : rs.getString("dp_prenom") + " " + rs.getString("dp_nom"),
                            rs.getInt("palanquees"), rs.getInt("plongeurs"), rs.getInt("realisees") > 0,
                            !fiche && rs.getLong("usages") == 0);
                });
    }

    /** Une séance dans les dates du séjour, rattachée à sa sortie : elle paraît au programme. */
    @Transactional
    public void ajouter(Long sortieId, DemandePlongee d) {
        Sortie sortie = sorties.sortie(sortieId);
        if (d.date().isBefore(sortie.getDateDebut()) || d.date().isAfter(sortie.getDateFin())) {
            throw new RegleMetierException("Le " + d.date().format(Calendrier.DATE_FR)
                    + " tombe hors des dates du séjour (" + sortie.getDateDebut().format(Calendrier.DATE_FR)
                    + " – " + sortie.getDateFin().format(Calendrier.DATE_FR) + ").");
        }
        Seance s = new Seance();
        s.setSaison(saisons.contenant(d.date(), d.date()).orElseThrow(() -> new RegleMetierException(
                "Aucune saison ne couvre le " + d.date().format(Calendrier.DATE_FR) + ". "
                        + "Un administrateur doit d'abord la créer (Administration → Saisons).")));
        s.setDateSeance(d.date());
        s.setOrdre(d.ordre() != null ? d.ordre() : ordreSuivant(d.date()));
        s.setMilieu(d.milieu());
        s.setLieu(texte(d.lieu() != null ? d.lieu() : sortie.getLieu()));
        s.setSite(texte(d.site()));
        s.setProfondeurMax(d.profondeurMax());
        s.setCommentaire(texte(d.commentaire()));
        sortie.getSeances().add(seances.save(s));
    }

    /**
     * Supprime la séance elle-même, pas seulement son rattachement : une
     * plongée créée pour le séjour n'a pas de sens ailleurs. Refusé dès
     * qu'elle porte une fiche, des présences ou des évaluations.
     */
    @Transactional
    public void supprimer(Long sortieId, Long seanceId) {
        Sortie sortie = sorties.sortie(sortieId);
        Seance s = sortie.getSeances().stream().filter(se -> se.getId().equals(seanceId)).findFirst()
                .orElseThrow(() -> new RessourceIntrouvableException("Cette plongée ne fait pas partie du séjour"));
        if (fiches.existsBySeanceId(seanceId)) {
            throw new RegleMetierException("Cette plongée a une fiche de sécurité : elle ne peut pas être supprimée. "
                    + "Seul un administrateur peut supprimer la fiche d'abord.");
        }
        if (participations.existsBySeanceId(seanceId) || evaluations.existsBySeanceId(seanceId)) {
            throw new RegleMetierException("Cette plongée porte des présences ou des évaluations : "
                    + "elle ne peut plus être supprimée, pour garder l'historique.");
        }
        sortie.getSeances().remove(s);
        seances.delete(s);
    }

    private int ordreSuivant(LocalDate date) {
        Integer max = jdbc.queryForObject("SELECT MAX(ordre) FROM seance WHERE date_seance = :date",
                new MapSqlParameterSource("date", date), Integer.class);
        return max == null ? 1 : max + 1;
    }

    private static String texte(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
