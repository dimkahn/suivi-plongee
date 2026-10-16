package fr.club.plongee.formation;

import fr.club.plongee.evaluation.service.HabilitationService;
import fr.club.plongee.formation.service.InscriptionClubService;
import fr.club.plongee.formation.service.InscriptionClubService.InscriptionClubVue;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Inscription au club à jour, saison par saison : notée par un ADMIN dans
 * l'administration des élèves, lue par les moniteurs. L'auteur vient de la
 * connexion, jamais de la requête.
 */
@RestController
@RequestMapping("/api/inscriptions-club")
public class InscriptionClubController {

    private final InscriptionClubService inscriptions;

    public InscriptionClubController(InscriptionClubService inscriptions) {
        this.inscriptions = inscriptions;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<InscriptionClubVue> lister(@RequestParam Long saisonId) {
        return inscriptions.deLaSaison(saisonId);
    }

    @PutMapping("/saisons/{saisonId}/eleves/{eleveId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void noter(@PathVariable Long saisonId, @PathVariable Long eleveId, Authentication authentication) {
        inscriptions.noter(saisonId, eleveId, HabilitationService.principal(authentication).id());
    }

    @DeleteMapping("/saisons/{saisonId}/eleves/{eleveId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void retirer(@PathVariable Long saisonId, @PathVariable Long eleveId) {
        inscriptions.retirer(saisonId, eleveId);
    }
}
