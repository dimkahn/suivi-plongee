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
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.securite.domain.NiveauEncadrement;
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
     * {@code exerciceLibre} : à défaut, intitulé d'un exercice libre du programme de la séance ;
     * {@code pourMoniteurId} : encadrant au nom duquel un référent du groupe note, null sinon.
     */
    public record Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                           String commentaire, LocalDate dateEvaluation,
                           String referenceClient, Long exerciceId, String exerciceLibre,
                           Long pourMoniteurId) {

        public Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                        String commentaire, LocalDate dateEvaluation, String referenceClient,
                        Long exerciceId, String exerciceLibre) {
            this(critereId, seanceId, statut, commentaire, dateEvaluation, referenceClient,
                    exerciceId, exerciceLibre, null);
        }

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
    private final GroupeEntrainementRepository groupes;

    public EvaluationService(EvaluationRepository evaluations,
                             ValidationCompetenceRepository validations,
                             CursusRepository cursusRepository,
                             SeanceRepository seances,
                             CritereRepository criteres,
                             UtilisateurRepository utilisateurs,
                             HabilitationService habilitation,
                             ParticipationRepository participations,
                             ExerciceCompetenceRepository exercicesCompetence,
                             ExerciceSeanceRepository exercicesSeance,
                             GroupeEntrainementRepository groupes) {
        this.groupes = groupes;
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

        Utilisateur saisiPar = utilisateurs.findById(auteur.id()).orElseThrow();
        Utilisateur moniteur = notation.pourMoniteurId() == null || notation.pourMoniteurId().equals(auteur.id())
                ? saisiPar
                : moniteurRemplace(cursus, notation.pourMoniteurId(), saisiPar);

        Evaluation e = new Evaluation();
        e.setCursus(cursus);
        e.setCritere(critere);
        e.setSeance(seance);
        e.setMoniteur(moniteur);          // l'auteur connecté, ou celui qu'un référent remplace
        if (moniteur != saisiPar) e.setSaisiPar(saisiPar);
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

    /**
     * Noter au nom d'un autre encadrant (choix du club, 2026) : réservé aux
     * référents du groupe d'entraînement de l'élève, pour rattraper la note
     * d'un encadrant qui ne l'a pas saisie. La note porte le nom de cet
     * encadrant, qui doit lui-même avoir le niveau pour noter ce brevet ; le
     * référent reste tracé comme auteur de la saisie.
     */
    private Utilisateur moniteurRemplace(Cursus cursus, Long moniteurId, Utilisateur referent) {
        List<Long> referents = groupes.referentsDeLEleve(cursus.getSaison().getId(), cursus.getEleve().getId());
        if (!referents.contains(referent.getId())) {
            throw new RegleMetierException("Seuls les référents du groupe de " + cursus.getEleve().nomComplet()
                    + " peuvent noter au nom d'un autre encadrant.");
        }
        Utilisateur moniteur = utilisateurs.findById(moniteurId)
                .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable"));
        NiveauEncadrement requis = cursus.getReferentiel().getNiveauEncadrantValidation();
        if (!moniteur.isActif() || !moniteur.estMoniteur() || !moniteur.getNiveauEncadrement().auMoins(requis)) {
            throw new RegleMetierException(moniteur.nomComplet() + " ne peut pas noter le "
                    + cursus.getReferentiel().getNiveau() + " : réservé aux encadrants "
                    + requis + " et au-delà.");
        }
        return moniteur;
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

    /** Compétence prête à être validée : toutes les règles du MFT et du club sont tenues. */
    public record Validable(Cursus cursus, BlocCompetence bloc) {}

    /**
     * Exercices de maîtrise attendus pour valider une compétence (choix du
     * club, 2026) : {@code parObligatoires} quand la compétence a des
     * exercices de maîtrise obligatoires (tous à acquérir), sinon un seul
     * exercice de maîtrise suffit ; {@code restants} : ceux qui manquent,
     * vide une fois l'exigence tenue (ou sans exercice de maîtrise).
     */
    public record ExigenceMaitrise(boolean parObligatoires, List<ExerciceCompetence> restants) {
        public boolean satisfaite() {
            return restants.isEmpty();
        }
    }

    @Transactional
    public ValidationCompetence validerBloc(Long cursusId, Long blocId,
                                            String commentaire, UtilisateurPrincipal auteur) {
        Validable validable = verifierValidable(cursusId, blocId, auteur);
        ValidationCompetence v = new ValidationCompetence();
        v.setCursus(validable.cursus());
        v.setBloc(validable.bloc());
        v.setMoniteur(utilisateurs.findById(auteur.id()).orElseThrow());
        v.setDateValidation(LocalDate.now());
        v.setCommentaire(commentaire);
        return validations.save(v);
    }

    /**
     * Règles de validation d'une compétence, sans rien enregistrer : aussi
     * vérifiées avant chaque accord d'un encadrant du groupe
     * ({@link ValidationParAccordService}).
     */
    @Transactional(readOnly = true)
    public Validable verifierValidable(Long cursusId, Long blocId, UtilisateurPrincipal auteur) {
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
        verifierMaitriseAcquise(cursusId, bloc);

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
        return new Validable(cursus, bloc);
    }

    /**
     * Choix du club (2026) : une compétence qui a des exercices de maîtrise
     * obligatoires ne se valide qu'une fois tous acquis, hors entraînement ;
     * sans exercice obligatoire, il en faut au moins un de maîtrise (de la
     * base ou exercice libre). Une compétence sans exercice de maîtrise (bloc
     * transverse, révision sans base d'exercices) se valide comme avant.
     */
    private void verifierMaitriseAcquise(Long cursusId, BlocCompetence bloc) {
        ExigenceMaitrise exigence = exigenceMaitrise(cursusId, bloc);
        if (exigence.satisfaite()) return;
        String lesquels = exigence.restants().stream().map(ExerciceCompetence::getNumero)
                .collect(Collectors.joining(", "));
        if (exigence.parObligatoires()) {
            throw new RegleMetierException(bloc.getIntitule()
                    + " ne se valide qu'avec tous ses exercices de maîtrise obligatoires acquis (il manque "
                    + lesquels + ") : notez-les acquis dans la grille avant de valider.");
        }
        throw new RegleMetierException(bloc.getIntitule()
                + " ne se valide qu'avec au moins un exercice de maîtrise acquis (" + lesquels
                + ") : notez-le acquis dans la grille avant de valider.");
    }

    /**
     * Exercices de maîtrise qui manquent à l'élève pour valider la
     * compétence. Un exercice obligatoire désactivé depuis n'est plus exigé :
     * il ne doit pas rendre la compétence impossible à valider.
     */
    @Transactional(readOnly = true)
    public ExigenceMaitrise exigenceMaitrise(Long cursusId, BlocCompetence bloc) {
        List<ExerciceCompetence> deMaitrise = exercicesCompetence.maitriseDuBloc(bloc.getId());
        if (deMaitrise.isEmpty()) return new ExigenceMaitrise(false, List.of());
        List<Long> acquis = evaluations.exercicesDeMaitriseAcquis(cursusId, bloc.getId());
        List<ExerciceCompetence> obligatoires = deMaitrise.stream().filter(ExerciceCompetence::isObligatoire).toList();
        if (!obligatoires.isEmpty()) {
            return new ExigenceMaitrise(true, obligatoires.stream().filter(e -> !acquis.contains(e.getId())).toList());
        }
        boolean uneAcquise = !acquis.isEmpty()
                || evaluations.compterExercicesLibresDeMaitriseAcquis(cursusId, bloc.getId()) > 0;
        return new ExigenceMaitrise(false, uneAcquise ? List.of() : deMaitrise);
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
