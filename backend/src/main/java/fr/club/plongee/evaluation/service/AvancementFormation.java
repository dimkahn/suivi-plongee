package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.domain.StatutAcquisition;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Avancement global d'une formation, pour la barre de progression d'« Infos élèves ».
 * Même règle que la fiche de synthèse de l'élève : une compétence validée compte
 * pour tous ses critères, sinon ses critères acquis (milieu naturel seul pour un
 * N2/N3, l'entraînement en piscine ou fosse ne comptant pas).
 */
@Service
public class AvancementFormation {

    /** {@code pourcentage} : critères effectués sur le total, arrondi ; 0 sans critère. */
    public record Avancement(int pourcentage, int criteresEffectues, int criteresTotal,
                             int competencesValidees, int competences) {}

    private final CursusRepository cursusRepository;
    private final EvaluationService evaluationService;
    private final ValidationCompetenceRepository validations;

    public AvancementFormation(CursusRepository cursusRepository, EvaluationService evaluationService,
                               ValidationCompetenceRepository validations) {
        this.cursusRepository = cursusRepository;
        this.evaluationService = evaluationService;
        this.validations = validations;
    }

    @Transactional(readOnly = true)
    public Avancement de(Long cursusId) {
        Cursus cursus = cursusRepository.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
        Map<Long, Evaluation> etat = evaluationService.etatCourant(cursusId);
        Set<Long> validees = validations.findByCursusId(cursusId).stream()
                .map(v -> v.getBloc().getId())
                .collect(Collectors.toSet());

        int effectues = 0;
        int total = 0;
        int competencesValidees = 0;
        int competences = 0;
        for (BlocCompetence bloc : cursus.getReferentiel().getBlocs()) {
            int criteres = bloc.getCriteres().size();
            total += criteres;
            competences++;
            if (validees.contains(bloc.getId())) {
                effectues += criteres;
                competencesValidees++;
            } else {
                effectues += (int) bloc.getCriteres().stream()
                        .map(c -> etat.get(c.getId()))
                        .filter(e -> e != null && e.getStatut() == StatutAcquisition.ACQUIS)
                        .count();
            }
        }
        int pourcentage = total > 0 ? Math.round(100f * effectues / total) : 0;
        return new Avancement(pourcentage, effectues, total, competencesValidees, competences);
    }
}
