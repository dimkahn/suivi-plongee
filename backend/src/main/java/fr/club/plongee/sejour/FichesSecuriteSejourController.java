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
 * plongées ajoutées par le créateur et les organisateurs du séjour, ou par un
 * moniteur qui peut en être le DP (la plongée imprévue, même ajoutée hors
 * ligne : rejouée par le téléphone, elle n'est créée qu'une fois) ; supprimées
 * par les organisateurs seulement. Chaque écriture renvoie la liste à jour.
 */
@RestController
@RequestMapping("/api/sejours/{id}")
public class FichesSecuriteSejourController {

    private static final String GERE = "@droitsSejour.organise(#id, authentication)";
    private static final String AJOUTE = GERE + " or @habilitation.peutEtreDp(authentication)";

    private final FichesSecuriteSejourService service;
    private final DroitsSejour droits;
    private final HabilitationService habilitation;
    private final RejeuSejour rejeu;

    public FichesSecuriteSejourController(FichesSecuriteSejourService service, DroitsSejour droits,
                                          HabilitationService habilitation, RejeuSejour rejeu) {
        this.service = service;
        this.droits = droits;
        this.habilitation = habilitation;
        this.rejeu = rejeu;
    }

    @GetMapping("/fiches-securite")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public FichesSecuriteSejourVue lire(@PathVariable Long id, Authentication authentication) {
        return vue(id, authentication, null);
    }

    @PostMapping("/plongees")
    @PreAuthorize(AJOUTE)
    public FichesSecuriteSejourVue ajouter(@PathVariable Long id, @Valid @RequestBody DemandePlongee d,
                                           @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                           Authentication authentication) {
        Long seanceId = rejeu.idCreeUneFois(id, reference, () -> service.ajouter(id, d));
        return vue(id, authentication, seanceId);
    }

    @DeleteMapping("/plongees/{seanceId}")
    @PreAuthorize(GERE)
    public FichesSecuriteSejourVue supprimer(@PathVariable Long id, @PathVariable Long seanceId,
                                             Authentication authentication) {
        service.supprimer(id, seanceId);
        return vue(id, authentication, null);
    }

    private FichesSecuriteSejourVue vue(Long id, Authentication authentication, Long plongeeAjoutee) {
        boolean admin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean organise = droits.organise(id, authentication);
        return new FichesSecuriteSejourVue(organise || habilitation.peutEtreDp(authentication), organise,
                habilitation.peutEtablirFicheSecurite(authentication), admin, service.plongees(id), plongeeAjoutee);
    }
}
