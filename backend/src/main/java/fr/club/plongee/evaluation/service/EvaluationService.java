package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.domain.StatutAcquisition;
import fr.club.plongee.evaluation.domain.ValidationCompetence;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.*;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.domain.PhaseExercice;
import fr.club.plongee.referentiel.repository.CritereRepository;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EvaluationService {

    /**
     * {@code exerciceId} : exercice de la base sur lequel le critère est noté, facultatif ;
     * {@code exerciceLibre} : à défaut, intitulé d'un exercice libre du programme de la séance.
     */
    public record Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                           String commentaire, LocalDate dateEvaluation,
                           String referenceClient, Long exerciceId, String exerciceLibre) {

        public Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                        String commentaire, LocalDate dateEvaluation, String referenceClient) {
            this(critereId, seanceId, statut, commentaire, dateEvaluation, referenceClient, null, null);
        }

        public Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                        String commentaire, LocalDate dateEvaluation, String referenceClient, Long exerciceId) {
            this(critereId, seanceId, statut, commentaire, dateEvaluation, referenceClient, exerciceId, null);
        }
    }

    private final EvaluationRepository evaluations;
    private final ValidationCompetenceRepository validations;
    private final CursusRepository cursusRepository;
    private final SeanceRepository seances;
    private final CritereRepository criteres;
    private final UtilisateurRepository utilisateurs;
    private final HabilitationService habilitation;
    private final ParticipationRepository participations;
    private final ExerciceCompetenceRepository exercicesCompetence;
    private final ExerciceSeanceRepository exercicesSeance;

    public EvaluationService(EvaluationRepository evaluations,
                             ValidationCompetenceRepository validations,
                             CursusRepository cursusRepository,
                             SeanceRepository seances,
                             CritereRepository criteres,
                             UtilisateurRepository utilisateurs,
                             HabilitationService habilitation,
                             ParticipationRepository participations,
                             ExerciceCompetenceRepository exercicesCompetence,
                             ExerciceSeanceRepository exercicesSeance) {
        this.exercicesCompetence = exercicesCompetence;
        this.exercicesSeance = exercicesSeance;
        this.evaluations = evaluations;
        this.validations = validations;
        this.cursusRepository = cursusRepository;
        this.seances = seances;
        this.criteres = criteres;
        this.utilisateurs = utilisateurs;
        this.habilitation = habilitation;
        this.participations = participations;
    }

    // ----------------------------------------------------------------
    //  Saisie
    // ----------------------------------------------------------------

    @Transactional
    public Evaluation noter(Long cursusId, Notation notation, UtilisateurPrincipal auteur) {
        // Idempotence : une saisie hors ligne rejouee retrouve son enregistrement
        // d'origine au lieu d'en creer un second.
        if (notation.referenceClient() != null) {
            var existante = evaluations.findByReferenceClient(notation.referenceClient());
            if (existante.isPresent()) return existante.get();
        }

        Cursus cursus = cursus(cursusId);
        Critere critere = criteres.findById(notation.critereId())
                .orElseThrow(() -> new RessourceIntrouvableException("Critere introuvable"));

        verifierCoherenceReferentiel(cursus, critere);

        Seance seance = null;
        if (notation.seanceId() != null) {
            seance = seances.findById(notation.seanceId())
                    .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
            verifierSeance(cursus, critere.getBloc(), seance);
        } else if (!critere.getBloc().isEvaluationTransverse()) {
            throw new RegleMetierException(
                    "Une seance doit etre indiquee pour la competence "
                            + critere.getBloc().getIntitule() + ".");
        }

        // Compétence transverse sans séance : c'est alors la date saisie qui ne doit pas être future.
        if (notation.dateEvaluation() != null && notation.dateEvaluation().isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("Une évaluation ne peut pas être datée dans le futur.");
        }

        boolean entrainement = estEntrainement(cursus.getReferentiel(), seance);
        ExerciceCompetence exercice = exercice(notation.exerciceId(), critere);
        ExerciceSeance libre = exercice == null ? exerciceLibre(notation.exerciceLibre(), seance, critere) : null;
        PhaseExercice phase = exercice != null ? exercice.getPhase() : libre != null ? libre.getPhase() : null;
        StatutAcquisition actuel = evaluations
                .findFirstByCursusIdAndCritereIdAndEntrainementOrderByIdDesc(cursus.getId(), critere.getId(), entrainement)
                .map(Evaluation::getStatut)
                .orElse(StatutAcquisition.NON_ABORDE);
        List<ExerciceCompetence> deMaitrise = exercicesCompetence.maitriseDuCritere(critere.getId());
        verifierExerciceDeMaitrise(critere, notation.statut(), actuel, phase, deMaitrise);

        Utilisateur moniteur = utilisateurs.findById(auteur.id()).orElseThrow();

        Evaluation e = new Evaluation();
        e.setCursus(cursus);
        e.setCritere(critere);
        e.setSeance(seance);
        e.setMoniteur(moniteur);          // jamais un id transmis par le client
        // Un exercice libre suit toujours la règle des phases : le moniteur
        // l'a relié au critère et lui a donné sa phase.
        e.setStatut(statutDuCritere(notation.statut(), actuel, phase, !deMaitrise.isEmpty() || libre != null));
        e.setStatutExercice(phase == null ? null : notation.statut());
        if (libre != null) {
            e.setExerciceLibre(libre.getIntitule());
            e.setPhaseExercice(libre.getPhase());
        }
        e.setCommentaire(notation.commentaire());
        e.setDateEvaluation(notation.dateEvaluation() != null
                ? notation.dateEvaluation()
                : (seance != null ? seance.getDateSeance() : LocalDate.now()));
        e.setReferenceClient(notation.referenceClient());
        e.setEntrainement(entrainement);
        e.setExercice(exercice);
        return evaluations.save(e);
    }

    /** L'exercice noté doit travailler le critère. Un exercice désactivé depuis reste accepté (saisie hors ligne). */
    private ExerciceCompetence exercice(Long exerciceId, Critere critere) {
        if (exerciceId == null) return null;
        ExerciceCompetence exercice = exercicesCompetence.findById(exerciceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Exercice introuvable"));
        if (!exercice.travaille(critere)) {
            throw new RegleMetierException("L'exercice « " + exercice.libelle()
                    + " » ne travaille pas le critère « " + critere.getSavoirFaire() + " ».");
        }
        return exercice;
    }

    /**
     * Exercice libre du programme de la séance (choix du club, 2026),
     * retrouvé par son intitulé : le programme se remplace d'un bloc, et une
     * note prise hors ligne doit survivre à ce remplacement. Il doit
     * travailler le critère noté et avoir une phase.
     */
    private ExerciceSeance exerciceLibre(String intitule, Seance seance, Critere critere) {
        if (intitule == null || intitule.isBlank()) return null;
        if (seance == null) {
            throw new RegleMetierException("Un exercice libre se note sur la séance de son programme.");
        }
        List<ExerciceSeance> candidats = exercicesSeance.deLaSeance(seance.getId()).stream()
                .filter(x -> x.getExerciceCompetence() == null && x.getIntitule().equals(intitule.trim()))
                .toList();
        if (candidats.isEmpty()) {
            throw new RegleMetierException("L'exercice « " + intitule.trim()
                    + " » n'est plus au programme de la séance.");
        }
        ExerciceSeance libre = candidats.stream().filter(x -> x.getCriteres().stream().anyMatch(c -> c.getId().equals(critere.getId()))).findFirst()
                .orElseThrow(() -> new RegleMetierException("L'exercice « " + intitule.trim()
                        + " » ne travaille pas le critère « " + critere.getSavoirFaire() + " »."));
        if (libre.getPhase() == null) {
            throw new RegleMetierException("Donnez une phase (initiation, perfectionnement ou maîtrise) à l'exercice « "
                    + libre.getIntitule() + " » dans le programme de la séance avant de noter dessus.");
        }
        return libre;
    }

    /**
     * Base d'exercices (choix du club, 2026) : un critère relié à des
     * exercices de maîtrise ne passe pas à « acquis » sans exercice. Un
     * critère déjà acquis peut recevoir une note acquise sans exercice
     * (simple commentaire, notation groupée) : il ne change pas d'état.
     * Sur un exercice (de la base ou libre) d'initiation ou de
     * perfectionnement, « acquis » est accepté : c'est l'exercice qui est
     * acquis (voir {@link #statutDuCritere}).
     */
    private void verifierExerciceDeMaitrise(Critere critere, StatutAcquisition statut, StatutAcquisition actuel,
                                            PhaseExercice phase, List<ExerciceCompetence> deMaitrise) {
        if (statut != StatutAcquisition.ACQUIS || phase != null) return;
        if (deMaitrise.isEmpty() || actuel == StatutAcquisition.ACQUIS) return;
        String lesquels = " (" + deMaitrise.stream().map(ExerciceCompetence::getNumero)
                .collect(Collectors.joining(", ")) + ")";
        throw new RegleMetierException("« " + critere.getSavoirFaire()
                + " » ne passe à acquis que sur un exercice de maîtrise" + lesquels
                + " : indiquez l'exercice réalisé.");
    }

    /**
     * État du critère après une note sur un exercice (choix du club, 2026) :
     * la note dit où en est l'élève dans l'exercice, et seul un exercice de
     * maîtrise fait l'état du critère. Toute autre note sur un exercice
     * (initiation ou perfectionnement même acquis, exercice non abordé) met le
     * critère en cours, et ne fait jamais reculer un critère déjà acquis. Sans
     * exercice, ou pour un critère sans exercice de maîtrise noté sur la base,
     * la note est l'état du critère, comme avant.
     */
    static StatutAcquisition statutDuCritere(StatutAcquisition demande, StatutAcquisition actuel,
                                             PhaseExercice phase, boolean regleDesPhases) {
        if (phase == null || !regleDesPhases) return demande;
        if (phase == PhaseExercice.MAITRISE && demande != StatutAcquisition.NON_ABORDE) return demande;
        if (actuel == StatutAcquisition.ACQUIS) return StatutAcquisition.ACQUIS;
        return StatutAcquisition.EN_COURS;
    }

    /**
     * N2 et N3 : les competences s'obtiennent en milieu naturel ; une note prise
     * en piscine ou en fosse n'est qu'un suivi d'entrainement, a part.
     */
    public static boolean estEntrainement(Referentiel ref, Seance seance) {
        return ref.isMilieuNaturelExclusif() && seance != null && seance.getMilieu() != Milieu.NATUREL;
    }

    /** Empeche de noter un critere qui n'appartient pas au referentiel du cursus. */
    private void verifierCoherenceReferentiel(Cursus cursus, Critere critere) {
        Long attendu = cursus.getReferentiel().getId();
        Long reel = critere.getBloc().getReferentiel().getId();
        if (!attendu.equals(reel)) {
            throw new RegleMetierException(
                    "Ce critere n'appartient pas au referentiel " + cursus.getReferentiel().getNiveau()
                            + " suivi par l'eleve.");
        }
    }

    /**
     * Regles du MFT attachees a la seance :
     *  - la seance doit appartenir a la saison du cursus ;
     *  - l'eleve doit y etre note present (choix du club, 2026).
     * N2 et N3 en piscine ou en fosse : accepte, mais comme entrainement
     * (voir {@link #estEntrainement}), sans effet sur l'acquisition.
     */
    private void verifierSeance(Cursus cursus, BlocCompetence bloc, Seance seance) {
        seance.verifierQueLaSeanceAEuLieu("noter une compétence");

        if (!seance.getSaison().getId().equals(cursus.getSaison().getId())) {
            throw new RegleMetierException("Cette seance n'appartient pas a la saison du cursus.");
        }
        boolean present = participations.findByCursusIdAndSeanceId(cursus.getId(), seance.getId())
                .map(p -> p.getStatut() == Participation.Statut.PRESENT)
                .orElse(false);
        if (!present) {
            throw new RegleMetierException(cursus.getEleve().nomComplet()
                    + " n'est pas noté présent à la séance du "
                    + seance.getDateSeance().format(Calendrier.DATE_FR)
                    + " : renseignez d'abord sa présence dans la feuille de présence.");
        }
    }

    // ----------------------------------------------------------------
    //  Validation d'un bloc de competences
    // ----------------------------------------------------------------

    @Transactional
    public ValidationCompetence validerBloc(Long cursusId, Long blocId,
                                            String commentaire, UtilisateurPrincipal auteur) {
        Cursus cursus = cursus(cursusId);
        BlocCompetence bloc = cursus.getReferentiel().getBlocs().stream()
                .filter(b -> b.getId().equals(blocId))
                .findFirst()
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Cette competence n'appartient pas au referentiel du cursus."));

        if (!habilitation.peutValiderBloc(auteur, bloc)) {
            throw new RegleMetierException("La validation des competences "
                    + cursus.getReferentiel().getNiveau() + " est reservee aux encadrants "
                    + cursus.getReferentiel().getNiveauEncadrantValidation() + " et au-dela.");
        }
        if (validations.existsByCursusIdAndBlocId(cursusId, blocId)) {
            throw new RegleMetierException("Cette competence est deja validee.");
        }

        long total = criteres.compterParBloc(blocId);
        long acquis = evaluations.compterAcquisDuBloc(cursusId, blocId);
        if (acquis < total) {
            throw new RegleMetierException("Il reste " + (total - acquis)
                    + " critere(s) non acquis dans " + bloc.getIntitule() + ".");
        }

        // Bloc marque valider_en_dernier : validee en fin de formation, apres tous les autres blocs.
        if (bloc.isValiderEnDernier()) {
            List<Long> autres = cursus.getReferentiel().getBlocs().stream()
                    .map(BlocCompetence::getId)
                    .filter(id -> !id.equals(blocId))
                    .toList();
            long dejaValides = validations.findByCursusId(cursusId).stream()
                    .filter(v -> autres.contains(v.getBloc().getId()))
                    .count();
            if (dejaValides < autres.size()) {
                throw new RegleMetierException(bloc.getIntitule()
                        + " doit etre validee en fin de formation, apres les autres competences.");
            }
        }

        ValidationCompetence v = new ValidationCompetence();
        v.setCursus(cursus);
        v.setBloc(bloc);
        v.setMoniteur(utilisateurs.findById(auteur.id()).orElseThrow());
        v.setDateValidation(LocalDate.now());
        v.setCommentaire(commentaire);
        return validations.save(v);
    }

    // ----------------------------------------------------------------
    //  Lecture
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public Map<Long, Evaluation> etatCourant(Long cursusId) {
        return evaluations.etatCourant(cursusId).stream()
                .collect(Collectors.toMap(e -> e.getCritere().getId(), Function.identity()));
    }

    /** Suivi d'entrainement en piscine et fosse (N2/N3) : derniere note par critere. */
    @Transactional(readOnly = true)
    public Map<Long, Evaluation> etatEntrainement(Long cursusId) {
        return evaluations.etatEntrainement(cursusId).stream()
                .collect(Collectors.toMap(e -> e.getCritere().getId(), Function.identity()));
    }

    @Transactional(readOnly = true)
    public List<Evaluation> historique(Long cursusId, Long critereId) {
        return evaluations.historique(cursusId, critereId);
    }

    @Transactional(readOnly = true)
    public List<Evaluation> historiqueCursus(Long cursusId) {
        return evaluations.historiqueCursus(cursusId);
    }

    private Cursus cursus(Long id) {
        Cursus cursus = cursusRepository.chargerComplet(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
        if (!cursus.modifiable()) {
            throw new RegleMetierException(
                    "Ce cursus n'est plus modifiable (statut " + cursus.getStatut() + ").");
        }
        return cursus;
    }
}
