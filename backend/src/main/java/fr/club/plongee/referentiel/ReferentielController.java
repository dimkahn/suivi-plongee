package fr.club.plongee.referentiel;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.Niveau;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.BlocCompetenceRepository;
import fr.club.plongee.referentiel.repository.CritereRepository;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/referentiels")
public class ReferentielController {

    public record CritereVue(Long id, int ordre, String savoirFaire, String critereRealisation,
                             String commentaire) {}

    public record BlocVue(Long id, String intitule, int ordre,
                          boolean evaluationTransverse, boolean validerEnDernier,
                          String competenceAttendue, String comportement,
                          String theorie, String modalitesEvaluation, String regroupement,
                          List<CritereVue> criteres) {}

    public record ReferentielVue(Long id, String niveau, String versionMft, String source,
                                 LocalDate dateApplication, boolean actif,
                                 int ageMinimum, String niveauPrerequis, String qualificationRequise,
                                 boolean milieuNaturelExclusif, String niveauEncadrantValidation,
                                 String niveauEncadrantDelivrance, int profondeurMaxValidation,
                                 int profondeurMaxFormation, int prerogativeProfondeur,
                                 List<BlocVue> blocs) {}

    /** Édition directe en base : aucune version n'est créée, le référentiel existant est modifié. */
    public record DemandeReferentiel(@NotNull Niveau niveau, @NotBlank String versionMft, String source,
                                     @NotNull LocalDate dateApplication, boolean actif,
                                     @Min(0) int ageMinimum, Niveau niveauPrerequis, String qualificationRequise,
                                     boolean milieuNaturelExclusif,
                                     @NotNull NiveauEncadrement niveauEncadrantValidation,
                                     @NotNull NiveauEncadrement niveauEncadrantDelivrance,
                                     @Min(0) int profondeurMaxValidation, @Min(0) int profondeurMaxFormation,
                                     @Min(0) int prerogativeProfondeur) {}

    public record DemandeBloc(@NotBlank String intitule, int ordre,
                              boolean evaluationTransverse, boolean validerEnDernier,
                              String competenceAttendue, String comportement,
                              String theorie, String modalitesEvaluation, String regroupement) {}

    public record DemandeCritere(int ordre, @NotBlank String savoirFaire,
                                 String critereRealisation, String commentaire) {}

    private final ReferentielRepository referentiels;
    private final BlocCompetenceRepository blocs;
    private final CritereRepository criteres;
    private final CursusRepository cursus;
    private final ValidationCompetenceRepository validations;
    private final EvaluationRepository evaluations;

    public ReferentielController(ReferentielRepository referentiels, BlocCompetenceRepository blocs,
                                 CritereRepository criteres, CursusRepository cursus,
                                 ValidationCompetenceRepository validations, EvaluationRepository evaluations) {
        this.referentiels = referentiels;
        this.blocs = blocs;
        this.criteres = criteres;
        this.cursus = cursus;
        this.validations = validations;
        this.evaluations = evaluations;
    }

    @GetMapping
    public List<ReferentielVue> lister() {
        return referentiels.findByActifTrueOrderByNiveau().stream().map(this::versSansBlocs).toList();
    }

    /** Toutes les versions, actives ou non : pour l'écran d'administration uniquement. */
    @GetMapping("/tous")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ReferentielVue> listerTous() {
        return referentiels.findAll().stream()
                .sorted(Comparator.comparing(Referentiel::getNiveau)
                        .thenComparing(Referentiel::getDateApplication, Comparator.reverseOrder()))
                .map(this::versSansBlocs)
                .toList();
    }

