package fr.club.plongee.materiel;

import fr.club.plongee.materiel.service.ImportMaterielService;
import fr.club.plongee.materiel.service.ImportMaterielService.Rapport;
import fr.club.plongee.materiel.service.InspectionTivService;
import fr.club.plongee.materiel.service.InspectionTivService.DemandeInspectionTiv;
import fr.club.plongee.materiel.service.InspectionTivService.InspectionTivVue;
import fr.club.plongee.materiel.service.InspectionTivService.ModeleInspectionVue;
import fr.club.plongee.materiel.service.MaterielService;
import fr.club.plongee.materiel.service.MaterielService.DemandeEquipement;
import fr.club.plongee.materiel.service.MaterielService.DemandeIntervention;
import fr.club.plongee.materiel.service.MaterielService.DemandeRebut;
import fr.club.plongee.materiel.service.MaterielService.EquipementVue;
import fr.club.plongee.materiel.service.MaterielService.InterventionVue;
import fr.club.plongee.materiel.service.PretService;
import fr.club.plongee.materiel.service.PretService.DemandePret;
import fr.club.plongee.materiel.service.PretService.DemandeRetour;
import fr.club.plongee.materiel.service.PretService.EmprunteurVue;
import fr.club.plongee.materiel.service.PretService.PretVue;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.materiel.domain.PhotoPret;
import fr.club.plongee.materiel.service.PhotoPretService;
import fr.club.plongee.materiel.service.PhotoPretService.ContenuPhoto;
import fr.club.plongee.materiel.service.PhotoPretService.PhotoVue;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;

import java.util.List;

/**
 * Matériel du club et prêts pour les sorties : le domaine du directeur
 * technique. Un ADMIN y a accès aussi, pour le suppléer. L'auteur d'une
 * saisie vient toujours du SecurityContext.
 */
@RestController
@RequestMapping("/api/materiel")
@PreAuthorize("hasAnyRole('DIRECTEUR_TECHNIQUE','ADMIN')")
public class MaterielController {

    /** La fiche de gestion d'un équipement : description, journal, prêts. */
    public record FicheEquipementVue(EquipementVue equipement, List<InterventionVue> journal, List<PretVue> prets) {}

    private final MaterielService materiel;
    private final PretService prets;
    private final PhotoPretService photos;
    private final ImportMaterielService imports;
    private final InspectionTivService inspectionsTiv;

    public MaterielController(MaterielService materiel, PretService prets, PhotoPretService photos,
                              ImportMaterielService imports, InspectionTivService inspectionsTiv) {
        this.materiel = materiel;
        this.prets = prets;
        this.photos = photos;
        this.imports = imports;
        this.inspectionsTiv = inspectionsTiv;
    }

    @GetMapping("/equipements")
    public List<EquipementVue> lister() {
        return materiel.lister();
    }

    @GetMapping("/equipements/{id}")
    public FicheEquipementVue fiche(@PathVariable Long id) {
        return new FicheEquipementVue(materiel.lire(id), materiel.journal(id), prets.parEquipement(id));
    }

    @PostMapping("/equipements")
    @ResponseStatus(HttpStatus.CREATED)
    public EquipementVue creer(@Valid @RequestBody DemandeEquipement demande,
                               @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return materiel.creer(demande, auteur.id());
    }

