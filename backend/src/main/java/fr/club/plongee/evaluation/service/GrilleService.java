package fr.club.plongee.evaluation.service;

import fr.club.plongee.evaluation.domain.ValidationCompetence;
import fr.club.plongee.evaluation.domain.StatutAcquisition;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.ExerciceSeance;
import fr.club.plongee.formation.repository.ExerciceSeanceRepository;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.domain.Participation;
import fr.club.plongee.formation.repository.ParticipationRepository;
import fr.club.plongee.formation.repository.PhotoEleveRepository;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.progression.domain.ProgressionType;
import fr.club.plongee.progression.repository.ProgressionTypeRepository;
import fr.club.plongee.progression.service.EcheancesProgression;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.ExerciceCompetenceController;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Assemble la grille de suivi d'un eleve : referentiel + etat courant + validations. */
@Service
public class GrilleService {

    public record CritereVue(Long id, int ordre, String savoirFaire, String critereRealisation,
                             String statut, String parQui, LocalDate le, String commentaire,
                             /** N2/N3 : derniere note prise en piscine ou fosse ; null sinon. */
                             SuiviEntrainementVue entrainement,
                             /** Exercice de la derniere note ; null sans exercice. */
                             ExerciceNoteVue exercice) {}

    /** Suivi d'entrainement d'un critere (N2/N3) : ne compte pas pour l'acquisition. */
    public record SuiviEntrainementVue(String statut, String parQui, LocalDate le, String commentaire,
                                       ExerciceNoteVue exercice) {}

    /** L'exercice sur lequel une note a ete prise : de quoi afficher « M 1.7 » sans autre requete. */
    public record ExerciceNoteVue(Long id, String numero, String intitule, String phase) {

        public static ExerciceNoteVue de(ExerciceCompetence e) {
            return e == null ? null : new ExerciceNoteVue(e.getId(), e.getNumero(), e.getIntitule(), e.getPhase().name());
        }
    }

    public record BlocVue(Long id, String intitule,
                          boolean evaluationTransverse, boolean validerEnDernier,
                          int acquis, int total, boolean valide,
                          /** Criteres acquis a l'entrainement en piscine ou fosse (N2/N3). */
                          int acquisEntrainement,
                          LocalDate dateValidation, String valideePar,
                          /** Etiquette "Commun"/"PA20"/"PE40"... pour les niveaux qui se scindent en qualifications. */
                          String regroupement,
                          /** Revisions post-PE20 uniquement : null sur les blocs plus anciens. */
                          String competenceAttendue, String comportement,
                          String theorie, String modalitesEvaluation,
                          /** Fin de la derniere periode de la progression suivie qui contient le bloc ; null sinon. */
                          LocalDate echeance, boolean enRetard,
                          List<CritereVue> criteres,
                          /** Base d'exercices de la competence (actifs), proposes a la notation. */
                          List<ExerciceCompetenceController.ExerciceVue> exercices) {}

    /** Une periode de la progression suivie par le cursus : le front en tire les blocs « au programme ». */
    public record PeriodeGrilleVue(String intitule, int moisDebut, int moisFin, String milieu, String note,
                                   List<Long> blocIds) {}

    public record GrilleVue(Long cursusId, Long eleveId, String eleve, boolean aPhoto,
                            String email, String telephone, String contactUrgenceNom,
                            String contactUrgenceTelephone,
                            LocalDate dateNaissance, LocalDate certificatValideJusquAu,
                            String tailleGilet, String tailleCombinaison,
                            String niveau, String versionMft,
                            String saison, String statut, boolean milieuNaturelExclusif,
                            String niveauEncadrantValidation, int prerogativeProfondeur,
                            int seancesNage, int seancesBloc, int seancesPlongee,
                            int criteresAcquis, int criteresTotal,
                            List<BlocVue> blocs,
                            /** Progression suivie par la saison pour ce referentiel ; null et liste vide sinon. */
                            String progression, List<PeriodeGrilleVue> periodes,
                            /** Seances ou l'eleve est note present : les seules proposees pour le noter. */
                            List<Long> seancesPresent,
                            /** Programme d'exercices des seances de la saison : sa formation et les exercices communs. */
                            List<ProgrammeGrilleVue> programmes) {}

