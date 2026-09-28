package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.delivrance.repository.DelivranceRepository;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.domain.AdhesionSaison;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.repository.AdhesionSaisonRepository;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.ParticipationRepository;
import fr.club.plongee.referentiel.domain.Niveau;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Corriger la formation choisie à l'inscription : changer le niveau préparé,
 * ou repasser l'élève en simple maintien (adhésion sans formation).
 *
 * <p>Un cursus est figé sur une version du référentiel, et ses évaluations,
 * validations et délivrance portent sur les critères et blocs de cette
 * version : dès qu'il y en a une, on ne change plus rien (sinon l'historique
 * pointerait vers un autre référentiel). Les présences, elles, ne dépendent
 * pas du référentiel : elles suivent un changement de niveau, mais
 * empêchent le passage en maintien, qui supprimerait le cursus qui les porte.
 */
@Service
public class ChangementFormationService {

    private final CursusRepository cursus;
    private final ReferentielRepository referentiels;
    private final AdhesionSaisonRepository adhesions;
    private final EvaluationRepository evaluations;
    private final ValidationCompetenceRepository validations;
    private final DelivranceRepository delivrances;
    private final ParticipationRepository participations;

    public ChangementFormationService(CursusRepository cursus, ReferentielRepository referentiels,
                                      AdhesionSaisonRepository adhesions, EvaluationRepository evaluations,
                                      ValidationCompetenceRepository validations, DelivranceRepository delivrances,
                                      ParticipationRepository participations) {
        this.cursus = cursus;
        this.referentiels = referentiels;
        this.adhesions = adhesions;
        this.evaluations = evaluations;
        this.validations = validations;
        this.delivrances = delivrances;
        this.participations = participations;
    }

    /** Sans effet si le niveau est déjà celui du cursus. */
    @Transactional
    public void changerNiveau(Cursus c, Niveau niveau) {
        if (c.getReferentiel().getNiveau() == niveau) return;
        verifierSansNotation(c, "changer de niveau");
        Referentiel referentiel = referentiels.versionCourante(niveau)
                .orElseThrow(() -> new RegleMetierException("Aucun référentiel actif pour le niveau " + niveau + "."));
        if (cursus.existsByEleveIdAndSaisonIdAndReferentielId(c.getEleve().getId(), c.getSaison().getId(),
                referentiel.getId())) {
            throw new RegleMetierException("Cet élève est déjà inscrit en " + niveau + " pour cette saison.");
        }
        c.setReferentiel(referentiel);
    }

    /**
     * Le cursus disparaît au profit d'une adhésion sans formation. Le groupe
     * d'entraînement de l'élève ne change pas (il est porté par la saison).
     */
    @Transactional
    public AdhesionSaison passerEnMaintien(Long cursusId) {
        Cursus c = cursus.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
        verifierSansNotation(c, "passer en maintien");
        if (participations.existsByCursusId(cursusId)) {
            throw new RegleMetierException("Des présences sont déjà notées pour cette formation : "
                    + "la passer en maintien les effacerait. Passez-la plutôt en « Abandon ».");
        }
        Long eleveId = c.getEleve().getId();
        Long saisonId = c.getSaison().getId();
        cursus.delete(c);
        cursus.flush();
        if (cursus.existsByEleveIdAndSaisonId(eleveId, saisonId)) {
            throw new RegleMetierException("Cet élève suit une autre formation cette saison : "
                    + "passez plutôt celle-ci en « Abandon ».");
        }
        return adhesions.parSaison(saisonId).stream().filter(a -> a.getEleve().getId().equals(eleveId)).findFirst()
                .orElseGet(() -> {
                    AdhesionSaison a = new AdhesionSaison();
                    a.setEleve(c.getEleve());
                    a.setSaison(c.getSaison());
                    return adhesions.save(a);
                });
    }

    private void verifierSansNotation(Cursus c, String quoi) {
        if (evaluations.existsByCursusId(c.getId()) || validations.existsByCursusId(c.getId())
                || delivrances.existsByCursusId(c.getId())) {
            throw new RegleMetierException("Des compétences ont déjà été notées pour cette formation : "
                    + "impossible de " + quoi + ", l'historique porte sur ce référentiel. "
                    + "Passez-la en « Abandon » et inscrivez l'élève au bon niveau.");
        }
    }
}