    @PutMapping("/equipements/{id}")
    public EquipementVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeEquipement demande) {
        return materiel.modifier(id, demande);
    }

    @DeleteMapping("/equipements/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        materiel.supprimer(id);
    }

    @PostMapping("/equipements/{id}/rebut")
    public EquipementVue mettreAuRebut(@PathVariable Long id, @Valid @RequestBody DemandeRebut demande) {
        return materiel.mettreAuRebut(id, demande);
    }

    @DeleteMapping("/equipements/{id}/rebut")
    public EquipementVue remettreEnStock(@PathVariable Long id) {
        return materiel.remettreEnStock(id);
    }

    @PostMapping("/equipements/{id}/interventions")
    @ResponseStatus(HttpStatus.CREATED)
    public InterventionVue ajouterIntervention(@PathVariable Long id, @Valid @RequestBody DemandeIntervention demande,
                                               @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return materiel.ajouterIntervention(id, demande, auteur.id());
    }

    /** Les questions de la fiche d'inspection qui concernent ce bloc, et ce qui peut être pré-rempli. */
    @GetMapping("/equipements/{id}/inspections-tiv/modele")
    public ModeleInspectionVue modeleInspectionTiv(@PathVariable Long id,
                                                   @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return inspectionsTiv.modele(id, auteur.id());
    }

    @PostMapping("/equipements/{id}/inspections-tiv")
    @ResponseStatus(HttpStatus.CREATED)
    public InspectionTivVue enregistrerInspectionTiv(@PathVariable Long id,
                                                     @Valid @RequestBody DemandeInspectionTiv demande,
                                                     @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return inspectionsTiv.enregistrer(id, demande, auteur.id());
    }

    @GetMapping("/inspections-tiv/{id}")
    public InspectionTivVue inspectionTiv(@PathVariable Long id) {
        return inspectionsTiv.lire(id);
    }

    /** {@code enCours} : prêts non rendus (défaut) ; sinon l'historique des prêts rendus. */
    @GetMapping("/prets")
    public List<PretVue> prets(@RequestParam(defaultValue = "true") boolean enCours) {
        return prets.lister(enCours);
    }

    @PostMapping("/prets")
    @ResponseStatus(HttpStatus.CREATED)
    public PretVue preter(@Valid @RequestBody DemandePret demande,
                          @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return prets.creer(demande, auteur.id());
    }

    @PostMapping("/prets/{id}/retour")
    public PretVue rendre(@PathVariable Long id, @Valid @RequestBody DemandeRetour demande,
                          @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return prets.rendre(id, demande, auteur.id());
    }

    @DeleteMapping("/prets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void annuler(@PathVariable Long id) {
        prets.annuler(id);
    }

    @GetMapping("/prets/{id}/photos")
    public List<PhotoVue> photos(@PathVariable Long id) {
        return photos.lister(id);
    }

    /** Multipart : {@code fichier}, {@code moment} (AVANT/APRES), {@code equipementId} et {@code legende} facultatifs. */
    @PostMapping("/prets/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoVue deposerPhoto(@PathVariable Long id, @RequestParam("fichier") MultipartFile fichier,
                                 @RequestParam PhotoPret.Moment moment,
                                 @RequestParam(required = false) Long equipementId,
                                 @RequestParam(required = false) String legende,
                                 @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        try {
            return photos.deposer(id, moment, equipementId, legende, fichier.getBytes(), fichier.getContentType(),
                    auteur.id());
        } catch (IOException e) {
            throw new RegleMetierException("La photo n'a pas pu être lue.");
        }
    }

    /** Le contenu ne change jamais pour un id donné : le navigateur peut le garder. */
    @GetMapping("/prets/photos/{photoId}")
    public ResponseEntity<byte[]> photo(@PathVariable Long photoId) {
        ContenuPhoto c = photos.contenu(photoId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(c.type()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePrivate())
                .body(c.contenu());
    }

    @DeleteMapping("/prets/photos/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimerPhoto(@PathVariable Long photoId) {
        photos.supprimer(photoId);
    }

    /** Multipart : {@code fichier}, le classeur Excel du matériel tenu avant l'application. */
    @PostMapping("/import")
    public Rapport importer(@RequestParam("fichier") MultipartFile fichier,
                            @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        try {
            return imports.importer(fichier.getBytes(), auteur.id());
        } catch (IOException e) {
            throw new RegleMetierException("Le fichier n'a pas pu être lu.");
        }
    }

    @GetMapping("/emprunteurs")
    public List<EmprunteurVue> emprunteurs() {
        return prets.emprunteurs();
    }

}
