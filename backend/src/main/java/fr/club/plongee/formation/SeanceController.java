package fr.club.plongee.formation;

import fr.club.plongee.formation.calendrier.GenerationSaisonService;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
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

    /**
     * Séjour de plongée : une séance par jour, par plongée du jour et par
     * info complémentaire (deux infos, par exemple deux bateaux ou deux
     * groupes, doublent le nombre de séances).
     */
    public record DemandeSerieSeances(@NotNull LocalDate dateDebut, @NotNull LocalDate dateFin,
                                      @NotNull @Min(1) @Max(6) Integer plongeesParJour,
                                      @NotNull Milieu milieu, String lieu, String site, Integer profondeurMax,
                                      @Size(max = 10) List<String> infos) {}

    public record SeancePrevueVue(LocalDate date, int ordre, String milieu, String lieu, String site,
                                  Integer profondeurMax, String commentaire) {}

    public record ExclusionVue(String motif, LocalDate debut, LocalDate fin, int seancesRetirees) {}

    public record GenerationSaisonVue(String saison, boolean saisonOuverte, int nbSeances, int seancesExistantes,
                                      List<SeancePrevueVue> seances, List<ExclusionVue> exclusions) {}

    /** Au-delà, c'est plus probablement une erreur de saisie qu'un séjour. */
    private static final int DUREE_MAX_SEJOUR_JOURS = 31;

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
    private final GenerationSaisonService generationSaison;

    public SeanceController(SeanceRepository seances, SaisonRepository saisons,
                            CursusRepository cursus, ParticipationRepository participations,
                            EvaluationRepository evaluations, FicheSecuriteRepository fichesSecurite,
                            PhotoEleveRepository photos, GenerationSaisonService generationSaison) {
        this.seances = seances;
        this.saisons = saisons;
        this.cursus = cursus;
        this.participations = participations;
        this.evaluations = evaluations;
        this.fichesSecurite = fichesSecurite;
        this.photos = photos;
        this.generationSaison = generationSaison;
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
     * Crée d'un coup toutes les séances d'un séjour, dans une seule
     * transaction : tout ou rien. Si des séances existent déjà un de ces
     * jours, les n° de plongée continuent après elles plutôt que de les
     * doublonner. Les séances d'une même plongée (une par info
     * complémentaire) partagent le même n°.
     */
    @PostMapping("/serie")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    @Transactional
    public List<SeanceVue> creerSerie(@Valid @RequestBody DemandeSerieSeances demande) {
        if (demande.dateFin().isBefore(demande.dateDebut())) {
            throw new RegleMetierException("La date de fin du séjour doit être le même jour ou après la date de début.");
        }
        long nbJours = ChronoUnit.DAYS.between(demande.dateDebut(), demande.dateFin()) + 1;
        if (nbJours > DUREE_MAX_SEJOUR_JOURS) {
            throw new RegleMetierException(
                    "Un séjour ne peut pas dépasser " + DUREE_MAX_SEJOUR_JOURS + " jours : vérifiez les dates.");
        }

        List<String> infos = demande.infos() == null ? List.of() : demande.infos().stream()
                .filter(i -> i != null && !i.isBlank())
                .map(String::trim)
                .toList();
        List<String> variantes = infos.isEmpty() ? java.util.Collections.singletonList(null) : infos;

        Saison saison = saisonCourante();
        Map<LocalDate, Integer> dernierOrdre = new HashMap<>();
        for (Seance existante : seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison.getId())) {
            dernierOrdre.merge(existante.getDateSeance(), existante.getOrdre(), Math::max);
        }

        List<Seance> creees = new ArrayList<>();
        for (LocalDate jour = demande.dateDebut(); !jour.isAfter(demande.dateFin()); jour = jour.plusDays(1)) {
            int decalage = dernierOrdre.getOrDefault(jour, 0);
            for (int plongee = 1; plongee <= demande.plongeesParJour(); plongee++) {
                for (String info : variantes) {
                    Seance s = new Seance();
                    s.setSaison(saison);
                    s.setDateSeance(jour);
                    s.setOrdre(decalage + plongee);
                    s.setMilieu(demande.milieu());
                    s.setLieu(demande.lieu());
                    s.setSite(demande.site());
                    s.setProfondeurMax(demande.profondeurMax());
                    s.setCommentaire(info);
                    creees.add(s);
                }
            }
        }
        seances.saveAll(creees);
        return creees.stream().map(this::vue).toList();
    }

    /**
     * Aperçu d'une saison générée (une séance chaque jour de la semaine choisi) : les
     * séances qui seraient créées et ce qui en a été retiré (vacances de la
     * zone, jours fériés). Rien n'est enregistré.
     */
    @PostMapping("/generation/apercu")
    @PreAuthorize("hasRole('ADMIN')")
    public GenerationSaisonVue apercuGeneration(@Valid @RequestBody GenerationSaisonService.Demande demande) {
        return vue(generationSaison.planifier(demande), demande);
    }

    /** Même calcul que l'aperçu, puis création de toutes les séances en une transaction. */
    @PostMapping("/generation")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public GenerationSaisonVue generer(@Valid @RequestBody GenerationSaisonService.Demande demande) {
        return vue(generationSaison.generer(demande), demande);
    }

    private GenerationSaisonVue vue(GenerationSaisonService.Plan plan, GenerationSaisonService.Demande d) {
        return new GenerationSaisonVue(plan.saison().getLibelle(), plan.saison().isOuverte(), plan.seances().size(),
                plan.seancesExistantes(),
                plan.seances().stream().map(p -> new SeancePrevueVue(p.date(), p.ordre(),
                        d.milieu().name(), d.lieu(), d.site(), d.profondeurMax(), d.info())).toList(),
                plan.exclusions().stream().map(e -> new ExclusionVue(e.motif(), e.debut(), e.fin(),
                        e.seancesRetirees())).toList());
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
