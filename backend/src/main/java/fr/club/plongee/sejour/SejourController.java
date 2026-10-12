package fr.club.plongee.sejour;

import fr.club.plongee.sejour.CarnetSejourService.BilanEnvoiCarnet;
import fr.club.plongee.sejour.SejourService.*;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Le séjour d'une sortie. Lu par les encadrants (en entier) et par ses
 * participants qui ont un compte (le carnet, vérifié par le service) ;
 * géré par un admin ou le directeur technique, comme les sorties. Chaque
 * modification renvoie le séjour à jour.
 */
@RestController
@RequestMapping("/api/sejours")
public class SejourController {

    public record DemandeInfos(String infosPratiques) {}

    public record DemandeGroupe(@NotNull Long groupeId) {}

    public record DemandeAffaires(@NotNull List<@Valid DemandeAffaire> affaires) {}

    private static final String GERE = "hasAnyRole('ADMIN','DIRECTEUR_TECHNIQUE')";

    private final SejourService service;
    private final CarnetSejourService carnets;

    public SejourController(SejourService service, CarnetSejourService carnets) {
        this.service = service;
        this.carnets = carnets;
    }

    /** {@code toutes} : aussi les séjours passés (encadrants). Un participant ne voit que les siens. */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<SejourResumeVue> lister(@RequestParam(defaultValue = "false") boolean toutes,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return service.lister(toutes, moi);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue lire(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/infos")
    @PreAuthorize(GERE)
    public SejourVue definirInfos(@PathVariable Long id, @RequestBody DemandeInfos d,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.definirInfos(id, d.infosPratiques());
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/participants")
    @PreAuthorize(GERE)
    public SejourVue ajouterParticipant(@PathVariable Long id, @Valid @RequestBody DemandeParticipant d,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.ajouterParticipant(id, d);
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/participants/groupe")
    @PreAuthorize(GERE)
    public SejourVue importerGroupe(@PathVariable Long id, @Valid @RequestBody DemandeGroupe d,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.importerGroupe(id, d.groupeId());
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/participants/{participantId}")
    @PreAuthorize(GERE)
    public SejourVue modifierParticipant(@PathVariable Long id, @PathVariable Long participantId,
                                         @Valid @RequestBody DemandeParticipant d,
                                         @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.modifierParticipant(id, participantId, d);
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/participants/{participantId}")
    @PreAuthorize(GERE)
    public SejourVue supprimerParticipant(@PathVariable Long id, @PathVariable Long participantId,
                                          @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.supprimerParticipant(id, participantId);
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/voitures")
    @PreAuthorize(GERE)
    public SejourVue creerVoiture(@PathVariable Long id, @Valid @RequestBody DemandeVoiture d,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.creerVoiture(id, d);
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/voitures/{voitureId}")
    @PreAuthorize(GERE)
    public SejourVue modifierVoiture(@PathVariable Long id, @PathVariable Long voitureId,
                                     @Valid @RequestBody DemandeVoiture d,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.modifierVoiture(id, voitureId, d);
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/voitures/{voitureId}")
    @PreAuthorize(GERE)
    public SejourVue supprimerVoiture(@PathVariable Long id, @PathVariable Long voitureId,
                                      @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.supprimerVoiture(id, voitureId);
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/logements")
    @PreAuthorize(GERE)
    public SejourVue creerLogement(@PathVariable Long id, @Valid @RequestBody DemandeLogement d,
                                   @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.creerLogement(id, d);
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/logements/{logementId}")
    @PreAuthorize(GERE)
    public SejourVue modifierLogement(@PathVariable Long id, @PathVariable Long logementId,
                                      @Valid @RequestBody DemandeLogement d,
                                      @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.modifierLogement(id, logementId, d);
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/logements/{logementId}")
    @PreAuthorize(GERE)
    public SejourVue supprimerLogement(@PathVariable Long id, @PathVariable Long logementId,
                                       @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.supprimerLogement(id, logementId);
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/affaires")
    @PreAuthorize(GERE)
    public SejourVue definirAffaires(@PathVariable Long id, @Valid @RequestBody DemandeAffaires d,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.definirAffaires(id, d.affaires());
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/evenements")
    @PreAuthorize(GERE)
    public SejourVue creerEvenement(@PathVariable Long id, @Valid @RequestBody DemandeEvenement d,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.creerEvenement(id, d);
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/evenements/{evenementId}")
    @PreAuthorize(GERE)
    public SejourVue modifierEvenement(@PathVariable Long id, @PathVariable Long evenementId,
                                       @Valid @RequestBody DemandeEvenement d,
                                       @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.modifierEvenement(id, evenementId, d);
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/evenements/{evenementId}")
    @PreAuthorize(GERE)
    public SejourVue supprimerEvenement(@PathVariable Long id, @PathVariable Long evenementId,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.supprimerEvenement(id, evenementId);
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/depenses")
    @PreAuthorize(GERE)
    public SejourVue creerDepense(@PathVariable Long id, @Valid @RequestBody DemandeDepense d,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.creerDepense(id, d);
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/depenses/{depenseId}")
    @PreAuthorize(GERE)
    public SejourVue modifierDepense(@PathVariable Long id, @PathVariable Long depenseId,
                                     @Valid @RequestBody DemandeDepense d,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.modifierDepense(id, depenseId, d);
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/depenses/{depenseId}")
    @PreAuthorize(GERE)
    public SejourVue supprimerDepense(@PathVariable Long id, @PathVariable Long depenseId,
                                      @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.supprimerDepense(id, depenseId);
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/versements")
    @PreAuthorize(GERE)
    public SejourVue creerVersement(@PathVariable Long id, @Valid @RequestBody DemandeVersement d,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.creerVersement(id, d);
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/versements/{versementId}")
    @PreAuthorize(GERE)
    public SejourVue supprimerVersement(@PathVariable Long id, @PathVariable Long versementId,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.supprimerVersement(id, versementId);
        return service.lire(id, moi);
    }

    /** Chaque participant reçoit son carnet : son voyage, sa voiture, sa chambre, le programme, les affaires. */
    @PostMapping("/{id}/envoi-carnet")
    @PreAuthorize(GERE)
    public BilanEnvoiCarnet envoyerCarnet(@PathVariable Long id) {
        return carnets.envoyer(id);
    }
}
