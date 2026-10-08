package fr.club.plongee.referentiel;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.repository.EvaluationRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.domain.PhaseExercice;
import fr.club.plongee.referentiel.repository.BlocCompetenceRepository;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Base d'exercices d'une version du MFT, compétence par compétence. Lue par
 * les encadrants (programme de séance, notation), modifiée par un ADMIN
 * depuis /admin/exercices. Un exercice déjà noté ne se supprime pas : on le
 * désactive, il reste lisible sur les notes passées.
 */
@RestController
@RequestMapping("/api/referentiels/{referentielId}")
public class ExerciceCompetenceController {

    /**
     * Un exercice de la base ; {@code blocId} : la compétence qu'il travaille ;
     * {@code aSchema} : un schéma se lit sur /api/exercices/{id}/schema.
     */
    public record ExerciceVue(Long id, Long blocId, String numero, int ordre, String phase,
                              String intitule, String deroulement, String critereReussite, boolean actif,
                              boolean aSchema,
                              /** Critères de la compétence que l'exercice fait travailler. */
                              List<Long> critereIds) {

        public static ExerciceVue de(ExerciceCompetence e, Set<Long> avecSchema) {
            return new ExerciceVue(e.getId(), e.getBloc().getId(), e.getNumero(), e.getOrdre(),
                    e.getPhase().name(), e.getIntitule(), e.getDeroulement(), e.getCritereReussite(), e.isActif(),
                    avecSchema.contains(e.getId()),
                    e.getCriteres().stream()
                            .sorted(java.util.Comparator.comparingInt(Critere::getOrdre))
                            .map(Critere::getId).toList());
        }
    }

    public record DemandeExercice(String numero, int ordre, @NotNull PhaseExercice phase,
                                  String intitule, String deroulement, String critereReussite,
                                  boolean actif, List<Long> critereIds) {}

    private final ReferentielRepository referentiels;
    private final BlocCompetenceRepository blocs;
    private final ExerciceCompetenceRepository exercices;
    private final EvaluationRepository evaluations;
    private final SchemaExerciceService schemas;

    public ExerciceCompetenceController(ReferentielRepository referentiels, BlocCompetenceRepository blocs,
                                        ExerciceCompetenceRepository exercices, EvaluationRepository evaluations,
                                        SchemaExerciceService schemas) {
        this.schemas = schemas;
        this.referentiels = referentiels;
        this.blocs = blocs;
        this.exercices = exercices;
        this.evaluations = evaluations;
    }

    /** Tous les exercices, désactivés compris (l'écran les distingue). */
    @GetMapping("/exercices")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    @Transactional(readOnly = true)
    public List<ExerciceVue> lister(@PathVariable Long referentielId) {
        if (!referentiels.existsById(referentielId)) {
            throw new RessourceIntrouvableException("Referentiel introuvable");
        }
        Set<Long> avecSchema = schemas.exercicesAvecSchema(referentielId);
        return exercices.parReferentiel(referentielId).stream().map(e -> ExerciceVue.de(e, avecSchema)).toList();
    }

    @PostMapping("/blocs/{blocId}/exercices")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ExerciceVue creer(@PathVariable Long referentielId, @PathVariable Long blocId,
                             @Valid @RequestBody DemandeExercice demande) {
        BlocCompetence bloc = blocs.findById(blocId)
                .filter(b -> b.getReferentiel().getId().equals(referentielId))
                .orElseThrow(() -> new RessourceIntrouvableException("Bloc introuvable"));
        ExerciceCompetence e = new ExerciceCompetence();
        e.setBloc(bloc);
        appliquer(e, demande);
        return ExerciceVue.de(exercices.save(e), Set.of());
    }

    @PutMapping("/exercices/{exerciceId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ExerciceVue modifier(@PathVariable Long referentielId, @PathVariable Long exerciceId,
                                @Valid @RequestBody DemandeExercice demande) {
        ExerciceCompetence e = exercice(referentielId, exerciceId);
        appliquer(e, demande);
        return ExerciceVue.de(exercices.save(e), schemas.exercicesAvecSchema(referentielId));
    }

    /** Bloqué si l'exercice porte déjà une note : la table evaluation est en ajout seul. */
    @DeleteMapping("/exercices/{exerciceId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void supprimer(@PathVariable Long referentielId, @PathVariable Long exerciceId) {
        ExerciceCompetence e = exercice(referentielId, exerciceId);
        if (evaluations.existsByExerciceId(exerciceId)) {
            throw new RegleMetierException("L'exercice « " + e.libelle()
                    + " » a déjà servi à noter des élèves : désactivez-le plutôt que de le supprimer.");
        }
        exercices.delete(e);
    }

    private ExerciceCompetence exercice(Long referentielId, Long exerciceId) {
        return exercices.findById(exerciceId)
                .filter(e -> e.getBloc().getReferentiel().getId().equals(referentielId))
                .orElseThrow(() -> new RessourceIntrouvableException("Exercice introuvable"));
    }

    private void appliquer(ExerciceCompetence e, DemandeExercice d) {
        String numero = d.numero() == null ? "" : d.numero().trim();
        String intitule = d.intitule() == null ? "" : d.intitule().trim();
        if (numero.isEmpty()) throw new RegleMetierException("Indiquez le numéro de l'exercice (par exemple « 1.7 »).");
        if (numero.length() > 10) throw new RegleMetierException("Le numéro de l'exercice fait au plus 10 caractères.");
        if (intitule.isEmpty()) throw new RegleMetierException("Indiquez l'intitulé de l'exercice.");
        if (intitule.length() > 200) {
            throw new RegleMetierException("L'intitulé fait au plus 200 caractères : mettez le détail dans le déroulement.");
        }
        boolean dejaPris = !numero.equals(e.getNumero())
                && exercices.existsByBlocIdAndNumero(e.getBloc().getId(), numero);
        if (dejaPris) {
            throw new RegleMetierException("Le numéro « " + numero + " » est déjà pris dans la compétence « "
                    + e.getBloc().getIntitule() + " ».");
        }
        List<Long> ids = d.critereIds() == null ? List.of() : d.critereIds();
        if (ids.isEmpty()) {
            throw new RegleMetierException("Cochez au moins un critère que l'exercice fait travailler.");
        }
        List<Critere> criteres = e.getBloc().getCriteres().stream().filter(c -> ids.contains(c.getId())).toList();
        if (criteres.size() != new java.util.HashSet<>(ids).size()) {
            throw new RegleMetierException("Les critères d'un exercice appartiennent à sa compétence « "
                    + e.getBloc().getIntitule() + " ».");
        }
        e.getCriteres().clear();
        e.getCriteres().addAll(criteres);
        e.setNumero(numero);
        e.setOrdre(d.ordre());
        e.setPhase(d.phase());
        e.setIntitule(intitule);
        e.setDeroulement(vide(d.deroulement()));
        e.setCritereReussite(vide(d.critereReussite()));
        e.setActif(d.actif());
    }

    private static String vide(String texte) {
        return texte == null || texte.isBlank() ? null : texte.trim();
    }
}
