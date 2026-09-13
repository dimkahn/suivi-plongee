package fr.club.plongee.evaluation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.*;
import fr.club.plongee.referentiel.BlocCompetence;
import fr.club.plongee.referentiel.Critere;
import fr.club.plongee.referentiel.CritereRepository;
import fr.club.plongee.referentiel.Referentiel;
import fr.club.plongee.securite.Utilisateur;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EvaluationService {

    public record Notation(Long critereId, Long seanceId, StatutAcquisition statut,
                           String commentaire, LocalDate dateEvaluation,
                           String referenceClient) {}

    private final EvaluationRepository evaluations;
    private final ValidationCompetenceRepository validations;
    private final CursusRepository cursusRepository;
    private final SeanceRepository seances;
    private final CritereRepository criteres;
    private final UtilisateurRepository utilisateurs;
    private final HabilitationService habilitation;

    public EvaluationService(EvaluationRepository evaluations,
                             ValidationCompetenceRepository validations,
                             CursusRepository cursusRepository,
                             SeanceRepository seances,
                             CritereRepository criteres,
                             UtilisateurRepository utilisateurs,
                             HabilitationService habilitation) {
        this.evaluations = evaluations;
        this.validations = validations;
        this.cursusRepository = cursusRepository;
        this.seances = seances;
        this.criteres = criteres;
        this.utilisateurs = utilisateurs;
        this.habilitation = habilitation;
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
                            + critere.getBloc().getCode() + ".");
        }

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
        return evaluations.save(e);
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
     *  - N2 et N3 : competences a obtenir en milieu naturel, piscines et fosses exclues ;
     *  - la profondeur de la seance doit rester dans l'espace d'evolution du niveau ;
     *  - la seance doit appartenir a la saison du cursus.
     */
    private void verifierSeance(Cursus cursus, BlocCompetence bloc, Seance seance) {
        Referentiel ref = cursus.getReferentiel();

        if (!seance.getSaison().getId().equals(cursus.getSaison().getId())) {
            throw new RegleMetierException("Cette seance n'appartient pas a la saison du cursus.");
        }
        if (ref.isMilieuNaturelExclusif() && seance.getMilieu() != Milieu.NATUREL) {
            throw new RegleMetierException(
                    "Les competences du " + ref.getNiveau() + " doivent etre obtenues en milieu naturel : "
                            + "les piscines et fosses sont exclues quelle qu'en soit la profondeur.");
        }
        if (seance.getProfondeurMax() != null
                && seance.getProfondeurMax() > ref.getProfondeurMaxFormation()) {
            throw new RegleMetierException(
                    "Un eleve en formation " + ref.getNiveau() + " ne peut pas evoluer au-dela de "
                            + ref.getProfondeurMaxFormation() + " m.");
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
                    + " critere(s) non acquis dans " + bloc.getCode() + ".");
        }

        // C6 du N2 : validee en fin de formation, donc apres tous les autres blocs.
        if (bloc.isValiderEnDernier()) {
            List<Long> autres = cursus.getReferentiel().getBlocs().stream()
                    .map(BlocCompetence::getId)
                    .filter(id -> !id.equals(blocId))
                    .toList();
            long dejaValides = validations.findByCursusId(cursusId).stream()
                    .filter(v -> autres.contains(v.getBloc().getId()))
                    .count();
            if (dejaValides < autres.size()) {
                throw new RegleMetierException(bloc.getCode()
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
