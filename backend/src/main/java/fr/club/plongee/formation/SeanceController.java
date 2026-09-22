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
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/seances")
public class SeanceController {

    public record SeanceVue(Long id, LocalDate date, Integer ordre, String milieu, String lieu,
                            Integer profondeurMax, String commentaire, boolean modifiable,
                            boolean ficheSecurite) {}

    public record DemandeSeance(@NotNull LocalDate dateSeance, Integer ordre, @NotNull Milieu milieu,
                                String lieu, Integer profondeurMax, String commentaire) {}

    public record DemandePresence(@NotNull Long cursusId, @NotNull Participation.Statut statut,
                                  Participation.Atelier atelier, String commentaire) {}

    private final SeanceRepository seances;
    private final SaisonRepository saisons;
    private final CursusRepository cursus;
    private final ParticipationRepository participations;
    private final EvaluationRepository evaluations;
    private final FicheSecuriteRepository fichesSecurite;

    public SeanceController(SeanceRepository seances, SaisonRepository saisons,
                            CursusRepository cursus, ParticipationRepository participations,
                            EvaluationRepository evaluations, FicheSecuriteRepository fichesSecurite) {
        this.seances = seances;
        this.saisons = saisons;
        this.cursus = cursus;
        this.participations = participations;
        this.evaluations = evaluations;
        this.fichesSecurite = fichesSecurite;
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
        s.setProfondeurMax(demande.profondeurMax());
        s.setCommentaire(demande.commentaire());
        seances.save(s);
        return vue(s);
    }

    /**
     * Modifie une séance. Une fois qu'elle porte des présences ou des
     * évaluations, milieu et profondeur ne bougent plus : les règles du MFT
     * déjà validées (milieu naturel exclusif, profondeur de formation...)
     * dépendent de ces valeurs. Date, lieu et commentaire restent libres.
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

    /** Feuille de presence : remplace la grille de dates en colonnes du tableur. */
    @PutMapping("/{seanceId}/presences")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public void enregistrerPresences(@PathVariable Long seanceId,
                                     @Valid @RequestBody List<DemandePresence> demandes) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
        seance.verifierQueLaSeanceAEuLieu("enregistrer les présences");
        for (DemandePresence d : demandes) {
            Cursus c = cursus.findById(d.cursusId())
                    .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
            Participation p = participations
                    .findByCursusIdAndSeanceId(d.cursusId(), seanceId)
                    .orElseGet(Participation::new);
            p.setCursus(c);
            p.setSeance(seance);
            p.setStatut(d.statut());
            p.setAtelier(d.atelier());
            p.setCommentaire(d.commentaire());
            participations.save(p);
        }
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
                s.getLieu(), s.getProfondeurMax(), s.getCommentaire(), estModifiableEnProfondeur(s),
                fichesSecurite.existsBySeanceId(s.getId()));
    }
}