    /** Un exercice du programme d'une seance, vu depuis la fiche d'un eleve. */
    public record ExerciceGrilleVue(String intitule, String consignes, Integer dureeMinutes,
                                    /** Groupe d'entrainement qui l'a prepare ; null : programme commun. */
                                    String groupe, List<Long> critereIds,
                                    /** Exercice de la base dont il est tire ; null sinon. */
                                    ExerciceNoteVue exerciceBase) {}

    /** Seulement les seances qui ont au moins un exercice. */
    public record ProgrammeGrilleVue(Long seanceId, List<ExerciceGrilleVue> exercices) {}

    /** Vue globale d'un élève : une colonne par séance, comme l'onglet individuel du tableur. */
    public record SeanceEnTeteVue(Long id, LocalDate date, String lieu, String milieu) {}

    /**
     * {@code entrainement} : N2/N3 noté en piscine ou fosse, sans effet sur l'acquisition ;
     * {@code exerciceId} : exercice de la base noté, détaillé dans {@link MatriceVue#exercices}.
     */
    public record CelluleVue(Long seanceId, LocalDate date, String statut, String parQui,
                             boolean entrainement, Long exerciceId, String commentaire) {}

    public record LigneMatriceVue(Long critereId, String blocIntitule, String regroupement,
                                  String savoirFaire, List<CelluleVue> historique) {}

    /**
     * {@code milieuNaturelExclusif} : N2/N3, la vue sépare entraînement et milieu naturel ;
     * {@code exercices} : les exercices de la base notés pour cet élève, avec leur détail.
     */
    public record MatriceVue(String eleve, String niveau, boolean milieuNaturelExclusif,
                             List<SeanceEnTeteVue> seances, List<LigneMatriceVue> lignes,
                             List<ExerciceCompetenceController.ExerciceVue> exercices) {}

    private final CursusRepository cursusRepository;
    private final EvaluationService evaluationService;
    private final ValidationCompetenceRepository validations;
    private final ParticipationRepository participations;
    private final SeanceRepository seances;
    private final PhotoEleveRepository photos;
    private final ProgressionTypeRepository progressions;
    private final ExerciceSeanceRepository exercices;
    private final GroupeEntrainementRepository groupes;
    private final ExerciceCompetenceRepository exercicesBase;

    public GrilleService(CursusRepository cursusRepository, EvaluationService evaluationService,
                         ValidationCompetenceRepository validations,
                         ParticipationRepository participations,
                         SeanceRepository seances,
                         PhotoEleveRepository photos,
                         ProgressionTypeRepository progressions,
                         ExerciceSeanceRepository exercices,
                         GroupeEntrainementRepository groupes,
                         ExerciceCompetenceRepository exercicesBase) {
        this.exercicesBase = exercicesBase;
        this.cursusRepository = cursusRepository;
        this.evaluationService = evaluationService;
        this.validations = validations;
        this.participations = participations;
        this.seances = seances;
        this.photos = photos;
        this.progressions = progressions;
        this.exercices = exercices;
        this.groupes = groupes;
    }

