package fr.club.plongee.evaluation.service;

import fr.club.plongee.evaluation.domain.ValidationCompetence;
import fr.club.plongee.evaluation.domain.StatutAcquisition;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.domain.Evaluation;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.domain.Participation;
import fr.club.plongee.formation.repository.ParticipationRepository;
import fr.club.plongee.formation.repository.PhotoEleveRepository;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Critere;
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
                             String statut, String parQui, LocalDate le, String commentaire) {}

    public record BlocVue(Long id, String intitule,
                          boolean evaluationTransverse, boolean validerEnDernier,
                          int acquis, int total, boolean valide,
                          LocalDate dateValidation, String valideePar,
                          /** Etiquette "Commun"/"PA20"/"PE40"... pour les niveaux qui se scindent en qualifications. */
                          String regroupement,
                          List<CritereVue> criteres) {}

    public record GrilleVue(Long cursusId, Long eleveId, String eleve, boolean aPhoto,
                            String email, String telephone, String contactUrgenceNom,
                            String contactUrgenceTelephone,
                            String niveau, String versionMft,
                            String saison, String statut, boolean milieuNaturelExclusif,
                            String niveauEncadrantValidation, int prerogativeProfondeur,
                            int seancesNage, int seancesBloc, int seancesPlongee,
                            int criteresAcquis, int criteresTotal,
                            List<BlocVue> blocs) {}

    /** Vue globale d'un élève : une colonne par séance, comme l'onglet individuel du tableur. */
    public record SeanceEnTeteVue(Long id, LocalDate date, String lieu) {}

    public record CelluleVue(Long seanceId, LocalDate date, String statut, String parQui) {}

    public record LigneMatriceVue(Long critereId, String blocIntitule, String regroupement,
                                  String savoirFaire, List<CelluleVue> historique) {}

    public record MatriceVue(String eleve, String niveau, List<SeanceEnTeteVue> seances,
                             List<LigneMatriceVue> lignes) {}

    private final CursusRepository cursusRepository;
    private final EvaluationService evaluationService;
    private final ValidationCompetenceRepository validations;
    private final ParticipationRepository participations;
    private final SeanceRepository seances;
    private final PhotoEleveRepository photos;

    public GrilleService(CursusRepository cursusRepository, EvaluationService evaluationService,
                         ValidationCompetenceRepository validations,
                         ParticipationRepository participations,
                         SeanceRepository seances,
                         PhotoEleveRepository photos) {
        this.cursusRepository = cursusRepository;
        this.evaluationService = evaluationService;
        this.validations = validations;
        this.participations = participations;
        this.seances = seances;
        this.photos = photos;
    }

    @Transactional(readOnly = true)
    public GrilleVue grille(Long cursusId) {
        Cursus cursus = cursusRepository.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));

        Map<Long, Evaluation> etat = evaluationService.etatCourant(cursusId);
        Map<Long, ValidationCompetence> valide = validations.findByCursusId(cursusId).stream()
                .collect(Collectors.toMap(v -> v.getBloc().getId(), v -> v));

        int acquisTotal = 0;
        int total = 0;
        List<BlocVue> blocs = new java.util.ArrayList<>();

        for (BlocCompetence bloc : blocsGroupesParRegroupement(cursus.getReferentiel().getBlocs())) {
            List<CritereVue> criteres = bloc.getCriteres().stream()
                    .map(c -> critereVue(c, etat.get(c.getId())))
                    .toList();
            int acquis = (int) criteres.stream()
                    .filter(c -> StatutAcquisition.ACQUIS.name().equals(c.statut())).count();
            acquisTotal += acquis;
            total += criteres.size();

            ValidationCompetence v = valide.get(bloc.getId());
            blocs.add(new BlocVue(bloc.getId(), bloc.getIntitule(),
                    bloc.isEvaluationTransverse(), bloc.isValiderEnDernier(),
                    acquis, criteres.size(), v != null,
                    v == null ? null : v.getDateValidation(),
                    v == null ? null : v.getMoniteur().nomComplet(),
                    bloc.getRegroupement(),
                    criteres));
        }

        Long eleveId = cursus.getEleve().getId();
        return new GrilleVue(cursus.getId(), eleveId, cursus.getEleve().nomComplet(),
                cursus.getEleve().isAutorisationImage() && photos.existsById(eleveId),
                cursus.getEleve().getEmail(), cursus.getEleve().getTelephone(),
                cursus.getEleve().getContactUrgenceNom(), cursus.getEleve().getContactUrgenceTelephone(),
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
                acquisTotal, total, blocs);
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

    private CritereVue critereVue(Critere c, Evaluation e) {
        return new CritereVue(c.getId(), c.getOrdre(), c.getSavoirFaire(), c.getCritereRealisation(),
                e == null ? StatutAcquisition.NON_ABORDE.name() : e.getStatut().name(),
                e == null ? null : e.getMoniteur().nomComplet(),
                e == null ? null : e.getDateEvaluation(),
                e == null ? null : e.getCommentaire());
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
                                e.getDateEvaluation(), e.getStatut().name(), e.getMoniteur().nomComplet()))
                        .toList();
                lignes.add(new LigneMatriceVue(c.getId(), bloc.getIntitule(), bloc.getRegroupement(),
                        c.getSavoirFaire(), historique));
            }
        }

        List<Seance> seancesSaison = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(cursus.getSaison().getId());
        List<SeanceEnTeteVue> entetes = seancesSaison.stream()
                .map(s -> new SeanceEnTeteVue(s.getId(), s.getDateSeance(), s.getLieu()))
                .toList();

        return new MatriceVue(cursus.getEleve().nomComplet(), cursus.getReferentiel().getNiveau().name(),
                entetes, lignes);
    }
}
