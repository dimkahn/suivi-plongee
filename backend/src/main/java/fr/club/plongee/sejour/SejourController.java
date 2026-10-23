package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.sejour.CarnetSejourService.BilanEnvoiCarnet;
import fr.club.plongee.sejour.PretsSejourService.DemandeDeclarationPret;
import fr.club.plongee.sejour.PretsSejourService.DemandeRienEmprunte;
import fr.club.plongee.sejour.PretsSejourService.PretsSejourVue;
import fr.club.plongee.sejour.SejourService.*;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
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
 * modifié par son créateur (qui a créé la sortie) et les organisateurs
 * qu'il a désignés ({@link DroitsSejour}). Chaque modification renvoie le
 * séjour à jour.
 */
@RestController
@RequestMapping("/api/sejours")
public class SejourController {

    public record DemandeInfos(String infosPratiques) {}

    public record DemandeConseilAssurance(@Size(max = 2000) String conseilAssurance) {}

    public record DemandeGroupe(@NotNull Long groupeId) {}

    public record DemandeAffaires(@NotNull List<@Valid DemandeAffaire> affaires) {}

    /** À qui envoyer un e-mail du séjour : {@code participantIds} absent = à tous les participants. */
    public record DemandeDestinataires(List<@NotNull Long> participantIds) {}

    /** Le créateur du séjour et les organisateurs qu'il a désignés (DroitsSejour), quel que soit leur rôle. */
    private static final String GERE = "@droitsSejour.organise(#id, authentication)";

    /** Les organisateurs désignés par le créateur (lui-même l'est toujours). */
    public record DemandeOrganisateurs(@NotNull List<@NotNull Long> utilisateurIds) {}

    /** La dépense créée (pour y joindre la photo de la note) et le séjour à jour. */
    public record DepenseCreee(long depenseId, SejourVue sejour) {}

    private final SejourService service;
    private final CarnetSejourService carnets;
    private final FraisService frais;
    private final AccesSejourService acces;
    private final PretsSejourService pretsSejour;
    private final CartesEmbarquementService cartes;
    private final AttestationsAssuranceService attestations;
    private final RejeuSejour rejeu;
    private final TrombinoscopeSejourService trombinoscope;

    public SejourController(SejourService service, CarnetSejourService carnets, FraisService frais,
                            AccesSejourService acces, PretsSejourService pretsSejour,
                            CartesEmbarquementService cartes, AttestationsAssuranceService attestations,
                            RejeuSejour rejeu, TrombinoscopeSejourService trombinoscope) {
        this.trombinoscope = trombinoscope;
        this.service = service;
        this.carnets = carnets;
        this.frais = frais;
        this.acces = acces;
        this.pretsSejour = pretsSejour;
        this.cartes = cartes;
        this.attestations = attestations;
        this.rejeu = rejeu;
    }

    /** {@code toutes} : aussi les séjours passés (encadrants). Un participant ne voit que les siens. */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<SejourResumeVue> lister(@RequestParam(defaultValue = "false") boolean toutes,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return service.lister(toutes, moi);
    }

    /** {@code commeParticipant} : un encadrant le voit comme un participant (le carnet, filtré par le serveur). */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue lire(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean commeParticipant,
                          @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return service.lire(id, moi, commeParticipant);
    }

    /** Le créateur choisit qui organise avec lui ; un ADMIN aussi, pour reprendre un séjour. */
    @PutMapping("/{id}/organisateurs")
    @PreAuthorize("@droitsSejour.peutDesigner(#id, authentication)")
    public SejourVue definirOrganisateurs(@PathVariable Long id, @Valid @RequestBody DemandeOrganisateurs d,
                                          @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.definirOrganisateurs(id, d.utilisateurIds());
        return service.lire(id, moi);
    }

    @PutMapping("/{id}/infos")
    @PreAuthorize(GERE)
    public SejourVue definirInfos(@PathVariable Long id, @RequestBody DemandeInfos d,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.definirInfos(id, d.infosPratiques());
        return service.lire(id, moi);
    }