    /** {@code open-in-view} est désactivé : la session reste ouverte le temps de lire les critères des blocs. */
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ReferentielVue detail(@PathVariable Long id) {
        Referentiel r = referentiels.chargerComplet(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Referentiel introuvable"));
        return vers(r);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ReferentielVue creer(@Valid @RequestBody DemandeReferentiel demande) {
        Referentiel r = new Referentiel();
        appliquer(r, demande);
        referentiels.save(r);
        return versSansBlocs(r);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ReferentielVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeReferentiel demande) {
        Referentiel r = referentiels.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Referentiel introuvable"));
        appliquer(r, demande);
        referentiels.save(r);
        return versSansBlocs(r);
    }

    /**
     * Suppression bloquée si un cursus (courant ou passé) s'y réfère : la
     * ligne resterait la seule trace du référentiel sur lequel il a été figé.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id) {
        if (!referentiels.existsById(id)) {
            throw new RessourceIntrouvableException("Referentiel introuvable");
        }
        if (cursus.existsByReferentielId(id)) {
            throw new RegleMetierException(
                    "Ce référentiel est utilisé par au moins un cursus, il ne peut pas être supprimé.");
        }
        referentiels.deleteById(id);
    }

    @PostMapping("/{id}/blocs")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public BlocVue creerBloc(@PathVariable Long id, @Valid @RequestBody DemandeBloc demande) {
        Referentiel r = referentiels.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Referentiel introuvable"));
        BlocCompetence b = new BlocCompetence();
        b.setReferentiel(r);
        appliquer(b, demande);
        blocs.save(b);
        return versBloc(b);
    }

    @PutMapping("/{id}/blocs/{blocId}")
    @PreAuthorize("hasRole('ADMIN')")
    public BlocVue modifierBloc(@PathVariable Long id, @PathVariable Long blocId,
                                @Valid @RequestBody DemandeBloc demande) {
        BlocCompetence b = blocDuReferentiel(id, blocId);
        appliquer(b, demande);
        blocs.save(b);
        return versBloc(b);
    }

    /** Bloqué si le bloc porte déjà une validation, ou un de ses critères une évaluation. */
    @DeleteMapping("/{id}/blocs/{blocId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimerBloc(@PathVariable Long id, @PathVariable Long blocId) {
        blocDuReferentiel(id, blocId);
        if (validations.existsByBlocId(blocId) || evaluations.existsByCritere_BlocId(blocId)) {
            throw new RegleMetierException(
                    "Ce bloc porte déjà des évaluations ou une validation, il ne peut pas être supprimé.");
        }
        blocs.deleteById(blocId);
    }

    @PostMapping("/{id}/blocs/{blocId}/criteres")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public CritereVue creerCritere(@PathVariable Long id, @PathVariable Long blocId,
                                   @Valid @RequestBody DemandeCritere demande) {
        BlocCompetence b = blocDuReferentiel(id, blocId);
        Critere c = new Critere();
        c.setBloc(b);
        appliquer(c, demande);
        criteres.save(c);
        return versCritere(c);
    }

    @PutMapping("/{id}/blocs/{blocId}/criteres/{critereId}")
    @PreAuthorize("hasRole('ADMIN')")
    public CritereVue modifierCritere(@PathVariable Long id, @PathVariable Long blocId,
                                      @PathVariable Long critereId, @Valid @RequestBody DemandeCritere demande) {
        Critere c = critereDuBloc(id, blocId, critereId);
        appliquer(c, demande);
        criteres.save(c);
        return versCritere(c);
    }

    /** Bloqué si le critère porte déjà une évaluation : la table evaluation est en ajout seul. */
    @DeleteMapping("/{id}/blocs/{blocId}/criteres/{critereId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimerCritere(@PathVariable Long id, @PathVariable Long blocId, @PathVariable Long critereId) {
        critereDuBloc(id, blocId, critereId);
        if (evaluations.existsByCritereId(critereId)) {
            throw new RegleMetierException(
                    "Ce critère porte déjà des évaluations, il ne peut pas être supprimé.");
        }
        criteres.deleteById(critereId);
    }

    private BlocCompetence blocDuReferentiel(Long referentielId, Long blocId) {
        BlocCompetence b = blocs.findById(blocId)
                .orElseThrow(() -> new RessourceIntrouvableException("Bloc introuvable"));
        if (!b.getReferentiel().getId().equals(referentielId)) {
            throw new RessourceIntrouvableException("Bloc introuvable");
        }
        return b;
    }

    private Critere critereDuBloc(Long referentielId, Long blocId, Long critereId) {
        BlocCompetence b = blocDuReferentiel(referentielId, blocId);
        Critere c = criteres.findById(critereId)
                .orElseThrow(() -> new RessourceIntrouvableException("Critère introuvable"));
        if (!c.getBloc().getId().equals(b.getId())) {
            throw new RessourceIntrouvableException("Critère introuvable");
        }
        return c;
    }

    private void appliquer(Referentiel r, DemandeReferentiel d) {
        r.setNiveau(d.niveau());
        r.setVersionMft(d.versionMft());
        r.setSource(d.source());
        r.setDateApplication(d.dateApplication());
        r.setActif(d.actif());
        r.setAgeMinimum(d.ageMinimum());
        r.setNiveauPrerequis(d.niveauPrerequis());
        r.setQualificationRequise(d.qualificationRequise());
        r.setMilieuNaturelExclusif(d.milieuNaturelExclusif());
        r.setNiveauEncadrantValidation(d.niveauEncadrantValidation());
        r.setNiveauEncadrantDelivrance(d.niveauEncadrantDelivrance());
        r.setProfondeurMaxValidation(d.profondeurMaxValidation());
        r.setProfondeurMaxFormation(d.profondeurMaxFormation());
        r.setPrerogativeProfondeur(d.prerogativeProfondeur());
    }

    private void appliquer(BlocCompetence b, DemandeBloc d) {
        b.setIntitule(d.intitule());
        b.setOrdre(d.ordre());
        b.setEvaluationTransverse(d.evaluationTransverse());
        b.setValiderEnDernier(d.validerEnDernier());
        b.setCompetenceAttendue(d.competenceAttendue());
        b.setComportement(d.comportement());
        b.setTheorie(d.theorie());
        b.setModalitesEvaluation(d.modalitesEvaluation());
        b.setRegroupement(d.regroupement());
    }

    private void appliquer(Critere c, DemandeCritere d) {
        c.setOrdre(d.ordre());
        c.setSavoirFaire(d.savoirFaire());
        c.setCritereRealisation(d.critereRealisation());
        c.setCommentaire(d.commentaire());
    }

    private ReferentielVue versSansBlocs(Referentiel r) {
        return construire(r, List.of());
    }

    private ReferentielVue vers(Referentiel r) {
        List<BlocVue> blocsVue = r.getBlocs().stream().map(this::versBloc).toList();
        return construire(r, blocsVue);
    }

    private BlocVue versBloc(BlocCompetence b) {
        return new BlocVue(b.getId(), b.getIntitule(), b.getOrdre(),
                b.isEvaluationTransverse(), b.isValiderEnDernier(),
                b.getCompetenceAttendue(), b.getComportement(),
                b.getTheorie(), b.getModalitesEvaluation(), b.getRegroupement(),
                b.getCriteres().stream().map(this::versCritere).toList());
    }

    private CritereVue versCritere(Critere c) {
        return new CritereVue(c.getId(), c.getOrdre(), c.getSavoirFaire(), c.getCritereRealisation(),
                c.getCommentaire());
    }

    private ReferentielVue construire(Referentiel r, List<BlocVue> blocsVue) {
        return new ReferentielVue(r.getId(), r.getNiveau().name(), r.getVersionMft(), r.getSource(),
                r.getDateApplication(), r.isActif(), r.getAgeMinimum(),
                r.getNiveauPrerequis() == null ? null : r.getNiveauPrerequis().name(),
                r.getQualificationRequise(), r.isMilieuNaturelExclusif(),
                r.getNiveauEncadrantValidation().name(), r.getNiveauEncadrantDelivrance().name(),
                r.getProfondeurMaxValidation(), r.getProfondeurMaxFormation(),
                r.getPrerogativeProfondeur(), blocsVue);
    }
}
