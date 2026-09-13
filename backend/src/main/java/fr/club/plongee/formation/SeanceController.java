package fr.club.plongee.formation;

import fr.club.plongee.commun.RessourceIntrouvableException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/seances")
public class SeanceController {

    public record SeanceVue(Long id, LocalDate date, String milieu, String lieu,
                            Integer profondeurMax) {}

    public record DemandeSeance(@NotNull LocalDate dateSeance, @NotNull Milieu milieu,
                                String lieu, Integer profondeurMax, String commentaire) {}

    public record DemandePresence(@NotNull Long cursusId, @NotNull Participation.Statut statut,
                                  Participation.Atelier atelier, String commentaire) {}

    private final SeanceRepository seances;
    private final SaisonRepository saisons;
    private final CursusRepository cursus;
    private final ParticipationRepository participations;

    public SeanceController(SeanceRepository seances, SaisonRepository saisons,
                            CursusRepository cursus, ParticipationRepository participations) {
        this.seances = seances;
        this.saisons = saisons;
        this.cursus = cursus;
        this.participations = participations;
    }

    @GetMapping
    public List<SeanceVue> lister(@RequestParam(required = false) Long saisonId) {
        Long saison = saisonId != null ? saisonId : saisonCourante().getId();
        return seances.findBySaisonIdOrderByDateSeance(saison).stream()
                .map(s -> new SeanceVue(s.getId(), s.getDateSeance(), s.getMilieu().name(),
                        s.getLieu(), s.getProfondeurMax()))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public SeanceVue creer(@Valid @RequestBody DemandeSeance demande) {
        Seance s = new Seance();
        s.setSaison(saisonCourante());
        s.setDateSeance(demande.dateSeance());
        s.setMilieu(demande.milieu());
        s.setLieu(demande.lieu());
        s.setProfondeurMax(demande.profondeurMax());
        s.setCommentaire(demande.commentaire());
        seances.save(s);
        return new SeanceVue(s.getId(), s.getDateSeance(), s.getMilieu().name(),
                s.getLieu(), s.getProfondeurMax());
    }

    /** Feuille de presence : remplace la grille de dates en colonnes du tableur. */
    @PutMapping("/{seanceId}/presences")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public void enregistrerPresences(@PathVariable Long seanceId,
                                     @Valid @RequestBody List<DemandePresence> demandes) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
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
}