    /** Le conseil montré à qui n'a pas joint son attestation d'assurance ; vide, pas d'encart. */
    @PutMapping("/{id}/conseil-assurance")
    @PreAuthorize(GERE)
    public SejourVue definirConseilAssurance(@PathVariable Long id, @Valid @RequestBody DemandeConseilAssurance d,
                                             @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.definirConseilAssurance(id, d.conseilAssurance());
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/participants")
    @PreAuthorize(GERE)
    public SejourVue ajouterParticipant(@PathVariable Long id, @Valid @RequestBody DemandeParticipant d,
                                        @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        rejeu.uneFois(id, reference, () -> service.ajouterParticipant(id, d));
        return service.lire(id, moi);
    }

    @PostMapping("/{id}/participants/groupe")
    @PreAuthorize(GERE)
    public SejourVue importerGroupe(@PathVariable Long id, @Valid @RequestBody DemandeGroupe d,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.importerGroupe(id, d.groupeId());
        return service.lire(id, moi);
    }

    /** Le même vol ou train (arrivée ou départ) pour plusieurs participants d'un coup. */
    @PutMapping("/{id}/trajets")
    @PreAuthorize(GERE)
    public SejourVue appliquerTrajet(@PathVariable Long id, @Valid @RequestBody DemandeTrajetCommun d,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        service.appliquerTrajet(id, d);
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

    // ------------------------------------------------------------------
    //  Carte d'embarquement : le voyageur et les organisateurs (CartesEmbarquementService).
    // ------------------------------------------------------------------

    /** Un PDF ou une photo, joint à l'aller ({@code ARRIVEE}) ou au retour ({@code DEPART}) ; remplace le précédent. */
    @PostMapping(value = "/{id}/participants/{participantId}/cartes-embarquement/{sens}",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public SejourVue deposerCarte(@PathVariable Long id, @PathVariable Long participantId, @PathVariable SensTrajet sens,
                                  @RequestParam("fichier") MultipartFile fichier,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        cartes.verifierDroit(id, participantId, moi);
        cartes.deposer(id, participantId, sens, octets(fichier), fichier.getContentType());
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/participants/{participantId}/cartes-embarquement/{sens}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue retirerCarte(@PathVariable Long id, @PathVariable Long participantId, @PathVariable SensTrajet sens,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        cartes.verifierDroit(id, participantId, moi);
        cartes.retirer(id, participantId, sens);
        return service.lire(id, moi);
    }

    @GetMapping("/{id}/participants/{participantId}/cartes-embarquement/{sens}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> carte(@PathVariable Long id, @PathVariable Long participantId,
                                        @PathVariable SensTrajet sens,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        cartes.verifierDroit(id, participantId, moi);
        return carte(cartes.lire(id, participantId, sens), sens);
    }

    // ------------------------------------------------------------------
    //  Trombinoscope : jamais une photo sans le droit à l'image ; les encadrants voient toutes
    //  les photos consenties, les participants celles qu'un organisateur leur a rendues visibles.
    // ------------------------------------------------------------------

    /** Les participants avec leur groupe de plongeurs, filtrés par le serveur selon qui lit. */
    @GetMapping("/{id}/trombinoscope")
    @PreAuthorize("isAuthenticated()")
    public List<TrombinoscopeSejourService.LigneTrombinoscopeSejour> trombinoscope(
            @PathVariable Long id, @RequestParam(defaultValue = "false") boolean commeParticipant,
            @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return trombinoscope.lister(id, vueComplete(id, moi, commeParticipant));
    }

    @GetMapping("/{id}/participants/{participantId}/photo")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> photo(@PathVariable Long id, @PathVariable Long participantId,
                                        @RequestParam(defaultValue = "false") boolean commeParticipant,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return photoTrombinoscope(trombinoscope.photo(id, participantId, vueComplete(id, moi, commeParticipant)));
    }

    /** Montrer sa photo aux autres participants : l'organisateur confirme l'accord de la personne. */
    public record DemandePhotoVisible(@NotNull Boolean visible, Boolean accord) {}

    @PutMapping("/{id}/participants/{participantId}/photo-visible")
    @PreAuthorize(GERE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rendrePhotoVisible(@PathVariable Long id, @PathVariable Long participantId,
                                   @Valid @RequestBody DemandePhotoVisible d,
                                   @AuthenticationPrincipal UtilisateurPrincipal moi) {
        trombinoscope.rendreVisible(id, participantId, d.visible(), Boolean.TRUE.equals(d.accord()), moi.id());
    }

    /**
     * Un encadrant voit le trombinoscope complet (sauf « comme un participant ») ;
     * un participant du séjour, la vue des participants ; les autres, 403.
     */
    private boolean vueComplete(Long id, UtilisateurPrincipal moi, boolean commeParticipant) {
        boolean encadrant = SejourService.encadrant(moi);
        if (encadrant && !commeParticipant) return true;
        if (encadrant || frais.acteur(id, moi).participantId() != null) return false;
        throw new AccessDeniedException("Le trombinoscope n'est ouvert qu'aux participants du séjour et aux encadrants.");
    }

    static ResponseEntity<byte[]> photoTrombinoscope(java.util.Optional<TrombinoscopeSejourService.Photo> photo) {
        return photo.map(p -> ResponseEntity.ok().contentType(MediaType.parseMediaType(p.type()))
                        .cacheControl(CacheControl.noStore()).body(p.contenu()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** La photo d'un invité (sans dossier ni compte), avec son accord ; remplace la précédente. */
    @PostMapping(value = "/{id}/participants/{participantId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(GERE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deposerPhoto(@PathVariable Long id, @PathVariable Long participantId,
                             @RequestParam("fichier") MultipartFile fichier,
                             @RequestParam(defaultValue = "false") boolean accord,
                             @AuthenticationPrincipal UtilisateurPrincipal moi) {
        trombinoscope.deposer(id, participantId, accord, octets(fichier), fichier.getContentType(), moi.id());
    }

    @DeleteMapping("/{id}/participants/{participantId}/photo")
    @PreAuthorize(GERE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retirerPhoto(@PathVariable Long id, @PathVariable Long participantId) {
        trombinoscope.retirer(id, participantId);
    }

    // ------------------------------------------------------------------
    //  Attestation d'assurance : le participant et les organisateurs (AttestationsAssuranceService).
    // ------------------------------------------------------------------

    /** Un PDF ou une photo ; remplace la précédente. */
    @PostMapping(value = "/{id}/participants/{participantId}/attestation-assurance",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public SejourVue deposerAttestation(@PathVariable Long id, @PathVariable Long participantId,
                                        @RequestParam("fichier") MultipartFile fichier,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        attestations.verifierDroit(id, participantId, moi);
        attestations.deposer(id, participantId, octets(fichier), fichier.getContentType());
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/participants/{participantId}/attestation-assurance")
    @PreAuthorize("isAuthenticated()")
    public SejourVue retirerAttestation(@PathVariable Long id, @PathVariable Long participantId,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        attestations.verifierDroit(id, participantId, moi);
        attestations.retirer(id, participantId);
        return service.lire(id, moi);
    }

    @GetMapping("/{id}/participants/{participantId}/attestation-assurance")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> attestation(@PathVariable Long id, @PathVariable Long participantId,
                                              @AuthenticationPrincipal UtilisateurPrincipal moi) {
        attestations.verifierDroit(id, participantId, moi);
        return document(attestations.lire(id, participantId), "attestation-assurance");
    }

    /**
     * Montrée dans le navigateur, jamais gardée en cache : elle permet
     * d'embarquer. En bac à sable (CSP sandbox) : un PDF ne peut rien
     * exécuter au nom de l'appli.
     */
    static ResponseEntity<byte[]> carte(CartesEmbarquementService.ContenuCarte c, SensTrajet sens) {
        return document(c, "carte-embarquement-" + (sens == SensTrajet.ARRIVEE ? "aller" : "retour"));
    }

    /** Une carte d'embarquement ou une attestation d'assurance, servie de la même façon. */
    static ResponseEntity<byte[]> document(CartesEmbarquementService.ContenuCarte c, String nomSansExtension) {
        String nom = nomSansExtension
                + (c.type().equals("application/pdf") ? ".pdf" : c.type().equals("image/png") ? ".png" : ".jpg");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(c.type()))
                .cacheControl(CacheControl.noStore())
                .header("Content-Disposition", "inline; filename=\"" + nom + "\"")
                .header("Content-Security-Policy", "sandbox")
                .body(c.contenu());
    }

    @PostMapping("/{id}/voitures")
    @PreAuthorize(GERE)
    public SejourVue creerVoiture(@PathVariable Long id, @Valid @RequestBody DemandeVoiture d,
                                  @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                  @AuthenticationPrincipal UtilisateurPrincipal moi) {
        rejeu.uneFois(id, reference, () -> service.creerVoiture(id, d));
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
                                   @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                   @AuthenticationPrincipal UtilisateurPrincipal moi) {
        rejeu.uneFois(id, reference, () -> service.creerLogement(id, d));
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
                                    @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        rejeu.uneFois(id, reference, () -> service.creerEvenement(id, d));
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
                                     @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                     @AuthenticationPrincipal UtilisateurPrincipal moi) {
        FraisService.ActeurFrais acteur = frais.acteur(id, moi);
        long depenseId = rejeu.idCreeUneFois(id, reference, () -> frais.creerDepense(id, d, acteur));
        return new DepenseCreee(depenseId, service.lire(id, moi));
    }

    /** Montant total et date lus sur la photo de la note, pour pré-remplir la dépense ; rien n'est gardé. */
    @PostMapping(value = "/{id}/depenses/lecture-note", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public LecteurNote.NoteLue lireNote(@PathVariable Long id, @RequestParam("fichier") MultipartFile fichier,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return frais.lireNote(id, octets(fichier), fichier.getContentType(), frais.acteur(id, moi));
    }

    /** Les règles apprises des corrections, pour lire les notes sur le téléphone. */
    @GetMapping("/{id}/lecture-notes/regles")
    @PreAuthorize("isAuthenticated()")
    public List<ReglesLectureService.RegleApprise> reglesLecture(@PathVariable Long id,
                                                                @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return frais.reglesLecture(id, frais.acteur(id, moi));
    }

    /** Ce qui a été gardé ou corrigé après la lecture d'une note : commerçant, catégorie, libellé du total. */
    @PostMapping("/{id}/lecture-notes/apprentissage")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apprendreLecture(@PathVariable Long id, @RequestBody ReglesLectureService.Lecon lecon,
                                 @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.apprendreLecture(id, lecon, frais.acteur(id, moi));
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
                                    @RequestHeader(value = RejeuSejour.EN_TETE, required = false) String reference,
                                    @AuthenticationPrincipal UtilisateurPrincipal moi) {
        FraisService.ActeurFrais acteur = frais.acteur(id, moi);
        rejeu.uneFois(id, reference, () -> frais.creerVersement(id, d, acteur));
        return service.lire(id, moi);
    }

    @DeleteMapping("/{id}/versements/{versementId}")
    @PreAuthorize("isAuthenticated()")
    public SejourVue supprimerVersement(@PathVariable Long id, @PathVariable Long versementId,
                                        @AuthenticationPrincipal UtilisateurPrincipal moi) {
        frais.supprimerVersement(id, versementId, frais.acteur(id, moi));
        return service.lire(id, moi);
    }

    // ------------------------------------------------------------------
    //  Matériel emprunté : déclaré par les participants, comme les frais (PretsSejourService).
    // ------------------------------------------------------------------

    /** Un encadrant lit tous les emprunts du séjour ; un participant, les siens. */
    @GetMapping("/{id}/prets")
    @PreAuthorize("isAuthenticated()")
    public PretsSejourVue prets(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal moi) {
        FraisService.ActeurFrais acteur = frais.acteur(id, moi);
        boolean encadrant = SejourService.encadrant(moi);
        if (!encadrant && acteur.participantId() == null) {
            throw new AccessDeniedException("Ce séjour n'est ouvert qu'à ses participants et aux encadrants.");
        }
        return pretsSejour.lire(id, acteur, encadrant);
    }

    @PostMapping("/{id}/prets")
    @PreAuthorize("isAuthenticated()")
    public PretsSejourVue declarerPret(@PathVariable Long id, @Valid @RequestBody DemandeDeclarationPret d,
                                       @AuthenticationPrincipal UtilisateurPrincipal moi) {
        pretsSejour.declarer(id, d, frais.acteur(id, moi));
        return prets(id, moi);
    }

    /** « Je n'ai rien emprunté » : le participant connecté répond pour lui-même. */
    @PutMapping("/{id}/prets/rien-emprunte")
    @PreAuthorize("isAuthenticated()")
    public PretsSejourVue rienEmprunte(@PathVariable Long id, @Valid @RequestBody DemandeRienEmprunte d,
                                       @AuthenticationPrincipal UtilisateurPrincipal moi) {
        pretsSejour.rienEmprunte(id, d.rienEmprunte(), frais.acteur(id, moi));
        return prets(id, moi);
    }

    @DeleteMapping("/{id}/prets/{pretId}")
    @PreAuthorize("isAuthenticated()")
    public PretsSejourVue annulerPret(@PathVariable Long id, @PathVariable Long pretId,
                                      @AuthenticationPrincipal UtilisateurPrincipal moi) {
        pretsSejour.annuler(id, pretId, frais.acteur(id, moi));
        return prets(id, moi);
    }

    /**
     * Demande à chaque participant de renseigner ses informations (et lui
     * ouvre les frais) : l'encadrant dans l'appli, les autres par un lien et
     * un code par e-mail ; {@code participantId} : à lui seul ;
     * {@code participantIds} dans le corps : aux seuls participants choisis.
     */
    @PostMapping("/{id}/invitations")
    @PreAuthorize(GERE)
    public AccesSejourService.BilanEnvoiAcces envoyerInvitations(@PathVariable Long id,
                                                                 @RequestParam(required = false) Long participantId,
                                                                 @RequestBody(required = false) DemandeDestinataires d) {
        List<Long> choisis = participantId != null ? List.of(participantId) : d == null ? null : d.participantIds();
        return acces.envoyerInvitations(id, choisis);
    }

    /** Le participant connecté complète ses propres informations (voyage, repas, personne à prévenir). */
    @PutMapping("/{id}/mes-informations")
    @PreAuthorize("isAuthenticated()")
    public SejourVue modifierMesInformations(@PathVariable Long id,
                                             @Valid @RequestBody DemandeMesInformations d,
                                             @AuthenticationPrincipal UtilisateurPrincipal moi) {
        Long participant = frais.acteur(id, moi).participantId();
        if (participant == null) throw new RegleMetierException("Vous n'êtes pas inscrit à ce séjour.");
        service.modifierMesInformations(participant, d);
        return service.lire(id, moi);
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

    /**
     * Chaque participant reçoit son carnet : son voyage, sa voiture, sa chambre, le programme, les affaires ;
     * {@code participantIds} dans le corps : les seuls participants choisis.
     */
    @PostMapping("/{id}/envoi-carnet")
    @PreAuthorize(GERE)
    public BilanEnvoiCarnet envoyerCarnet(@PathVariable Long id,
                                          @RequestBody(required = false) DemandeDestinataires d) {
        return carnets.envoyer(id, d == null ? null : d.participantIds());
    }
}
