package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.referentiel.domain.Niveau;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Trombinoscope par niveau : une photo ne s'affiche jamais sans le
 * consentement {@code autorisationImage}, distinct de l'autorisation de
 * pratiquer (voir {@link EleveController}).
 */
@RestController
@RequestMapping("/api/trombinoscope")
public class TrombinoscopeController {

    public record LigneTrombinoscope(Long eleveId, Long cursusId, String eleve, String niveau,
                                     boolean aPhoto, boolean autorisationImage) {}

    private final CursusRepository cursus;
    private final SaisonRepository saisons;
    private final PhotoEleveRepository photos;

    public TrombinoscopeController(CursusRepository cursus, SaisonRepository saisons,
                                   PhotoEleveRepository photos) {
        this.cursus = cursus;
        this.saisons = saisons;
        this.photos = photos;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<LigneTrombinoscope> lister(@RequestParam(required = false) Long saisonId,
                                           @RequestParam(required = false) Niveau niveau) {
        Long saison = saisonId != null ? saisonId
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"))
                    .getId();

        return cursus.parSaison(saison).stream()
                .filter(c -> niveau == null || c.getReferentiel().getNiveau() == niveau)
                .map(c -> {
                    Eleve e = c.getEleve();
                    return new LigneTrombinoscope(e.getId(), c.getId(), e.nomComplet(),
                            c.getReferentiel().getNiveau().name(),
                            e.isAutorisationImage() && photos.existsById(e.getId()),
                            e.isAutorisationImage());
                })
                .toList();
    }
}
