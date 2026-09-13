package fr.club.plongee.referentiel;

import fr.club.plongee.commun.RessourceIntrouvableException;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/referentiels")
public class ReferentielController {

    public record CritereVue(Long id, int ordre, String savoirFaire, String critereRealisation) {}

    public record BlocVue(Long id, String code, String intitule, int ordre,
                          boolean evaluationTransverse, boolean validerEnDernier,
                          List<CritereVue> criteres) {}

    public record ReferentielVue(Long id, String niveau, String versionMft, String source,
                                 int ageMinimum, String niveauPrerequis, String qualificationRequise,
                                 boolean milieuNaturelExclusif, String niveauEncadrantValidation,
                                 String niveauEncadrantDelivrance, int prerogativeProfondeur,
                                 List<BlocVue> blocs) {}

    private final ReferentielRepository referentiels;

    public ReferentielController(ReferentielRepository referentiels) {
        this.referentiels = referentiels;
    }

    @GetMapping
    public List<ReferentielVue> lister() {
        return referentiels.findByActifTrueOrderByNiveau().stream().map(r -> versSansBlocs(r)).toList();
    }

    @GetMapping("/{id}")
    public ReferentielVue detail(@PathVariable Long id) {
        Referentiel r = referentiels.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Referentiel introuvable"));
        return vers(r);
    }

    private ReferentielVue versSansBlocs(Referentiel r) {
        return construire(r, List.of());
    }

    private ReferentielVue vers(Referentiel r) {
        List<BlocVue> blocs = r.getBlocs().stream()
                .map(b -> new BlocVue(b.getId(), b.getCode(), b.getIntitule(), b.getOrdre(),
                        b.isEvaluationTransverse(), b.isValiderEnDernier(),
                        b.getCriteres().stream()
                                .map(c -> new CritereVue(c.getId(), c.getOrdre(),
                                        c.getSavoirFaire(), c.getCritereRealisation()))
                                .toList()))
                .toList();
        return construire(r, blocs);
    }

    private ReferentielVue construire(Referentiel r, List<BlocVue> blocs) {
        return new ReferentielVue(r.getId(), r.getNiveau().name(), r.getVersionMft(), r.getSource(),
                r.getAgeMinimum(),
                r.getNiveauPrerequis() == null ? null : r.getNiveauPrerequis().name(),
                r.getQualificationRequise(), r.isMilieuNaturelExclusif(),
                r.getNiveauEncadrantValidation().name(), r.getNiveauEncadrantDelivrance().name(),
                r.getPrerogativeProfondeur(), blocs);
    }
}
