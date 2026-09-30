package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.domain.StatutAcquisition;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Participation;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.ParticipationRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Notation en une fois de plusieurs élèves présents à une séance, sur un ou
 * plusieurs critères. Chaque critère coché porte son propre commentaire,
 * obligatoire, repris pour tous les élèves notés.
 *
 * <p>Ce n'est pas une note imposée : la saisie ne fait jamais reculer un élève.
 * <ul>
 *   <li>critère déjà acquis : il reste acquis, seul le commentaire est ajouté ;</li>
 *   <li>critère en cours : il reste en cours, seul le commentaire est ajouté ;</li>
 *   <li>critère non abordé (ou jamais noté) : il passe en cours, avec le commentaire.</li>
 * </ul>
 *
 * <p>Tout ou rien : si un seul élève est refusé (absent, cursus clos, niveau
 * d'encadrement insuffisant, séance en piscine pour un N2...), rien n'est
 * enregistré et le message nomme l'élève. Chaque ligne passe par
 * {@link EvaluationService#noter}, qui porte les règles du MFT.
 */
@Service
public class NotationGroupeeService {

    public record NotationGroupee(List<Long> cursusIds, List<CritereCommente> criteres) {}

    /** Un critère coché et le commentaire écrit pour lui. */
    public record CritereCommente(Long critereId, String commentaire) {}

    /** Ce qui a été fait, pour le message affiché au moniteur. */
    public record BilanNotationGroupee(int eleves, int passesEnCours, int commentairesAjoutes) {}

    private final EvaluationService evaluationService;
    private final EvaluationRepository evaluations;
    private final CursusRepository cursusRepository;
    private final SeanceRepository seances;
    private final ParticipationRepository participations;
    private final HabilitationService habilitation;

    public NotationGroupeeService(EvaluationService evaluationService, EvaluationRepository evaluations,
                                  CursusRepository cursusRepository, SeanceRepository seances,
                                  ParticipationRepository participations, HabilitationService habilitation) {
        this.evaluationService = evaluationService;
        this.evaluations = evaluations;
        this.cursusRepository = cursusRepository;
        this.seances = seances;
        this.participations = participations;
        this.habilitation = habilitation;
    }

    /** Statut à enregistrer : on ne recule jamais, un critère non abordé passe en cours. */
    static StatutAcquisition statutApres(StatutAcquisition actuel) {
        return actuel == StatutAcquisition.ACQUIS ? StatutAcquisition.ACQUIS : StatutAcquisition.EN_COURS;
    }

    @Transactional
    public BilanNotationGroupee noter(Long seanceId, NotationGroupee demande, UtilisateurPrincipal auteur) {
        List<Long> cursusIds = demande.cursusIds() == null ? List.of()
                : demande.cursusIds().stream().distinct().toList();
        if (cursusIds.isEmpty()) throw new RegleMetierException("Choisissez au moins un élève.");
        // Un critère envoyé deux fois : on garde le dernier commentaire.
        Map<Long, String> commentaires = new LinkedHashMap<>();
        if (demande.criteres() != null) {
            for (CritereCommente c : demande.criteres()) {
                if (c == null || c.critereId() == null) continue;
                if (c.commentaire() == null || c.commentaire().isBlank()) {
                    throw new RegleMetierException("Écrivez un commentaire pour chaque critère coché.");
                }
                commentaires.put(c.critereId(), c.commentaire().trim());
            }
        }
        if (commentaires.isEmpty()) throw new RegleMetierException("Choisissez au moins un critère.");

        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));

        int passesEnCours = 0, commentairesAjoutes = 0;
        for (Long cursusId : cursusIds) {
            Cursus cursus = cursusRepository.chargerComplet(cursusId)
                    .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
            String eleve = cursus.getEleve().nomComplet();
            verifierPresent(cursus, seance, eleve);
            if (!habilitation.peutEvaluer(auteur, cursus)) {
                throw new RegleMetierException(eleve + " : vous ne pouvez pas noter cet élève (formation "
                        + cursus.getReferentiel().getNiveau() + " close, ou réservée aux encadrants "
                        + cursus.getReferentiel().getNiveauEncadrantValidation() + " et au-delà).");
            }

            Map<Long, StatutAcquisition> etat = evaluations.etatCourant(cursusId).stream()
                    .collect(Collectors.toMap(e -> e.getCritere().getId(), Evaluation::getStatut));
            for (Map.Entry<Long, String> critere : commentaires.entrySet()) {
                Long critereId = critere.getKey();
                StatutAcquisition avant = etat.getOrDefault(critereId, StatutAcquisition.NON_ABORDE);
                StatutAcquisition apres = statutApres(avant);
                try {
                    evaluationService.noter(cursusId, new EvaluationService.Notation(
                            critereId, seanceId, apres, critere.getValue(), null, null), auteur);
                } catch (RegleMetierException refus) {
                    throw new RegleMetierException(eleve + " : " + refus.getMessage());
                }
                if (avant == apres) commentairesAjoutes++; else passesEnCours++;
            }
        }
        return new BilanNotationGroupee(cursusIds.size(), passesEnCours, commentairesAjoutes);
    }

    private void verifierPresent(Cursus cursus, Seance seance, String eleve) {
        boolean present = participations.findByCursusIdAndSeanceId(cursus.getId(), seance.getId())
                .map(p -> p.getStatut() == Participation.Statut.PRESENT)
                .orElse(false);
        if (!present) {
            throw new RegleMetierException(eleve + " n'est pas noté présent à cette séance : "
                    + "enregistrez d'abord sa présence.");
        }
    }
}
