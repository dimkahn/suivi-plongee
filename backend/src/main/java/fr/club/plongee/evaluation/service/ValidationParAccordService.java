package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.evaluation.domain.AccordValidation;
import fr.club.plongee.evaluation.domain.AccordValidationCritere;
import fr.club.plongee.evaluation.repository.AccordValidationCritereRepository;
import fr.club.plongee.evaluation.repository.AccordValidationRepository;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Validation d'une compétence par l'accord des encadrants du groupe
 * d'entraînement de l'élève (choix du club, 2026), comme un vote : chaque
 * encadrant du groupe habilité au niveau propose ou accepte la validation ;
 * elle est faite dès que la moitié d'entre eux l'ont acceptée. Un référent du
 * groupe la valide seul. Un élève sans groupe, ou dont le groupe n'a aucun
 * encadrant habilité, se valide par un seul encadrant, comme avant.
 */
@Service
public class ValidationParAccordService {

    /** {@code accordsRequis} : 0 quand la validation n'attend aucun accord (référent, élève sans groupe). */
    public record EtatValidation(boolean validee, int accords, int accordsRequis) {}

    private final EvaluationService evaluations;
    private final AccordValidationRepository accords;
    private final GroupeEntrainementRepository groupes;
    private final UtilisateurRepository utilisateurs;

    private final AccordValidationCritereRepository accordsCritere;

    public ValidationParAccordService(EvaluationService evaluations, AccordValidationRepository accords,
                                      AccordValidationCritereRepository accordsCritere,
                                      GroupeEntrainementRepository groupes, UtilisateurRepository utilisateurs) {
        this.accordsCritere = accordsCritere;
        this.evaluations = evaluations;
        this.accords = accords;
        this.groupes = groupes;
        this.utilisateurs = utilisateurs;
    }

    /** Accords nécessaires : la moitié des votants, arrondie au-dessus (2 sur 3, 2 sur 4). */
    public static int accordsRequis(int votants) {
        return (votants + 1) / 2;
    }

    /**
     * Encadrants attitrés du groupe de l'élève qui peuvent valider ce brevet
     * (actifs, moniteurs, niveau d'encadrement suffisant) ; vide sans groupe.
     */
    @Transactional(readOnly = true)
    public List<Utilisateur> votants(Cursus cursus) {
        NiveauEncadrement requis = cursus.getReferentiel().getNiveauEncadrantValidation();
        return groupes.encadrantsDeLEleve(cursus.getSaison().getId(), cursus.getEleve().getId()).stream()
                .filter(u -> u.isActif() && u.estMoniteur() && u.getNiveauEncadrement() != null
                        && u.getNiveauEncadrement().auMoins(requis))
                .sorted(Comparator.comparing(Utilisateur::getId))
                .toList();
    }

    /** Propose ou accepte la validation d'une compétence ; la valide si l'accord fait la moitié, ou si l'auteur est référent. */
    @Transactional
    public EtatValidation accepter(Long cursusId, Long blocId, String commentaire, UtilisateurPrincipal auteur) {
        EvaluationService.Validable validable = evaluations.verifierValidable(cursusId, blocId, auteur);
        return voter(validable.cursus(), auteur, "« " + validable.bloc().getIntitule() + " »",
                accords.existsByCursusIdAndBlocIdAndMoniteurId(cursusId, blocId, auteur.id()),
                moniteur -> {
                    AccordValidation accord = new AccordValidation();
                    accord.setCursus(validable.cursus());
                    accord.setBloc(validable.bloc());
                    accord.setMoniteur(moniteur);
                    accord.setDateAccord(LocalDate.now());
                    accords.save(accord);
                },
                ids -> (int) accords.duCursus(cursusId).stream()
                        .filter(a -> a.getBloc().getId().equals(blocId) && ids.contains(a.getMoniteur().getId()))
                        .count(),
                () -> evaluations.validerBloc(cursusId, blocId, commentaire, auteur));
    }

    /** Même vote pour un critère technique seul (choix du club, 2026). */
    @Transactional
    public EtatValidation accepterCritere(Long cursusId, Long critereId, UtilisateurPrincipal auteur) {
        EvaluationService.CritereValidable validable = evaluations.verifierCritereValidable(cursusId, critereId, auteur);
        return voter(validable.cursus(), auteur, "le critère « " + validable.critere().getSavoirFaire() + " »",
                accordsCritere.existsByCursusIdAndCritereIdAndMoniteurId(cursusId, critereId, auteur.id()),
                moniteur -> {
                    AccordValidationCritere accord = new AccordValidationCritere();
                    accord.setCursus(validable.cursus());
                    accord.setCritere(validable.critere());
                    accord.setMoniteur(moniteur);
                    accord.setDateAccord(LocalDate.now());
                    accordsCritere.save(accord);
                },
                ids -> (int) accordsCritere.duCursus(cursusId).stream()
                        .filter(a -> a.getCritere().getId().equals(critereId) && ids.contains(a.getMoniteur().getId()))
                        .count(),
                () -> evaluations.validerCritere(cursusId, critereId, auteur));
    }

    /**
     * Le vote, commun à la compétence et au critère : validation directe par
     * un référent ou sans votant ; sinon accord de l'auteur, qui doit être
     * votant et ne vote qu'une fois, puis validation si la moitié est atteinte.
     */
    private EtatValidation voter(Cursus cursus, UtilisateurPrincipal auteur, String objet, boolean dejaDonne,
                                 java.util.function.Consumer<Utilisateur> enregistrerAccord,
                                 java.util.function.ToIntFunction<Set<Long>> compterAccords, Runnable valider) {
        Long saisonId = cursus.getSaison().getId();
        Long eleveId = cursus.getEleve().getId();

        List<Utilisateur> votants = votants(cursus);
        if (votants.isEmpty() || groupes.referentsDeLEleve(saisonId, eleveId).contains(auteur.id())) {
            valider.run();
            return new EtatValidation(true, 0, 0);
        }

        Set<Long> ids = votants.stream().map(Utilisateur::getId).collect(Collectors.toSet());
        int requis = accordsRequis(votants.size());
        if (!ids.contains(auteur.id())) {
            String groupe = groupes.groupeDeLEleve(saisonId, eleveId).stream().findFirst()
                    .flatMap(groupes::findById).map(GroupeEntrainement::getNom).orElse("");
            throw new RegleMetierException("La validation des compétences de " + cursus.getEleve().nomComplet()
                    + " se décide entre les encadrants de son groupe « " + groupe
                    + " » : demandez à l'un d'eux de la proposer.");
        }
        if (dejaDonne) {
            throw new RegleMetierException("Vous avez déjà donné votre accord pour valider " + objet
                    + " : il faut " + requis + " accords des encadrants du groupe.");
        }

        enregistrerAccord.accept(utilisateurs.findById(auteur.id()).orElseThrow());
        int donnes = compterAccords.applyAsInt(ids);
        if (donnes < requis) return new EtatValidation(false, donnes, requis);
        valider.run();
        return new EtatValidation(true, donnes, requis);
    }
}