    @Transactional(readOnly = true)
    public GrilleVue grille(Long cursusId) {
        Cursus cursus = cursusRepository.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));

        Map<Long, Evaluation> etat = evaluationService.etatCourant(cursusId);
        Map<Long, Evaluation> entrainement = evaluationService.etatEntrainement(cursusId);
        Map<Long, ValidationCompetence> valide = validations.findByCursusId(cursusId).stream()
                .collect(Collectors.toMap(v -> v.getBloc().getId(), v -> v));

        // Progression suivie par la saison pour ce referentiel : echeance de chaque bloc.
        // Le retard n'a de sens que pour une formation en cours.
        ProgressionType progression = progressions
                .suivie(cursus.getSaison().getId(), cursus.getReferentiel().getId()).orElse(null);
        Map<Long, LocalDate> echeances = progression == null ? Map.of()
                : EcheancesProgression.parBloc(progression, cursus.getSaison().getDateDebut());
        boolean enCours = cursus.getStatut() == Cursus.Statut.EN_COURS;
        LocalDate aujourdhui = Calendrier.aujourdhui();

        Map<Long, List<ExerciceCompetenceController.ExerciceVue>> exercicesParBloc = exercicesBase
                .parReferentiel(cursus.getReferentiel().getId()).stream()
                .filter(ExerciceCompetence::isActif)
                .map(ExerciceCompetenceController.ExerciceVue::de)
                .collect(Collectors.groupingBy(ExerciceCompetenceController.ExerciceVue::blocId));

        int acquisTotal = 0;
        int total = 0;
        List<BlocVue> blocs = new java.util.ArrayList<>();

        for (BlocCompetence bloc : blocsGroupesParRegroupement(cursus.getReferentiel().getBlocs())) {
            List<CritereVue> criteres = bloc.getCriteres().stream()
                    .map(c -> critereVue(c, etat.get(c.getId()), entrainement.get(c.getId())))
                    .toList();
            int acquis = (int) criteres.stream()
                    .filter(c -> StatutAcquisition.ACQUIS.name().equals(c.statut())).count();
            acquisTotal += acquis;
            total += criteres.size();

            ValidationCompetence v = valide.get(bloc.getId());
            blocs.add(new BlocVue(bloc.getId(), bloc.getIntitule(),
                    bloc.isEvaluationTransverse(), bloc.isValiderEnDernier(),
                    acquis, criteres.size(), v != null,
                    (int) criteres.stream().filter(c -> c.entrainement() != null
                            && StatutAcquisition.ACQUIS.name().equals(c.entrainement().statut())).count(),
                    v == null ? null : v.getDateValidation(),
                    v == null ? null : v.getMoniteur().nomComplet(),
                    bloc.getRegroupement(),
                    bloc.getCompetenceAttendue(), bloc.getComportement(),
                    bloc.getTheorie(), bloc.getModalitesEvaluation(),
                    echeances.get(bloc.getId()),
                    enCours && EcheancesProgression.enRetard(echeances.get(bloc.getId()), aujourdhui,
                            v != null, acquis, criteres.size()),
                    criteres,
                    exercicesParBloc.getOrDefault(bloc.getId(), List.of())));
        }

        Long eleveId = cursus.getEleve().getId();
        return new GrilleVue(cursus.getId(), eleveId, cursus.getEleve().nomComplet(),
                cursus.getEleve().isAutorisationImage() && photos.existsById(eleveId),
                cursus.getEleve().getEmail(), cursus.getEleve().getTelephone(),
                cursus.getEleve().getContactUrgenceNom(), cursus.getEleve().getContactUrgenceTelephone(),
                cursus.getEleve().getDateNaissance(), cursus.getEleve().getCertificatValideJusquAu(),
                cursus.getEleve().getTailleGilet(), cursus.getEleve().getTailleCombinaison(),
                cursus.getReferentiel().getNiveau().name(),
                cursus.getReferentiel().getVersionMft(),
                cursus.getSaison().getLibelle(),
                cursus.getStatut().name(),
                cursus.getReferentiel().isMilieuNaturelExclusif(),
                cursus.getReferentiel().getNiveauEncadrantValidation().name(),
                cursus.getReferentiel().getPrerogativeProfondeur(),
                (int) participations.compterAtelier(cursusId, Participation.Atelier.NAGE),
                (int) participations.compterAtelier(cursusId, Participation.Atelier.BLOC),
                (int) participations.compterAtelier(cursusId, Participation.Atelier.PLONGEE),
                acquisTotal, total, blocs,
                progression == null ? null : progression.getNom(),
                progression == null ? List.of() : periodesVue(progression),
                participations.seancesOuPresent(cursusId),
                programmes(cursus));
    }

    /** Programme commun de chaque séance, puis celui du groupe d'entraînement de l'élève. */
    private List<ProgrammeGrilleVue> programmes(Cursus cursus) {
        Long saisonId = cursus.getSaison().getId();
        Long groupeId = groupes.groupeDeLEleve(saisonId, cursus.getEleve().getId()).stream().findFirst().orElse(null);
        Map<Long, List<ExerciceGrilleVue>> parSeance = new java.util.LinkedHashMap<>();
        exercices.pourLaFiche(saisonId, cursus.getReferentiel().getId(), groupeId).stream()
                .sorted(java.util.Comparator.comparing((ExerciceSeance e) -> e.getGroupe() != null))
                .forEach(e -> parSeance.computeIfAbsent(e.getSeance().getId(), k -> new ArrayList<>())
                        .add(new ExerciceGrilleVue(e.getIntitule(), e.getConsignes(), e.getDureeMinutes(),
                                e.getGroupe() == null ? null : e.getGroupe().getNom(),
                                e.getCriteres().stream().map(Critere::getId).toList(),
                                ExerciceNoteVue.de(e.getExerciceCompetence()))));
        return parSeance.entrySet().stream()
                .map(en -> new ProgrammeGrilleVue(en.getKey(), en.getValue()))
                .toList();
    }

    private static List<PeriodeGrilleVue> periodesVue(ProgressionType p) {
        return p.getPeriodes().stream()
                .sorted(java.util.Comparator.comparingInt(fr.club.plongee.progression.domain.PeriodeProgression::getRang))
                .map(pp -> new PeriodeGrilleVue(pp.getIntitule(), pp.getMoisDebut(), pp.getMoisFin(),
                        pp.getMilieu() == null ? null : pp.getMilieu().name(), pp.getNote(),
                        pp.getBlocs().stream().map(BlocCompetence::getId).toList()))
                .toList();
    }

    /**
     * Reordonne les blocs pour que ceux qui partagent le meme regroupement
     * (etiquette "Commun"/"PA20"/"PE40"...) soient contigus, meme si le MFT
     * les intercale (ex. un bloc theorique PA20 place apres les blocs PE40).
     * Ordre stable : chaque regroupement apparait a la position de son premier
     * bloc rencontre, l'ordre interne au groupe restant celui du referentiel.
     */
    private List<BlocCompetence> blocsGroupesParRegroupement(List<BlocCompetence> blocs) {
        Map<String, List<BlocCompetence>> parRegroupement = new java.util.LinkedHashMap<>();
        for (BlocCompetence bloc : blocs) {
            parRegroupement.computeIfAbsent(bloc.getRegroupement(), k -> new ArrayList<>()).add(bloc);
        }
        return parRegroupement.values().stream().flatMap(List::stream).toList();
    }

    private CritereVue critereVue(Critere c, Evaluation e, Evaluation entrainement) {
        return new CritereVue(c.getId(), c.getOrdre(), c.getSavoirFaire(), c.getCritereRealisation(),
                e == null ? StatutAcquisition.NON_ABORDE.name() : e.getStatut().name(),
                e == null ? null : e.getMoniteur().nomComplet(),
                e == null ? null : e.getDateEvaluation(),
                e == null ? null : e.getCommentaire(),
                entrainement == null ? null : new SuiviEntrainementVue(entrainement.getStatut().name(),
                        entrainement.getMoniteur().nomComplet(), entrainement.getDateEvaluation(),
                        entrainement.getCommentaire(), ExerciceNoteVue.de(entrainement.getExercice())),
                e == null ? null : ExerciceNoteVue.de(e.getExercice()));
    }

    /**
     * Une ligne par critère du référentiel, une cellule par saisie passée
     * (la table étant en ajout seul, un critère revu en séance peut porter
     * plusieurs cellules) : la table de suivi complète d'un élève.
     */
    @Transactional(readOnly = true)
    public MatriceVue matrice(Long cursusId) {
        Cursus cursus = cursusRepository.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));

        Map<Long, List<Evaluation>> parCritere = evaluationService.historiqueCursus(cursusId).stream()
                .collect(Collectors.groupingBy(e -> e.getCritere().getId()));

        List<LigneMatriceVue> lignes = new ArrayList<>();
        for (BlocCompetence bloc : blocsGroupesParRegroupement(cursus.getReferentiel().getBlocs())) {
            for (Critere c : bloc.getCriteres()) {
                List<CelluleVue> historique = parCritere.getOrDefault(c.getId(), List.of()).stream()
                        .map(e -> new CelluleVue(e.getSeance() == null ? null : e.getSeance().getId(),
                                e.getDateEvaluation(), e.getStatut().name(), e.getMoniteur().nomComplet(),
                                e.isEntrainement(), e.getExercice() == null ? null : e.getExercice().getId(),
                                e.getCommentaire()))
                        .toList();
                lignes.add(new LigneMatriceVue(c.getId(), bloc.getIntitule(), bloc.getRegroupement(),
                        c.getSavoirFaire(), historique));
            }
        }

        List<Seance> seancesSaison = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(cursus.getSaison().getId());
        List<SeanceEnTeteVue> entetes = seancesSaison.stream()
                .map(s -> new SeanceEnTeteVue(s.getId(), s.getDateSeance(), s.getLieu(), s.getMilieu().name()))
                .toList();

        return new MatriceVue(cursus.getEleve().nomComplet(), cursus.getReferentiel().getNiveau().name(),
                cursus.getReferentiel().isMilieuNaturelExclusif(), entetes, lignes,
                exercicesBase.parReferentiel(cursus.getReferentiel().getId()).stream()
                        .map(ExerciceCompetenceController.ExerciceVue::de).toList());
    }
}
