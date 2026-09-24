package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/seances")
public class SeanceController {

    public record SeanceVue(Long id, LocalDate date, Integer ordre, String milieu, String lieu, String site,
                            Integer profondeurMax, String commentaire, boolean modifiable,
                            boolean ficheSecurite) {}

    public record DemandeSeance(@NotNull LocalDate dateSeance, Integer ordre, @NotNull Milieu milieu,
                                String lieu, String site, Integer profondeurMax, String commentaire) {}

    public record DemandePresence(@NotNull Long cursusId, @NotNull Participation.Statut statut,
                                  Participation.Atelier atelier, String commentaire) {}

    /** Une ligne de la feuille de présence ; statut/atelier null : rien de saisi pour cette séance. */
    public record LignePresence(Long cursusId, Long eleveId, String eleve, String niveau, String statut,
                                String atelier, boolean aPhoto, boolean autorisationImage) {}

    public record FeuillePresence(SeanceVue seance, List<LignePresence> eleves) {}

    private final SeanceRepository seances;
    private final SaisonRepository saisons;
    private final CursusRepository cursus;
    private final ParticipationRepository participations;
    private final EvaluationRepository evaluations;
    private final FicheSecuriteRepository fichesSecurite;
    private final PhotoEleveRepository photos;

    public SeanceController(SeanceRepository seances, SaisonRepository saisons,
                            CursusRepository cursus, ParticipationRepository participations,
                            EvaluationRepository evaluations, FicheSecuriteRepository fichesSecurite,
                            PhotoEleveRepository photos) {
        this.seances = seances;
        this.saisons = saisons;
        this.cursus = cursus;
        this.participations = participations;
        this.evaluations = evaluations;
        this.fichesSecurite = fichesSecurite;
        this.photos = photos;
    }

    @GetMapping
    public List<SeanceVue> lister(@RequestParam(required = false) Long saisonId) {
        Long saison = saisonId != null ? saisonId : saisonCourante().getId();
        return seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison).stream()
                .map(this::vue)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public SeanceVue creer(@Valid @RequestBody DemandeSeance demande) {
        Seance s = new Seance();
        s.setSaison(saisonCourante());
        s.setDateSeance(demande.dateSeance());
        s.setOrdre(demande.ordre() != null ? demande.ordre() : 1);
        s.setMilieu(demande.milieu());
        s.setLieu(demande.lieu());
        s.setSite(demande.site());
        s.setProfondeurMax(demande.profondeurMax());
        s.setCommentaire(demande.commentaire());
        seances.save(s);
        return vue(s);
    }

