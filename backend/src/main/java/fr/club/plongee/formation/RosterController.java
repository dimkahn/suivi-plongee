package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.evaluation.service.AvancementFormation;
import fr.club.plongee.commun.ActiviteCaci;
import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.MedecinCaci;
import fr.club.plongee.commun.RessourceIntrouvableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    public record SeanceEnTete(Long id, LocalDate date, String lieu, String milieu) {}

    /**
     * {@code aPhoto} : jamais vrai sans le droit à l'image de l'élève.
     * {@code caciFinValidite} : date seule (jamais le certificat), pour colorer l'échéance à l'écran ;
     * {@code caciDateExamen}, {@code caciMedecin} et {@code caciActivites} (cases cochées) s'affichent
     * au clic sur la case CACI.
     */
    public record LigneEleve(Long cursusId, Long eleveId, String eleve, String niveau,
                             boolean caciValide, LocalDate caciFinValidite,
                             LocalDate caciDateExamen, MedecinCaci caciMedecin, Set<ActiviteCaci> caciActivites,
                             long seancesBloc, long seancesNage,
                             Map<Long, String> presencesParSeance, boolean aPhoto,
                             /** Barre de progression à côté du nom : même calcul que la synthèse de l'élève. */
                             AvancementFormation.Avancement avancement) {}

    public record RosterVue(List<SeanceEnTete> seances, List<LigneEleve> eleves) {}

    private final CursusRepository cursus;
    private final SaisonRepository saisons;
    private final SeanceRepository seances;
    private final ParticipationRepository participations;
    private final PhotoEleveRepository photos;
    private final AvancementFormation avancements;

    public RosterController(CursusRepository cursus, SaisonRepository saisons,
                            SeanceRepository seances, ParticipationRepository participations,
                            PhotoEleveRepository photos, AvancementFormation avancements) {
        this.avancements = avancements;
        this.cursus = cursus;
        this.saisons = saisons;
        this.seances = seances;
        this.participations = participations;
        this.photos = photos;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public RosterVue roster(@RequestParam(required = false) Long saisonId) {
        Long saison = saisonId != null ? saisonId
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"))
                    .getId();

        LocalDate aujourdhui = Calendrier.aujourdhui();

        Set<Long> seancesDuJour = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison).stream()
                .filter(s -> aujourdhui.equals(s.getDateSeance())).map(Seance::getId).collect(Collectors.toSet());
        // Brevet obtenu ailleurs : il ne prépare plus ce niveau, il sort de la liste,
        // sauf s'il est noté présent aujourd'hui (téléphone et personne à prévenir au bord du bassin).
        List<Cursus> proposes = cursus.parSaison(saison).stream()
                .filter(c -> c.getStatut() != Cursus.Statut.OBTENU_AILLEURS || presentA(c, seancesDuJour)).toList();
        // Une ligne par élève (InscriptionRetenue), avec les présences de toutes ses inscriptions
        // de la saison : un brevet délivré puis le niveau suivant ne font qu'une personne.
        Map<Long, List<Long>> inscriptionsDeLEleve = proposes.stream().collect(Collectors.groupingBy(
                c -> c.getEleve().getId(), Collectors.mapping(Cursus::getId, Collectors.toList())));
        List<LigneEleve> lignes = InscriptionRetenue.uneParEleve(proposes).stream().map(c -> {
            List<Long> siennes = inscriptionsDeLEleve.get(c.getEleve().getId());
            Map<Long, String> presences = siennes.stream()
                    .flatMap(id -> participations.findByCursusId(id).stream())
                    .collect(Collectors.toMap(
                            p -> p.getSeance().getId(),
                            this::libelle,
                            (a, b) -> a));
            long bloc = siennes.stream().mapToLong(id -> participations.compterAtelier(id, Participation.Atelier.BLOC)).sum();
            long nage = siennes.stream().mapToLong(id -> participations.compterAtelier(id, Participation.Atelier.NAGE)).sum();
            Eleve e = c.getEleve();
            return new LigneEleve(c.getId(), e.getId(), e.nomComplet(),
                    c.getReferentiel().getNiveau().name(),
                    c.getEleve().certificatValideAu(aujourdhui),
                    e.getCertificatValideJusquAu(),
                    e.getCaciDateExamen(), e.getCaciMedecin(), e.getCaciActivites(),
                    bloc,
                    nage,
                    presences,
                    e.isAutorisationImage() && photos.existsById(e.getId()),
                    avancements.de(c.getId()));
        }).toList();

        List<SeanceEnTete> entetes = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison).stream()
                .map(s -> new SeanceEnTete(s.getId(), s.getDateSeance(), s.getLieu(), s.getMilieu().name()))
                .toList();

        return new RosterVue(entetes, lignes);
    }

    /** Noté présent à l'une de ces séances. */
    private boolean presentA(Cursus c, Set<Long> seanceIds) {
        return participations.findByCursusId(c.getId()).stream()
                .anyMatch(p -> p.getStatut() == Participation.Statut.PRESENT && seanceIds.contains(p.getSeance().getId()));
    }

    /**
     * Le libelle affiche dans la case de la seance : l'atelier si present (« BLOC+THEORIE »
     * avec de la theorie en plus), sinon le statut.
     */
    private String libelle(Participation p) {
        if (p.getStatut() == Participation.Statut.PRESENT) {
            return p.getAtelier() == null ? p.getStatut().name() : p.codeAtelier();
        }
        return p.getStatut().name();
    }
}
