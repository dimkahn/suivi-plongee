package fr.club.plongee.formation;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.securite.RoleNom;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cursus")
public class CursusController {

    public record CursusVue(Long id, String eleve, String niveau, String saison, String statut,
                            String moniteurReferent) {}

    private final CursusRepository cursus;
    private final SaisonRepository saisons;

    public CursusController(CursusRepository cursus, SaisonRepository saisons) {
        this.cursus = cursus;
        this.saisons = saisons;
    }

    /**
     * Un eleve ne recoit que ses propres cursus : le filtrage se fait dans la
     * requete, pas par un 403 apres coup.
     */
    @GetMapping
    public List<CursusVue> lister(@RequestParam(required = false) Long saisonId,
                                  @AuthenticationPrincipal UtilisateurPrincipal principal) {
        Long saison = saisonId != null ? saisonId
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"))
                    .getId();

        List<Cursus> liste = cursus.parSaison(saison);
        boolean encadrant = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + RoleNom.MONITEUR)
                        || a.getAuthority().equals("ROLE_" + RoleNom.ADMIN));
        if (!encadrant) {
            List<Long> siens = cursus.idsDeLEleve(principal.id());
            liste = liste.stream().filter(c -> siens.contains(c.getId())).toList();
        }
        return liste.stream().map(this::vue).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("@habilitation.peutConsulter(#id, authentication)")
    public CursusVue detail(@PathVariable Long id) {
        return vue(cursus.chargerComplet(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable")));
    }

    private CursusVue vue(Cursus c) {
        return new CursusVue(c.getId(), c.getEleve().nomComplet(),
                c.getReferentiel().getNiveau().name(), c.getSaison().getLibelle(),
                c.getStatut().name(),
                c.getMoniteurReferent() == null ? null : c.getMoniteurReferent().nomComplet());
    }
}
