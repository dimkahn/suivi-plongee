package fr.club.plongee.planning;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.planning.domain.EspaceBassin;
import fr.club.plongee.planning.repository.EspaceBassinRepository;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Lignes d'eau et fosse du bassin : consultées par les encadrants, décrites par un admin. */
@RestController
@RequestMapping("/api/espaces-bassin")
public class EspaceBassinController {

    public record EspaceVue(Long id, String nom, String type, int ordre, Integer profondeurMax,
                            Integer capacite, boolean actif) {}

    public record DemandeEspace(@NotBlank String nom, @NotNull EspaceBassin.Type type, int ordre,
                                @Min(0) Integer profondeurMax, @Min(1) Integer capacite, boolean actif) {}

    private final EspaceBassinRepository espaces;
    private final GroupeEntrainementRepository groupes;

    public EspaceBassinController(EspaceBassinRepository espaces, GroupeEntrainementRepository groupes) {
        this.espaces = espaces;
        this.groupes = groupes;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<EspaceVue> lister() {
        return espaces.findAllByOrderByOrdreAscIdAsc().stream().map(this::vue).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public EspaceVue creer(@Valid @RequestBody DemandeEspace demande) {
        EspaceBassin e = new EspaceBassin();
        appliquer(e, demande);
        return vue(espaces.save(e));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public EspaceVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeEspace demande) {
        EspaceBassin e = espace(id);
        appliquer(e, demande);
        return vue(espaces.save(e));
    }

    /** Bloqué si un groupe l'a pour ligne attitrée : le désactiver le retire des choix sans rien casser. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long id) {
        espace(id);
        if (groupes.existsByEspaceAttitre(id)) {
            throw new RegleMetierException(
                    "Cet espace est la ligne attitrée d'au moins un groupe : désactivez-le plutôt que de le supprimer.");
        }
        espaces.deleteById(id);
    }

    private EspaceBassin espace(Long id) {
        return espaces.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Espace introuvable"));
    }

    private void appliquer(EspaceBassin e, DemandeEspace d) {
        e.setNom(d.nom().trim());
        e.setType(d.type());
        e.setOrdre(d.ordre());
        e.setProfondeurMax(d.profondeurMax());
        e.setCapacite(d.capacite());
        e.setActif(d.actif());
    }

    private EspaceVue vue(EspaceBassin e) {
        return new EspaceVue(e.getId(), e.getNom(), e.getType().name(), e.getOrdre(), e.getProfondeurMax(),
                e.getCapacite(), e.isActif());
    }
}