    /**
     * Modifie une séance. Une fois qu'elle porte des présences ou des
     * évaluations, milieu et profondeur ne bougent plus : les règles du MFT
     * déjà validées (milieu naturel exclusif, profondeur de formation...)
     * dépendent de ces valeurs. Date, lieu, site et commentaire restent libres.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public SeanceVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeSeance demande) {
        Seance s = seances.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));

        if (!estModifiableEnProfondeur(s) &&
                (s.getMilieu() != demande.milieu()
                        || !Objects.equals(s.getProfondeurMax(), demande.profondeurMax()))) {
            throw new RegleMetierException(
                    "Cette séance porte déjà des présences ou des évaluations : "
                            + "le milieu et la profondeur ne peuvent plus être modifiés.");
        }

        s.setDateSeance(demande.dateSeance());
        s.setOrdre(demande.ordre() != null ? demande.ordre() : 1);
        s.setMilieu(demande.milieu());
        s.setLieu(demande.lieu());
        s.setSite(demande.site());
        s.setProfondeurMax(demande.profondeurMax());
        s.setCommentaire(demande.commentaire());
        seances.save(s);
        return vue(s);
    }

    /** Suppression réservée à l'ADMIN : un geste rare, jamais fait sur une séance déjà utilisée. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id) {
        Seance s = seances.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
        if (!estModifiableEnProfondeur(s)) {
            throw new RegleMetierException(
                    "Cette séance porte des présences ou des évaluations : "
                            + "elle ne peut plus être supprimée, pour garder l'historique.");
        }
        seances.delete(s);
    }

    /**
     * Feuille de presence d'une seance : tous les eleves inscrits sur sa saison,
     * avec ce qui a deja ete saisi. Un cursus abandonne n'apparait que s'il
     * porte deja une presence pour cette seance.
     */
    @GetMapping("/{seanceId}/presences")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    @Transactional(readOnly = true)
    public FeuillePresence feuillePresence(@PathVariable Long seanceId) {
        Seance seance = seance(seanceId);
        Map<Long, Participation> saisies = participations.findBySeanceId(seanceId).stream()
                .collect(Collectors.toMap(p -> p.getCursus().getId(), Function.identity(), (a, b) -> a));
        List<LignePresence> lignes = cursus.parSaison(seance.getSaison().getId()).stream()
                .filter(c -> c.getStatut() != Cursus.Statut.ABANDON || saisies.containsKey(c.getId()))
                .map(c -> {
                    Participation p = saisies.get(c.getId());
                    Eleve e = c.getEleve();
                    return new LignePresence(c.getId(), e.getId(), e.nomComplet(),
                            c.getReferentiel().getNiveau().name(),
                            p == null ? null : p.getStatut().name(),
                            p == null || p.getAtelier() == null ? null : p.getAtelier().name(),
                            e.isAutorisationImage() && photos.existsById(e.getId()),
                            e.isAutorisationImage());
                })
                .toList();
        return new FeuillePresence(vue(seance), lignes);
    }

    /** Feuille de presence : remplace la grille de dates en colonnes du tableur. */
    @PutMapping("/{seanceId}/presences")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    @Transactional
    public void enregistrerPresences(@PathVariable Long seanceId,
                                     @Valid @RequestBody List<DemandePresence> demandes) {
        Seance seance = seance(seanceId);
        seance.verifierQueLaSeanceAEuLieu("enregistrer les présences");
        for (DemandePresence d : demandes) {
            Cursus c = cursus.findById(d.cursusId())
                    .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
            if (!c.getSaison().getId().equals(seance.getSaison().getId())) {
                throw new RegleMetierException(
                        "Cet élève n'est pas inscrit sur la saison de cette séance.");
            }
            Participation p = participations
                    .findByCursusIdAndSeanceId(d.cursusId(), seanceId)
                    .orElseGet(Participation::new);
            p.setCursus(c);
            p.setSeance(seance);
            p.setStatut(d.statut());
            // L'atelier ne se dit que d'un eleve present : un absent n'a fait ni nage ni bloc.
            p.setAtelier(d.statut() == Participation.Statut.PRESENT ? d.atelier() : null);
            p.setCommentaire(d.commentaire());
            participations.save(p);
        }
    }

    /** Efface une presence saisie par erreur : l'eleve redevient « non renseigne » pour cette seance. */
    @DeleteMapping("/{seanceId}/presences/{cursusId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    @Transactional
    public void effacerPresence(@PathVariable Long seanceId, @PathVariable Long cursusId) {
        participations.findByCursusIdAndSeanceId(cursusId, seanceId).ifPresent(participations::delete);
    }

    private Seance seance(Long id) {
        return seances.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
    }

    private Saison saisonCourante() {
        return saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"));
    }

    private boolean estModifiableEnProfondeur(Seance s) {
        return !participations.existsBySeanceId(s.getId()) && !evaluations.existsBySeanceId(s.getId());
    }

    private SeanceVue vue(Seance s) {
        return new SeanceVue(s.getId(), s.getDateSeance(), s.getOrdre(), s.getMilieu().name(),
                s.getLieu(), s.getSite(), s.getProfondeurMax(), s.getCommentaire(), estModifiableEnProfondeur(s),
                fichesSecurite.existsBySeanceId(s.getId()));
    }
}
