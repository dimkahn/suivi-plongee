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

    /** {@code exerciceId} : exercice de la base sur lequel le critère est noté, facultatif. */
    public record Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                           String commentaire, LocalDate dateEvaluation,
                           String referenceClient, Long exerciceId) {

        public Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                        String commentaire, LocalDate dateEvaluation, String referenceClient) {
            this(critereId, seanceId, statut, commentaire, dateEvaluation, referenceClient, null);
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

    public EvaluationService(EvaluationRepository evaluations,
                             ValidationCompetenceRepository validations,
                             CursusRepository cursusRepository,
                             SeanceRepository seances,
                             CritereRepository criteres,
                             UtilisateurRepository utilisateurs,
                             HabilitationService habilitation,
                             ParticipationRepository participations,
                             ExerciceCompetenceRepository exercicesCompetence) {
        this.exercicesCompetence = exercicesCompetence;
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
        verifierExerciceDeMaitrise(cursus, critere, notation.statut(), entrainement, exercice);

        Utilisateur moniteur = utilisateurs.findById(auteur.id()).orElseThrow();

        Evaluation e = new Evaluation();
        e.setCursus(cursus);
        e.setCritere(critere);
        e.setSeance(seance);
        e.setMoniteur(moniteur);          // jamais un id transmis par le client
        e.setStatut(notation.statut());
        e.setCommentaire(notation.commentaire());
        e.setDateEvaluation(notation.dateEvaluation() != null
                ? notation.dateEvaluation()
                : (seance != null ? seance.getDateSeance() : LocalDate.now()));
        e.setReferenceClient(notation.referenceClient());
        e.setEntrainement(entrainement);
        e.setExercice(exercice);
        return evaluations.save(e);
    }

    /** L'exercice noté doit travailler la compétence du critère. Un exercice désactivé depuis reste accepté (saisie hors ligne). */
    private ExerciceCompetence exercice(Long exerciceId, Critere critere) {
        if (exerciceId == null) return null;
        ExerciceCompetence exercice = exercicesCompetence.findById(exerciceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Exercice introuvable"));
        if (!exercice.getBloc().getId().equals(critere.getBloc().getId())) {
            throw new RegleMetierException("L'exercice « " + exercice.libelle()
                    + " » ne travaille pas la compétence « " + critere.getBloc().getIntitule() + " ».");
        }
        return exercice;
    }

    /**
     * Base d'exercices (choix du club, 2026) : un critère d'une compétence qui
     * a des exercices ne passe à « acquis » que sur un exercice de maîtrise.
     * Un critère déjà acquis peut recevoir une note acquise sans exercice
     * (simple commentaire, notation groupée) : il ne change pas d'état.
     */
    private void verifierExerciceDeMaitrise(Cursus cursus, Critere critere, StatutAcquisition statut,
                                            boolean entrainement, ExerciceCompetence exercice) {
        if (statut != StatutAcquisition.ACQUIS) return;
        if (exercice != null && exercice.getPhase() == PhaseExercice.MAITRISE) return;
        BlocCompetence bloc = critere.getBloc();
        if (!exercicesCompetence.existsByBlocIdAndActifTrue(bloc.getId())) return;
        boolean dejaAcquis = evaluations
                .findFirstByCursusIdAndCritereIdAndEntrainementOrderByIdDesc(cursus.getId(), critere.getId(), entrainement)
                .map(e -> e.getStatut() == StatutAcquisition.ACQUIS)
                .orElse(false);
        if (dejaAcquis) return;

        String maitrise = exercicesCompetence.parReferentiel(bloc.getReferentiel().getId()).stream()
                .filter(x -> x.getBloc().getId().equals(bloc.getId()))
                .filter(x -> x.isActif() && x.getPhase() == PhaseExercice.MAITRISE)
                .map(ExerciceCompetence::getNumero)
                .collect(Collectors.joining(", "));
        String lesquels = maitrise.isEmpty() ? "" : " (" + maitrise + ")";
        if (exercice == null) {
            throw new RegleMetierException("« " + critere.getSavoirFaire()
                    + " » ne passe à acquis que sur un exercice de maîtrise" + lesquels
                    + " : indiquez l'exercice réalisé.");
        }
        throw new RegleMetierException("L'exercice « " + exercice.libelle() + " » est un exercice de "
                + exercice.getPhase().libelle().toLowerCase() + " : seul un exercice de maîtrise" + lesquels
                + " fait passer un critère à acquis. Notez-le « en cours ».");
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
