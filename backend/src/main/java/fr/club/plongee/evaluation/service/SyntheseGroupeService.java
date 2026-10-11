package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Synthèse des compétences d'un groupe d'entraînement (choix du club, 2026) :
 * l'avancement de tous ses élèves d'un coup d'œil, un élève par ligne, une
 * compétence (bloc du référentiel) par colonne. Chaque case reprend ce que
 * montre la grille de l'élève : validée, critères acquis sur le total, en
 * retard sur la progression, prête à valider. Les élèves sont regroupés par
 * formation (une version du MFT) : deux référentiels n'ont pas les mêmes
 * compétences. Lecture seule.
 */
@Service
public class SyntheseGroupeService {

    /** Une case du tableau : l'état d'une compétence pour un élève, tiré de sa grille. */
    public record CaseCompetenceVue(Long blocId, int acquis, int total, boolean valide,
                                    LocalDate dateValidation,
                                    /** N2/N3 : critères acquis à l'entraînement en piscine ou fosse. */
                                    int acquisEntrainement,
                                    boolean enRetard,
                                    /** Tous les critères acquis, pas encore validée (exercice de maîtrise compris). */
                                    boolean aValider) {}

    public record EleveCompetencesVue(Long cursusId, Long eleveId, String eleve, String statutCursus,
                                      int criteresAcquis, int criteresTotal, int competencesValidees,
                                      List<CaseCompetenceVue> cases) {}

    /** Une colonne : la compétence et, pour le groupe, combien l'ont validée ou sont en retard. */
    public record CompetenceGroupeVue(Long blocId, String intitule, String regroupement, int criteres,
                                      LocalDate echeance, int valides, int enRetard) {}

    /** Les élèves du groupe qui suivent une même version du MFT. */
    public record FormationGroupeVue(String niveau, String versionMft, String progression,
                                     List<CompetenceGroupeVue> competences, List<EleveCompetencesVue> eleves) {}

    /** {@code sansFormation} : élèves du groupe sans formation sur la saison (adhésion seule). */
    public record SyntheseGroupeVue(Long groupeId, String groupe, String saison,
                                    List<FormationGroupeVue> formations, List<String> sansFormation) {}

    private final GroupeEntrainementRepository groupes;
    private final CursusRepository cursus;
    private final GrilleService grilles;

    public SyntheseGroupeService(GroupeEntrainementRepository groupes, CursusRepository cursus,
                                 GrilleService grilles) {
        this.groupes = groupes;
        this.cursus = cursus;
        this.grilles = grilles;
    }

    @Transactional(readOnly = true)
    public SyntheseGroupeVue synthese(Long groupeId) {
        GroupeEntrainement groupe = groupes.findById(groupeId)
                .orElseThrow(() -> new RessourceIntrouvableException("Groupe introuvable"));
        Set<Long> eleveIds = groupe.getEleves().stream().map(Eleve::getId).collect(Collectors.toSet());

        // Les grilles de chaque élève, rangées par version du MFT (référentiel).
        List<Cursus> duGroupe = cursus.parSaison(groupe.getSaison().getId()).stream()
                .filter(c -> eleveIds.contains(c.getEleve().getId()))
                .toList();
        Map<Long, List<GrilleService.GrilleVue>> parReferentiel = new LinkedHashMap<>();
        for (Cursus c : duGroupe) {
            parReferentiel.computeIfAbsent(c.getReferentiel().getId(), k -> new ArrayList<>())
                    .add(grilles.grille(c.getId()));
        }

        List<FormationGroupeVue> formations = parReferentiel.values().stream()
                .map(SyntheseGroupeService::formation)
                .toList();

        Set<Long> avecFormation = duGroupe.stream().map(c -> c.getEleve().getId()).collect(Collectors.toSet());
        List<String> sansFormation = groupe.getEleves().stream()
                .filter(e -> !avecFormation.contains(e.getId()))
                .sorted(Comparator.comparing(Eleve::getNom).thenComparing(Eleve::getPrenom))
                .map(Eleve::nomComplet)
                .toList();

        return new SyntheseGroupeVue(groupe.getId(), groupe.getNom(), groupe.getSaison().getLibelle(),
                formations, sansFormation);
    }

    private static FormationGroupeVue formation(List<GrilleService.GrilleVue> grillesFormation) {
        GrilleService.GrilleVue premiere = grillesFormation.getFirst();
        List<EleveCompetencesVue> eleves = grillesFormation.stream()
                .map(g -> new EleveCompetencesVue(g.cursusId(), g.eleveId(), g.eleve(), g.statut(),
                        g.criteresAcquis(), g.criteresTotal(),
                        (int) g.blocs().stream().filter(GrilleService.BlocVue::valide).count(),
                        g.blocs().stream().map(SyntheseGroupeService::caseDe).toList()))
                .toList();

        List<CompetenceGroupeVue> competences = premiere.blocs().stream()
                .map(b -> new CompetenceGroupeVue(b.id(), b.intitule(), b.regroupement(), b.total(), b.echeance(),
                        compter(eleves, b.id(), CaseCompetenceVue::valide),
                        compter(eleves, b.id(), CaseCompetenceVue::enRetard)))
                .toList();

        return new FormationGroupeVue(premiere.niveau(), premiere.versionMft(), premiere.progression(),
                competences, eleves);
    }

    private static CaseCompetenceVue caseDe(GrilleService.BlocVue b) {
        return new CaseCompetenceVue(b.id(), b.acquis(), b.total(), b.valide(), b.dateValidation(),
                b.acquisEntrainement(), b.enRetard(),
                !b.valide() && b.total() > 0 && b.acquis() == b.total() && b.maitriseAttendue().isEmpty());
    }

    private static int compter(List<EleveCompetencesVue> eleves, Long blocId,
                               java.util.function.Predicate<CaseCompetenceVue> condition) {
        return (int) eleves.stream()
                .flatMap(e -> e.cases().stream())
                .filter(c -> c.blocId().equals(blocId) && condition.test(c))
                .count();
    }
}
