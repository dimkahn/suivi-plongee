package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.sejour.CarnetSejourService.BilanEnvoiCarnet;
import fr.club.plongee.sejour.SejourService.*;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
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

    /** La dépense créée (pour y joindre la photo de la note) et le séjour à jour. */
    public record DepenseCreee(long depenseId, SejourVue sejour) {}

    private final SejourService service;
    private final CarnetSejourService carnets;
    private final FraisService frais;
    private final AccesFraisService acces;

    public SejourController(SejourService service, CarnetSejourService carnets, FraisService frais,
                            AccesFraisService acces) {
        this.service = service;
        this.carnets = carnets;
        this.frais = frais;
        this.acces = acces;
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

    // ------------------------------------------------------------------
    //  Frais : les droits dépendent de qui agit (FraisService), pas seulement du rôle.
    // ------------------------------------------------------------------

    @PostMapping("/{id}/depenses")
    @PreAuthorize("isAuthenticated()")
    public DepenseCreee creerDepense(@PathVariable Long id, @Valid @RequestBody FraisService.DemandeDepense d,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        long depenseId = frais.creerDepense(id, d, frais.acteur(id, moi));
        return new DepenseCreee(depenseId, service.lire(id, moi));
    }

    @PutMapping("/{id}/depenses/{depenseId}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue modifierDepense(@PathVariable Long id, @PathVariable Long depenseId,
                                     @Valid @RequestBody FraisService.DemandeDepense d,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.modifierDepense(id, depenseId, d, frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/depenses/{depenseId}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue supprimerDepense(@PathVariable Long id, @PathVariable Long depenseId,
                                      @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.supprimerDepense(id, depenseId, frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    /** La photo de la note (JPEG ou PNG, réduite par le téléphone avant l'envoi). */
    @PostMapping(value = "/{id}/depenses/{depenseId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public SejourVue ajouterPhoto(@PathVariable Long id, @PathVariable Long depenseId,
                                  @RequestParam("fichier") MultipartFile fichier,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.ajouterPhoto(id, depenseId, octets(fichier), fichier.getContentType(), frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/depenses/{depenseId}/photos/{photoId}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue supprimerPhoto(@PathVariable Long id, @PathVariable Long depenseId, @PathVariable Long photoId,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.supprimerPhoto(id, depenseId, photoId, frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    /** Lisible par tous ceux qui lisent le séjour : encadrants et participants. */
    @GetMapping("/{id}/depenses/{depenseId}/photos/{photoId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> photo(@PathVariable Long id, @PathVariable Long depenseId, @PathVariable Long photoId,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        if (!SejourService.encadrant(moi) && frais.acteur(id, moi).participantId() == null) {
            throw new AccessDeniedException("Ce séjour n'est ouvert qu'à ses participants et aux encadrants.");
        }
        return image(frais.photo(id, depenseId, photoId));
    }

    @PostMapping("/{id}/versements")
    @PreAuthorize("isAuthenticated()")
    public SejourVue creerVersement(@PathVariable Long id, @Valid @RequestBody FraisService.DemandeVersement d,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.creerVersement(id, d, frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/versements/{versementId}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue supprimerVersement(@PathVariable Long id, @PathVariable Long versementId,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.supprimerVersement(id, versementId, frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    /**
     * Envoie l'adresse des frais (lien + code par e-mail) aux participants
     * sans compte ; {@code participantId} : à lui seul.
     */
    @PostMapping("/{id}/acces-frais")
    @PreAuthorize(GERE)
    public AccesFraisService.BilanEnvoiAcces envoyerAccesFrais(@PathVariable Long id,
                                                               @RequestParam(required = false) Long participantId) {
        return acces.envoyerAcces(id, participantId);
    }

    static byte[] octets(MultipartFile fichier) {
        try {
            return fichier.getBytes();
        } catch (IOException e) {
            throw new RegleMetierException("La photo n'a pas pu être lue.");
        }
    }

    static ResponseEntity<byte[]> image(FraisService.ContenuPhoto p) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(p.type()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                .body(p.contenu());
    }

    /** Chaque participant reçoit son carnet : son voyage, sa voiture, sa chambre, le programme, les affaires. */
    @PostMapping("/{id}/envoi-carnet")
    @PreAuthorize(GERE)
    public BilanEnvoiCarnet envoyerCarnet(@PathVariable Long id) {
        return carnets.envoyer(id);
    }
}
