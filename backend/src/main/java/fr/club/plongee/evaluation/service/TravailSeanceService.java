package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.referentiel.domain.Critere;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Ce que chaque groupe a travaillé pendant une séance, retrouvé d'après les
 * notes : utile quand aucun programme n'a été préparé (notation groupée,
 * notes prises directement dans la grille). Lecture seule, rien n'est
 * enregistré : la vue suit les notes, même ajoutées après coup. Le groupe
 * d'un élève est celui où il est rangé aujourd'hui pour la saison de la
 * séance.
 */
@Service
public class TravailSeanceService {

    /** Un exercice noté (de la base ou libre) et le nombre d'élèves du groupe notés dessus. */
    public record ExerciceTravailleVue(GrilleService.ExerciceNoteVue exercice, int eleves) {}

    /** Un critère noté sans exercice, et le nombre d'élèves du groupe notés ainsi. */
    public record CritereTravailleVue(Long critereId, String bloc, String savoirFaire, int eleves) {}

    /** {@code groupeId} null : les élèves rangés dans aucun groupe. */
    public record TravailGroupeVue(Long groupeId, String nom, int elevesNotes,
                                   List<ExerciceTravailleVue> exercices, List<CritereTravailleVue> criteres) {}

    /** Seuls les groupes qui ont au moins une note sur la séance, dans l'ordre du planning, « Sans groupe » à la fin. */
    public record TravailSeanceVue(Long seanceId, List<TravailGroupeVue> groupes) {}

    private final SeanceRepository seances;
    private final EvaluationRepository evaluations;
    private final GroupeEntrainementRepository groupes;

    public TravailSeanceService(SeanceRepository seances, EvaluationRepository evaluations,
                                GroupeEntrainementRepository groupes) {
        this.seances = seances;
        this.evaluations = evaluations;
        this.groupes = groupes;
    }

    @Transactional(readOnly = true)
    public TravailSeanceVue travail(Long seanceId) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable"));
        List<GroupeEntrainement> groupesSaison = groupes.parSaison(seance.getSaison().getId());
        Map<Long, Long> groupeDeLEleve = new HashMap<>();
        for (GroupeEntrainement g : groupesSaison) {
            g.getEleves().forEach(e -> groupeDeLEleve.put(e.getId(), g.getId()));
        }

        // null : sans groupe ; LinkedHashMap pour garder l'ordre du planning.
        Map<Long, List<Evaluation>> parGroupe = new LinkedHashMap<>();
        groupesSaison.forEach(g -> parGroupe.put(g.getId(), new ArrayList<>()));
        parGroupe.put(null, new ArrayList<>());
        for (Evaluation e : evaluations.deLaSeance(seanceId)) {
            parGroupe.get(groupeDeLEleve.get(e.getCursus().getEleve().getId())).add(e);
        }

        Map<Long, String> noms = new HashMap<>();
        groupesSaison.forEach(g -> noms.put(g.getId(), g.getNom()));
        List<TravailGroupeVue> vues = new ArrayList<>();
        parGroupe.forEach((groupeId, notes) -> {
            if (!notes.isEmpty()) {
                vues.add(vue(groupeId, groupeId == null ? "Sans groupe" : noms.get(groupeId), notes));
            }
        });
        return new TravailSeanceVue(seanceId, vues);
    }

    private static TravailGroupeVue vue(Long groupeId, String nom, List<Evaluation> notes) {
        Map<GrilleService.ExerciceNoteVue, Set<Long>> exercices = new LinkedHashMap<>();
        Map<Critere, Set<Long>> sansExercice = new LinkedHashMap<>();
        Set<Long> eleves = new HashSet<>();
        for (Evaluation e : notes) {
            Long cursusId = e.getCursus().getId();
            eleves.add(cursusId);
            GrilleService.ExerciceNoteVue exercice = GrilleService.ExerciceNoteVue.de(e);
            if (exercice != null) exercices.computeIfAbsent(exercice, k -> new HashSet<>()).add(cursusId);
            else sansExercice.computeIfAbsent(e.getCritere(), k -> new HashSet<>()).add(cursusId);
        }
        // Exercices de la base par numéro, puis les libres par intitulé.
        List<ExerciceTravailleVue> listeExercices = exercices.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<GrilleService.ExerciceNoteVue, Set<Long>> x) -> x.getKey().numero() == null)
                        .thenComparing(x -> numeroTriable(x.getKey().numero()))
                        .thenComparing(x -> x.getKey().intitule()))
                .map(x -> new ExerciceTravailleVue(x.getKey(), x.getValue().size()))
                .toList();
        List<CritereTravailleVue> listeCriteres = sansExercice.entrySet().stream()
                .sorted(Comparator.comparingInt((Map.Entry<Critere, Set<Long>> x) -> x.getKey().getBloc().getOrdre())
                        .thenComparingInt(x -> x.getKey().getOrdre()))
                .map(x -> new CritereTravailleVue(x.getKey().getId(), x.getKey().getBloc().getIntitule(),
                        x.getKey().getSavoirFaire(), x.getValue().size()))
                .toList();
        return new TravailGroupeVue(groupeId, nom, eleves.size(), listeExercices, listeCriteres);
    }

    /** « 1.10 » après « 1.9 » : chaque partie du numéro comparée comme un nombre. */
    private static String numeroTriable(String numero) {
        if (numero == null) return "";
        StringBuilder triable = new StringBuilder();
        for (String partie : numero.split("\\.")) {
            triable.append(partie.matches("\\d+") ? "%05d".formatted(Integer.parseInt(partie)) : partie).append('.');
        }
        return triable.toString();
    }
}
