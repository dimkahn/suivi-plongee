package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Appartenance d'un élève à une saison sans formation associée (voir
 * AdhesionSaison) : pour un élève déjà breveté qui continue de plonger
 * avec le club. Ne remplace pas l'inscription à un Cursus (CursusController),
 * qui reste la façon d'ouvrir une formation N1/N2/N3.
 */
@RestController
@RequestMapping("/api/adhesions")
public class AdhesionController {

    public record AdhesionVue(Long id, Long eleveId, String eleve, Long saisonId, String saison,
                              LocalDate adhereLe) {}

    public record DemandeAdhesion(@NotNull Long eleveId, @NotNull Long saisonId) {}

    private final AdhesionSaisonRepository adhesions;
    private final CursusRepository cursus;
    private final EleveRepository eleves;
    private final SaisonRepository saisons;

    public AdhesionController(AdhesionSaisonRepository adhesions, CursusRepository cursus,
                              EleveRepository eleves, SaisonRepository saisons) {
        this.adhesions = adhesions;
        this.cursus = cursus;
        this.eleves = eleves;
        this.saisons = saisons;
    }

    /** Selon le paramètre fourni : toutes les adhésions d'une saison, ou l'historique d'un élève. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<AdhesionVue> lister(@RequestParam(required = false) Long saisonId,
                                    @RequestParam(required = false) Long eleveId) {
        if (saisonId != null) {
            return adhesions.parSaison(saisonId).stream().map(this::vue).toList();
        }
        if (eleveId != null) {
            return adhesions.parEleve(eleveId).stream().map(this::vue).toList();
        }
        throw new RegleMetierException("Préciser saisonId ou eleveId.");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public AdhesionVue adherer(@Valid @RequestBody DemandeAdhesion demande) {
        Eleve eleve = eleves.findById(demande.eleveId())
                .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable"));
        Saison saison = saisons.findById(demande.saisonId())
                .orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"));

        if (cursus.existsByEleveIdAndSaisonId(eleve.getId(), saison.getId())) {
            throw new RegleMetierException(
                    "Cet élève a déjà un cursus de formation pour cette saison : "
                            + "pas besoin d'une adhésion séparée.");
        }
        if (adhesions.existsByEleveIdAndSaisonId(eleve.getId(), saison.getId())) {
            throw new RegleMetierException("Cet élève fait déjà partie de cette saison.");
        }

        AdhesionSaison a = new AdhesionSaison();
        a.setEleve(eleve);
        a.setSaison(saison);
        adhesions.save(a);
        return vue(a);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void retirer(@PathVariable Long id) {
        if (!adhesions.existsById(id)) {
            throw new RessourceIntrouvableException("Adhésion introuvable");
        }
        adhesions.deleteById(id);
    }

    private AdhesionVue vue(AdhesionSaison a) {
        return new AdhesionVue(a.getId(), a.getEleve().getId(), a.getEleve().nomComplet(),
                a.getSaison().getId(), a.getSaison().getLibelle(), a.getAdhereLe());
    }
}
