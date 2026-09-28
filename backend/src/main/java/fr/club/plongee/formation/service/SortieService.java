package fr.club.plongee.formation.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.domain.Sortie;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.formation.repository.SortieRepository;
import fr.club.plongee.materiel.repository.PretRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Sorties : nom, lieu, dates, et les séances choisies pour elles. Une séance
 * choisie tombe dans les dates de la sortie et n'appartient à aucune autre.
 */
@Service
public class SortieService {

    /** Au-delà, plus probablement une erreur de saisie qu'une sortie (même borne qu'un séjour). */
    static final int DUREE_MAX_JOURS = 31;
    /** Sorties proposées pour un prêt : à venir, ou finies depuis moins de tant de jours. */
    public static final int JOURS_SORTIES_RECENTES = 14;

    public record SeanceSortieVue(Long id, LocalDate date, Integer ordre, String milieu, String lieu, String site,
                                  String commentaire) {}

    public record SortieVue(Long id, String nom, String lieu, LocalDate dateDebut, LocalDate dateFin,
                            String remarques, int nombrePlongees, List<SeanceSortieVue> seances) {}

    /** Une séance des dates de la sortie : déjà choisie, ou prise par une autre sortie (son nom). */
    public record SeancePossibleVue(SeanceSortieVue seance, boolean choisie, String autreSortie) {}

    /** {@code dateFin} absente : sortie d'une journée. */
    public record DemandeSortie(@NotBlank @Size(max = 120) String nom, @Size(max = 120) String lieu,
                                @NotNull LocalDate dateDebut, LocalDate dateFin, String remarques) {}

    private final SortieRepository sorties;
    private final SeanceRepository seances;
    private final PretRepository prets;

    public SortieService(SortieRepository sorties, SeanceRepository seances, PretRepository prets) {
        this.sorties = sorties;
        this.seances = seances;
        this.prets = prets;
    }

    /** {@code recentes} : à venir ou finies depuis peu, de la plus proche à la plus lointaine ; sinon toutes. */
    @Transactional(readOnly = true)
    public List<SortieVue> lister(boolean recentes) {
        List<Sortie> liste = recentes
                ? sorties.depuis(Calendrier.aujourdhui().minusDays(JOURS_SORTIES_RECENTES))
                : sorties.toutes();
        return liste.stream().map(SortieService::vue).toList();
    }

    @Transactional(readOnly = true)
    public SortieVue lire(Long id) {
        return vue(sortie(id));
    }

    @Transactional
    public SortieVue creer(DemandeSortie d) {
        Sortie s = new Sortie();
        appliquer(s, d);
        return vue(sorties.save(s));
    }

    @Transactional
    public SortieVue modifier(Long id, DemandeSortie d) {
        Sortie s = sortie(id);
        appliquer(s, d);
        List<String> dehors = s.getSeances().stream()
                .filter(se -> hors(s, se.getDateSeance()))
                .sorted(Comparator.comparing(Seance::getDateSeance))
                .map(se -> se.getDateSeance().format(Calendrier.DATE_FR)).distinct().toList();
        if (!dehors.isEmpty()) {
            throw new RegleMetierException("Des plongées choisies tombent hors des nouvelles dates ("
                    + String.join(", ", dehors) + ") : retirez-les d'abord de la sortie.");
        }
        return vue(s);
    }

    /** Les séances restent : seul leur rattachement à la sortie disparaît. */
    @Transactional
    public void supprimer(Long id) {
        Sortie s = sortie(id);
        if (prets.existsBySortieId(id)) {
            throw new RegleMetierException("Des prêts de matériel sont rattachés à cette sortie : "
                    + "elle ne peut plus être supprimée, pour garder leur historique.");
        }
        sorties.delete(s);
    }

