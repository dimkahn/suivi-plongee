package fr.club.plongee.sejour;

import fr.club.plongee.sejour.AccesSejourService.*;
import fr.club.plongee.sejour.PretsSejourService.DemandeDeclarationPret;
import fr.club.plongee.sejour.PretsSejourService.DemandeRienEmprunte;
import fr.club.plongee.sejour.PretsSejourService.PretsSejourVue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Le séjour pour un participant qui n'est pas encadrant, à l'adresse
 * {@code /sejour/{code}} de l'appli : le carnet du séjour, ses informations
 * (voyage, repas, personne à prévenir) et les frais. Hors de la connexion habituelle
 * ({@code /api/public/**} est ouvert dans SecurityConfig) : le contrôle se
 * fait ici, par le code de l'adresse puis le jeton reçu après le code à
 * 6 chiffres, dans l'en-tête {@code X-Jeton-Sejour}. Les droits sur les
 * frais sont ceux de {@link FraisService} pour ce participant.
 */
@RestController
@RequestMapping("/api/public/sejour/{code}")
public class AccesSejourController {

    public static final String EN_TETE_JETON = "X-Jeton-Sejour";

    public record DemandeCode(@NotBlank String email) {}

    public record DemandeConnexion(@NotBlank String email, @NotBlank String code) {}

    public record DepenseCreeePublique(long depenseId, FraisPublicVue vue) {}

    private final AccesSejourService acces;
    private final FraisService frais;
    private final PretsSejourService pretsSejour;
    private final CartesEmbarquementService cartes;

    public AccesSejourController(AccesSejourService acces, FraisService frais, PretsSejourService pretsSejour,
                                 CartesEmbarquementService cartes) {
        this.acces = acces;
        this.frais = frais;
        this.pretsSejour = pretsSejour;
        this.cartes = cartes;
    }

    @GetMapping("/moi")
    public MesInformationsVue mesInformations(@PathVariable String code,
                                              @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        return acces.mesInformations(code, acces.acces(code, jeton));
    }

    /** Le carnet du séjour (programme, voitures, chambres, affaires, infos pratiques), tenu à jour. */
    @GetMapping("/carnet")
    public SejourService.SejourVue carnet(@PathVariable String code,
                                          @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        return acces.carnet(acces.acces(code, jeton));
    }

    @PutMapping("/moi")
    public MesInformationsVue modifierMesInformations(@PathVariable String code,
                                                      @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                                      @Valid @RequestBody SejourService.DemandeMesInformations d) {
        return acces.modifierMesInformations(code, acces.acces(code, jeton), d);
    }

    /** Sa carte d'embarquement (PDF ou photo), jointe à son aller ou à son retour ; renvoie le carnet à jour. */
    @PostMapping(value = "/cartes-embarquement/{sens}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SejourService.SejourVue deposerCarte(@PathVariable String code, @PathVariable SejourService.SensTrajet sens,
                                                @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                                @RequestParam("fichier") MultipartFile fichier) {
        Acces a = acces.acces(code, jeton);
        cartes.deposer(a.sortieId(), a.participantId(), sens, SejourController.octets(fichier), fichier.getContentType());
        return acces.carnet(a);
    }

    @DeleteMapping("/cartes-embarquement/{sens}")
    public SejourService.SejourVue retirerCarte(@PathVariable String code, @PathVariable SejourService.SensTrajet sens,
                                                @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        cartes.retirer(a.sortieId(), a.participantId(), sens);
        return acces.carnet(a);
    }

    @GetMapping("/cartes-embarquement/{sens}")
    public ResponseEntity<byte[]> carte(@PathVariable String code, @PathVariable SejourService.SensTrajet sens,
                                        @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        return SejourController.carte(cartes.lire(a.sortieId(), a.participantId(), sens), sens);
    }

    @GetMapping
    public EnteteVue entete(@PathVariable String code) {
        return acces.entete(code);
    }

    /** Toujours 204 : la réponse ne dit pas si l'e-mail est celui d'un participant. */
    @PostMapping("/code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void demanderCode(@PathVariable String code, @Valid @RequestBody DemandeCode d) {
        acces.demanderCode(code, d.email());
    }

    @PostMapping("/connexion")
    public Connexion connecter(@PathVariable String code, @Valid @RequestBody DemandeConnexion d) {
        return acces.connecter(code, d.email(), d.code());
    }

    @PostMapping("/deconnexion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deconnecter(@RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        acces.deconnecter(jeton);
    }

    @GetMapping("/frais")
    public FraisPublicVue lire(@PathVariable String code, @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        return acces.vue(code, acces.acces(code, jeton));
    }

    @PostMapping("/depenses")
    public DepenseCreeePublique creerDepense(@PathVariable String code,
                                             @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                             @Valid @RequestBody FraisService.DemandeDepense d) {
        Acces a = acces.acces(code, jeton);
        long id = frais.creerDepense(a.sortieId(), d, frais.acteurParticipant(a.participantId()));
        return new DepenseCreeePublique(id, acces.vue(code, a));
    }

    @PostMapping(value = "/depenses/lecture-note", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LecteurNote.NoteLue lireNote(@PathVariable String code,
                                        @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                        @RequestParam("fichier") MultipartFile fichier) {
        Acces a = acces.acces(code, jeton);
        return frais.lireNote(a.sortieId(), SejourController.octets(fichier), fichier.getContentType(),
                frais.acteurParticipant(a.participantId()));
    }

    @GetMapping("/lecture-notes/regles")
    public List<ReglesLectureService.RegleApprise> reglesLecture(@PathVariable String code,
                                                                @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        return frais.reglesLecture(a.sortieId(), frais.acteurParticipant(a.participantId()));
    }

    @PostMapping("/lecture-notes/apprentissage")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apprendreLecture(@PathVariable String code,
                                 @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                 @RequestBody ReglesLectureService.Lecon lecon) {
        Acces a = acces.acces(code, jeton);
        frais.apprendreLecture(a.sortieId(), lecon, frais.acteurParticipant(a.participantId()));
    }

    @PutMapping("/depenses/{depenseId}")
    public FraisPublicVue modifierDepense(@PathVariable String code, @PathVariable Long depenseId,
                                          @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                          @Valid @RequestBody FraisService.DemandeDepense d) {
        Acces a = acces.acces(code, jeton);
        frais.modifierDepense(a.sortieId(), depenseId, d, frais.acteurParticipant(a.participantId()));
        return acces.vue(code, a);
    }

    @DeleteMapping("/depenses/{depenseId}")
    public FraisPublicVue supprimerDepense(@PathVariable String code, @PathVariable Long depenseId,
                                           @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        frais.supprimerDepense(a.sortieId(), depenseId, frais.acteurParticipant(a.participantId()));
        return acces.vue(code, a);
    }

    @PostMapping(value = "/depenses/{depenseId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FraisPublicVue ajouterPhoto(@PathVariable String code, @PathVariable Long depenseId,
                                       @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                       @RequestParam("fichier") MultipartFile fichier) {
        Acces a = acces.acces(code, jeton);
        frais.ajouterPhoto(a.sortieId(), depenseId, SejourController.octets(fichier), fichier.getContentType(),
                frais.acteurParticipant(a.participantId()));
        return acces.vue(code, a);
    }

    @DeleteMapping("/depenses/{depenseId}/photos/{photoId}")
    public FraisPublicVue supprimerPhoto(@PathVariable String code, @PathVariable Long depenseId,
                                         @PathVariable Long photoId,
                                         @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        frais.supprimerPhoto(a.sortieId(), depenseId, photoId, frais.acteurParticipant(a.participantId()));
        return acces.vue(code, a);
    }

    @GetMapping("/depenses/{depenseId}/photos/{photoId}")
    public ResponseEntity<byte[]> photo(@PathVariable String code, @PathVariable Long depenseId,
                                        @PathVariable Long photoId,
                                        @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        return SejourController.image(frais.photo(a.sortieId(), depenseId, photoId));
    }

    @PostMapping("/versements")
    public FraisPublicVue creerVersement(@PathVariable String code,
                                         @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                         @Valid @RequestBody FraisService.DemandeVersement d) {
        Acces a = acces.acces(code, jeton);
        frais.creerVersement(a.sortieId(), d, frais.acteurParticipant(a.participantId()));
        return acces.vue(code, a);
    }

    /** Le matériel que ce participant a emprunté, et ce qu'il peut déclarer. */
    @GetMapping("/prets")
    public PretsSejourVue prets(@PathVariable String code,
                                @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        return pretsSejour.lire(a.sortieId(), frais.acteurParticipant(a.participantId()), false);
    }

    @PostMapping("/prets")
    public PretsSejourVue declarerPret(@PathVariable String code,
                                       @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                       @Valid @RequestBody DemandeDeclarationPret d) {
        Acces a = acces.acces(code, jeton);
        pretsSejour.declarer(a.sortieId(), d, frais.acteurParticipant(a.participantId()));
        return pretsSejour.lire(a.sortieId(), frais.acteurParticipant(a.participantId()), false);
    }

    @PutMapping("/prets/rien-emprunte")
    public PretsSejourVue rienEmprunte(@PathVariable String code,
                                       @RequestHeader(value = EN_TETE_JETON, required = false) String jeton,
                                       @Valid @RequestBody DemandeRienEmprunte d) {
        Acces a = acces.acces(code, jeton);
        pretsSejour.rienEmprunte(a.sortieId(), d.rienEmprunte(), frais.acteurParticipant(a.participantId()));
        return pretsSejour.lire(a.sortieId(), frais.acteurParticipant(a.participantId()), false);
    }

    @DeleteMapping("/prets/{pretId}")
    public PretsSejourVue annulerPret(@PathVariable String code, @PathVariable Long pretId,
                                      @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        pretsSejour.annuler(a.sortieId(), pretId, frais.acteurParticipant(a.participantId()));
        return pretsSejour.lire(a.sortieId(), frais.acteurParticipant(a.participantId()), false);
    }

    @DeleteMapping("/versements/{versementId}")
    public FraisPublicVue supprimerVersement(@PathVariable String code, @PathVariable Long versementId,
                                             @RequestHeader(value = EN_TETE_JETON, required = false) String jeton) {
        Acces a = acces.acces(code, jeton);
        frais.supprimerVersement(a.sortieId(), versementId, frais.acteurParticipant(a.participantId()));
        return acces.vue(code, a);
    }
}
