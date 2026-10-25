package fr.club.plongee.sejour;

import fr.club.plongee.evaluation.service.HabilitationService;
import fr.club.plongee.sejour.FichesSecuriteSejourService.DemandePlongee;
import fr.club.plongee.sejour.FichesSecuriteSejourService.FichesSecuriteSejourVue;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Les fiches de sécurité d'un séjour ({@link FichesSecuriteSejourService}) :
 * lues par les encadrants qui lisent les fiches (moniteurs, administrateurs) ;
 * plongées ajoutées et supprimées par le créateur et les organisateurs du
 * séjour. Chaque écriture renvoie la liste à jour.
 */
@RestController
@RequestMapping("/api/sejours/{id}")
public class FichesSecuriteSejourController {

    private static final String GERE = "@droitsSejour.organise(#id, authentication)";

    private final FichesSecuriteSejourService service;
    private final DroitsSejour droits;
    private final HabilitationService habilitation;

    public FichesSecuriteSejourController(FichesSecuriteSejourService service, DroitsSejour droits,
                                          HabilitationService habilitation) {
        this.service = service;
        this.droits = droits;
        this.habilitation = habilitation;
    }

    @GetMapping("/fiches-securite")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public FichesSecuriteSejourVue lire(@PathVariable Long id, Authentication authentication) {
        return vue(id, authentication);
    }

    @PostMapping("/plongees")
    @PreAuthorize(GERE)
    public FichesSecuriteSejourVue ajouter(@PathVariable Long id, @Valid @RequestBody DemandePlongee d,
                                           Authentication authentication) {
        service.ajouter(id, d);
        return vue(id, authentication);
    }

    @DeleteMapping("/plongees/{seanceId}")
    @PreAuthorize(GERE)
    public FichesSecuriteSejourVue supprimer(@PathVariable Long id, @PathVariable Long seanceId,
                                             Authentication authentication) {
        service.supprimer(id, seanceId);
        return vue(id, authentication);
    }

    private FichesSecuriteSejourVue vue(Long id, Authentication authentication) {
        boolean admin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return new FichesSecuriteSejourVue(droits.organise(id, authentication),
                habilitation.peutEtablirFicheSecurite(authentication), admin, service.plongees(id));
    }
}