    @Transactional(readOnly = true)
    public List<SeancePossibleVue> seancesPossibles(Long id) {
        Sortie s = sortie(id);
        List<Seance> candidates = seances.findByDateSeanceBetweenOrderByDateSeanceAscOrdreAsc(
                s.getDateDebut(), s.getDateFin());
        Map<Long, Sortie> prises = new HashMap<>();
        if (!candidates.isEmpty()) {
            for (Sortie autre : sorties.contenant(candidates.stream().map(Seance::getId).toList())) {
                if (autre.getId().equals(id)) continue;
                autre.getSeances().forEach(se -> prises.put(se.getId(), autre));
            }
        }
        Set<Long> choisies = new HashSet<>();
        s.getSeances().forEach(se -> choisies.add(se.getId()));
        return candidates.stream()
                .map(se -> new SeancePossibleVue(vue(se), choisies.contains(se.getId()),
                        prises.containsKey(se.getId()) ? prises.get(se.getId()).getNom() : null))
                .toList();
    }

    /** Remplace la liste des séances de la sortie par celle donnée. */
    @Transactional
    public SortieVue definirSeances(Long id, List<Long> seanceIds) {
        Sortie s = sortie(id);
        Set<Long> ids = new LinkedHashSet<>(seanceIds);
        List<Seance> choisies = seances.findAllById(ids);
        if (choisies.size() != ids.size()) throw new RessourceIntrouvableException("Séance introuvable");
        for (Seance se : choisies) {
            if (hors(s, se.getDateSeance())) {
                throw new RegleMetierException("La séance du " + se.getDateSeance().format(Calendrier.DATE_FR)
                        + " tombe hors des dates de la sortie.");
            }
        }
        if (!ids.isEmpty()) {
            for (Sortie autre : sorties.contenant(ids)) {
                if (!autre.getId().equals(id)) {
                    throw new RegleMetierException("Une des séances choisies fait déjà partie de la sortie « "
                            + autre.getNom() + " ».");
                }
            }
        }
        s.getSeances().clear();
        s.getSeances().addAll(choisies);
        return vue(s);
    }

    public Sortie sortie(Long id) {
        return sorties.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Sortie introuvable"));
    }

    private static boolean hors(Sortie s, LocalDate date) {
        return date.isBefore(s.getDateDebut()) || date.isAfter(s.getDateFin());
    }

    private static void appliquer(Sortie s, DemandeSortie d) {
        LocalDate fin = d.dateFin() != null ? d.dateFin() : d.dateDebut();
        if (fin.isBefore(d.dateDebut())) {
            throw new RegleMetierException("La fin de la sortie doit être le même jour ou après son début.");
        }
        if (ChronoUnit.DAYS.between(d.dateDebut(), fin) + 1 > DUREE_MAX_JOURS) {
            throw new RegleMetierException(
                    "Une sortie ne peut pas dépasser " + DUREE_MAX_JOURS + " jours : vérifiez les dates.");
        }
        s.setNom(d.nom().trim());
        s.setLieu(d.lieu() == null || d.lieu().isBlank() ? null : d.lieu().trim());
        s.setDateDebut(d.dateDebut());
        s.setDateFin(fin);
        s.setRemarques(d.remarques() == null || d.remarques().isBlank() ? null : d.remarques().trim());
    }

    private static SortieVue vue(Sortie s) {
        return new SortieVue(s.getId(), s.getNom(), s.getLieu(), s.getDateDebut(), s.getDateFin(), s.getRemarques(),
                s.nombrePlongees(),
                s.getSeances().stream()
                        .sorted(Comparator.comparing(Seance::getDateSeance)
                                .thenComparing(se -> se.getOrdre() == null ? 0 : se.getOrdre()))
                        .map(SortieService::vue).toList());
    }

    private static SeanceSortieVue vue(Seance se) {
        return new SeanceSortieVue(se.getId(), se.getDateSeance(), se.getOrdre(), se.getMilieu().name(),
                se.getLieu(), se.getSite(), se.getCommentaire());
    }
}
