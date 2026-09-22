package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RessourceIntrouvableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Vue d'ensemble de la saison, un élève par ligne : équivalent de l'onglet
 * « Infos Élèves » du tableur (présence par séance, CACI, séances bloc/nage).
 * Réservée aux encadrants, comme le reste des écritures et lectures de
 * formation.
 */
@RestController
@RequestMapping("/api/roster")
public class RosterController {

    public record SeanceEnTete(Long id, LocalDate date, String lieu) {}

    public record LigneEleve(Long cursusId, String eleve, String niveau, String moniteurReferent,
                             boolean caciValide, long seancesBloc, long seancesNage,
                             Map<Long, String> presencesParSeance) {}

    public record RosterVue(List<SeanceEnTete> seances, List<LigneEleve> eleves) {}

    private final CursusRepository cursus;
    private final SaisonRepository saisons;
    private final SeanceRepository seances;
    private final ParticipationRepository participations;

    public RosterController(CursusRepository cursus, SaisonRepository saisons,
                            SeanceRepository seances, ParticipationRepository participations) {
        this.cursus = cursus;
        this.saisons = saisons;
        this.seances = seances;
        this.participations = participations;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public RosterVue roster(@RequestParam(required = false) Long saisonId) {
        Long saison = saisonId != null ? saisonId
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"))
                    .getId();

        LocalDate aujourdhui = Calendrier.aujourdhui();

        List<LigneEleve> lignes = cursus.parSaison(saison).stream().map(c -> {
            Map<Long, String> presences = participations.findByCursusId(c.getId()).stream()
                    .collect(Collectors.toMap(
                            p -> p.getSeance().getId(),
                            this::libelle,
                            (a, b) -> a));
            return new LigneEleve(c.getId(), c.getEleve().nomComplet(),
                    c.getReferentiel().getNiveau().name(),
                    c.getMoniteurReferent() == null ? null : c.getMoniteurReferent().nomComplet(),
                    c.getEleve().certificatValideAu(aujourdhui),
                    participations.compterAtelier(c.getId(), Participation.Atelier.BLOC),
                    participations.compterAtelier(c.getId(), Participation.Atelier.NAGE),
                    presences);
        }).toList();

        List<SeanceEnTete> entetes = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison).stream()
                .map(s -> new SeanceEnTete(s.getId(), s.getDateSeance(), s.getLieu()))
                .toList();

        return new RosterVue(entetes, lignes);
    }

    /** Le libelle affiche dans la case de la seance : l'atelier si present, sinon le statut. */
    private String libelle(Participation p) {
        if (p.getStatut() == Participation.Statut.PRESENT) {
            return p.getAtelier() == null ? p.getStatut().name() : p.getAtelier().name();
        }
        return p.getStatut().name();
    }
}
