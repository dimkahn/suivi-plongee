package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.domain.StatutAcquisition;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Participation;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.ParticipationRepository;
import fr.club.plongee.formation.repository.PhotoEleveRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Critere;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Synthèse des notations d'une séance pour un niveau (choix du club, 2026) :
 * ce que chaque élève présent a reçu ce jour-là, et, critère par critère,
 * combien d'élèves en sont à « acquis », « en cours » ou « non abordé ».
 * Lecture seule ; l'état retenu pour un élève et un critère est sa dernière
 * note de la séance (la table est en ajout seul, une correction s'ajoute),
 * et l'état montré est celui de l'exercice noté, pas celui du critère qui en
 * découle : un exercice d'initiation acquis s'affiche « acquis ».
 */
@Service
public class SyntheseSeanceService {

    /**
     * Dernière note d'un élève sur un critère pendant la séance. {@code statut} :
     * état du critère qui en découle ; {@code statutExercice} : état saisi pour
     * l'exercice ; {@code statutAffiche} : celui que montre la synthèse et que
     * comptent les totaux (choix du club, 2026) — l'exercice noté s'il y en a un,
     * sinon le critère ; {@code commentaires} : tous ceux de la séance.
     */
    public record NoteSyntheseVue(Long cursusId, String eleve, Long critereId, String bloc, String savoirFaire,
                                  String statut, String statutExercice, String statutAffiche,
                                  GrilleService.ExerciceNoteVue exercice,
                                  String parQui, String saisiPar, boolean entrainement,
                                  List<String> commentaires) {}

    public record CritereSyntheseVue(Long critereId, String bloc, String regroupement, String savoirFaire,
                                     int acquis, int enCours, int nonAborde, List<NoteSyntheseVue> notes) {}

    /**
     * Un élève présent, avec ses notes de la séance (liste vide : pas encore évalué).
     * {@code atelier} : ce qu'il a fait (NAGE, BLOC, BLOC+THEORIE...), null si non précisé ;
     * {@code notePar} : les encadrants qui l'ont noté, dans l'ordre de leur première note ;
     * {@code aPhoto} : photo consultable (droit à l'image accordé), lue à part.
     */
    public record EleveSyntheseVue(Long cursusId, Long eleveId, String eleve, boolean aPhoto, String atelier,
                                   List<String> notePar, List<NoteSyntheseVue> notes) {}

    /**
     * {@code niveaux} : niveaux des élèves présents, pour passer de l'un à l'autre ;
     * {@code niveau} : celui de la synthèse, null s'il n'y a aucun présent.
     */
    public record SyntheseVue(Long seanceId, LocalDate date, String lieu, String milieu,
                              List<String> niveaux, String niveau,
                              int presents, int presentsNotes, int notes,
                              List<CritereSyntheseVue> criteres, List<EleveSyntheseVue> eleves) {}

    private final SeanceRepository seances;
    private final ParticipationRepository participations;
    private final EvaluationRepository evaluations;
    private final PhotoEleveRepository photos;

    public SyntheseSeanceService(SeanceRepository seances, ParticipationRepository participations,
                                 EvaluationRepository evaluations, PhotoEleveRepository photos) {
        this.seances = seances;
        this.participations = participations;
        this.evaluations = evaluations;
        this.photos = photos;
    }

    @Transactional(readOnly = true)
    public SyntheseVue synthese(Long seanceId, String niveauDemande) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable"));

        Map<Long, String> ateliers = new LinkedHashMap<>();
        List<Cursus> presents = participations.findBySeanceId(seanceId).stream()
                .filter(p -> p.getStatut() == Participation.Statut.PRESENT)
                .peek(p -> ateliers.put(p.getCursus().getId(), p.codeAtelier()))
                .map(Participation::getCursus)
                .sorted(Comparator.comparing((Cursus c) -> c.getEleve().getNom())
                        .thenComparing(c -> c.getEleve().getPrenom()))
                .toList();
        List<String> niveaux = presents.stream().map(SyntheseSeanceService::niveauDe).distinct().sorted().toList();
        String niveau = niveaux.contains(niveauDemande) ? niveauDemande
                : niveaux.isEmpty() ? null : niveaux.getFirst();

        List<Cursus> duNiveau = presents.stream().filter(c -> niveauDe(c).equals(niveau)).toList();
        List<Evaluation> notes = evaluations.deLaSeance(seanceId).stream()
                .filter(e -> niveauDe(e.getCursus()).equals(niveau))
                .toList();

        // Dernière note par élève et par critère, avec tous les commentaires de la séance.
        Map<String, List<Evaluation>> parEleveEtCritere = new LinkedHashMap<>();
        for (Evaluation e : notes) {
            parEleveEtCritere.computeIfAbsent(e.getCursus().getId() + ":" + e.getCritere().getId(),
                    k -> new ArrayList<>()).add(e);
        }
        List<NoteSyntheseVue> dernieres = parEleveEtCritere.values().stream()
                .map(SyntheseSeanceService::vue)
                .toList();

        Map<Long, Critere> criteresNotes = new LinkedHashMap<>();
        notes.forEach(e -> criteresNotes.putIfAbsent(e.getCritere().getId(), e.getCritere()));
        List<CritereSyntheseVue> criteres = criteresNotes.values().stream()
                .sorted(Comparator.comparing((Critere c) -> c.getBloc().getOrdre())
                        .thenComparing(c -> c.getBloc().getIntitule())
                        .thenComparing(Critere::getOrdre))
                .map(c -> {
                    List<NoteSyntheseVue> duCritere = dernieres.stream()
                            .filter(n -> n.critereId().equals(c.getId()))
                            .sorted(Comparator.comparing(NoteSyntheseVue::eleve))
                            .toList();
                    BlocCompetence b = c.getBloc();
                    return new CritereSyntheseVue(c.getId(), b.getIntitule(), b.getRegroupement(), c.getSavoirFaire(),
                            compter(duCritere, StatutAcquisition.ACQUIS),
                            compter(duCritere, StatutAcquisition.EN_COURS),
                            compter(duCritere, StatutAcquisition.NON_ABORDE),
                            duCritere);
                })
                .toList();

        Map<Long, Integer> ordreCritere = new LinkedHashMap<>();
        criteres.forEach(c -> ordreCritere.put(c.critereId(), ordreCritere.size()));
        Set<Long> avecPhoto = photos.idsElevesAvecPhoto();
        List<EleveSyntheseVue> eleves = duNiveau.stream()
                .map(c -> new EleveSyntheseVue(c.getId(), c.getEleve().getId(), c.getEleve().nomComplet(),
                        c.getEleve().isAutorisationImage() && avecPhoto.contains(c.getEleve().getId()),
                        ateliers.get(c.getId()),
                        notes.stream().filter(e -> e.getCursus().getId().equals(c.getId()))
                                .map(e -> e.getMoniteur().nomComplet()).distinct().toList(),
                        dernieres.stream().filter(n -> n.cursusId().equals(c.getId()))
                                .sorted(Comparator.comparing(n -> ordreCritere.get(n.critereId())))
                                .toList()))
                .toList();

        return new SyntheseVue(seance.getId(), seance.getDateSeance(), seance.getLieu(), seance.getMilieu().name(),
                niveaux, niveau, duNiveau.size(),
                (int) eleves.stream().filter(e -> !e.notes().isEmpty()).count(),
                notes.size(), criteres, eleves);
    }

    private static NoteSyntheseVue vue(List<Evaluation> notesDuCritere) {
        Evaluation derniere = notesDuCritere.getLast();
        List<String> commentaires = notesDuCritere.stream()
                .map(Evaluation::getCommentaire)
                .filter(Objects::nonNull).map(String::trim).filter(t -> !t.isEmpty())
                .collect(Collectors.toList());
        GrilleService.ExerciceNoteVue exercice = GrilleService.ExerciceNoteVue.de(derniere);
        String statutExercice = derniere.getStatutExercice() == null ? null : derniere.getStatutExercice().name();
        String statutAffiche = exercice != null && statutExercice != null ? statutExercice : derniere.getStatut().name();
        return new NoteSyntheseVue(derniere.getCursus().getId(), derniere.getCursus().getEleve().nomComplet(),
                derniere.getCritere().getId(), derniere.getCritere().getBloc().getIntitule(),
                derniere.getCritere().getSavoirFaire(), derniere.getStatut().name(),
                statutExercice, statutAffiche, exercice,
                derniere.getMoniteur().nomComplet(),
                derniere.getSaisiPar() == null ? null : derniere.getSaisiPar().nomComplet(),
                derniere.isEntrainement(), commentaires);
    }

    private static int compter(List<NoteSyntheseVue> notes, StatutAcquisition statut) {
        return (int) notes.stream().filter(n -> n.statutAffiche().equals(statut.name())).count();
    }

    private static String niveauDe(Cursus c) {
        return c.getReferentiel().getNiveau().name();
    }
}
