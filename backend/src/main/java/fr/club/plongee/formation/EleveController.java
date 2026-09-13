package fr.club.plongee.formation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Dossier d'un élève : identité, autorisations, photo. Le club suit des
 * mineurs : la gestion du dossier (création, modification, archivage) est
 * réservée aux ADMIN, la consultation aux encadrants.
 */
@RestController
@RequestMapping("/api/eleves")
public class EleveController {

    private static final Set<String> TYPES_ACCEPTES = Set.of(MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE);
    private static final long TAILLE_MAX_OCTETS = 5L * 1024 * 1024;

    public record EleveVue(Long id, String nom, String prenom, LocalDate dateNaissance,
                           String numeroLicence, LocalDate certificatValideJusquAu,
                           boolean autorisationLegale, boolean autorisationImage, boolean archive) {}

    public record DemandeEleve(@NotBlank String nom, @NotBlank String prenom, LocalDate dateNaissance,
                               String numeroLicence, LocalDate certificatValideJusquAu,
                               boolean autorisationLegale) {}

    public record DemandeAutorisationImage(@NotNull Boolean autorisationImage) {}

    private final EleveRepository eleves;
    private final PhotoEleveRepository photos;

    public EleveController(EleveRepository eleves, PhotoEleveRepository photos) {
        this.eleves = eleves;
        this.photos = photos;
    }

    /** Un élève ne disparaît jamais de la base : archivé, il sort seulement des listes actives. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<EleveVue> lister() {
        return eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc().stream().map(this::vue).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public EleveVue creer(@Valid @RequestBody DemandeEleve demande) {
        Eleve e = new Eleve();
        appliquer(e, demande);
        eleves.save(e);
        return vue(e);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public EleveVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeEleve demande) {
        Eleve e = eleve(id);
        appliquer(e, demande);
        eleves.save(e);
        return vue(e);
    }

    @PostMapping("/{id}/archivage")
    @PreAuthorize("hasRole('ADMIN')")
    public EleveVue archiver(@PathVariable Long id) {
        Eleve e = eleve(id);
        e.setArchiveLe(Instant.now());
        eleves.save(e);
        return vue(e);
    }

    @DeleteMapping("/{id}/archivage")
    @PreAuthorize("hasRole('ADMIN')")
    public EleveVue desarchiver(@PathVariable Long id) {
        Eleve e = eleve(id);
        e.setArchiveLe(null);
        eleves.save(e);
        return vue(e);
    }

    private void appliquer(Eleve e, DemandeEleve demande) {
        e.setNom(demande.nom());
        e.setPrenom(demande.prenom());
        e.setDateNaissance(demande.dateNaissance());
        e.setNumeroLicence(demande.numeroLicence());
        e.setCertificatValideJusquAu(demande.certificatValideJusquAu());
        e.setAutorisationLegale(demande.autorisationLegale());
    }

    private EleveVue vue(Eleve e) {
        return new EleveVue(e.getId(), e.getNom(), e.getPrenom(), e.getDateNaissance(),
                e.getNumeroLicence(), e.getCertificatValideJusquAu(),
                e.isAutorisationLegale(), e.isAutorisationImage(), e.getArchiveLe() != null);
    }

    /**
     * Réservé aux ADMIN : recueillir ce consentement est un acte de gestion
     * du dossier de l'élève, pas une saisie de terrain.
     */
    @PutMapping("/{eleveId}/autorisation-image")
    @PreAuthorize("hasRole('ADMIN')")
    public void changerAutorisationImage(@PathVariable Long eleveId,
                                         @Valid @RequestBody DemandeAutorisationImage demande) {
        Eleve eleve = eleve(eleveId);
        eleve.setAutorisationImage(demande.autorisationImage());
        eleves.save(eleve);
        // Un retrait de consentement supprime la photo elle-meme, pas seulement son affichage.
        if (!demande.autorisationImage()) {
            if (photos.existsById(eleveId)) photos.deleteById(eleveId);
        }
    }

    @GetMapping(value = "/{eleveId}/photo")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> photo(@PathVariable Long eleveId) {
        Eleve eleve = eleve(eleveId);
        if (!eleve.isAutorisationImage()) {
            return ResponseEntity.notFound().build();
        }
        return photos.findById(eleveId)
                .map(p -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(p.getTypeContenu()))
                        .body(p.getContenu()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{eleveId}/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deposerPhoto(@PathVariable Long eleveId, @RequestParam("fichier") MultipartFile fichier) {
        Eleve eleve = eleve(eleveId);
        if (!eleve.isAutorisationImage()) {
            throw new RegleMetierException(
                    "Le droit à l'image n'a pas été recueilli pour cet élève : "
                            + "cochez d'abord l'autorisation avant de déposer une photo.");
        }
        if (fichier.isEmpty()) {
            throw new RegleMetierException("Le fichier est vide.");
        }
        if (fichier.getSize() > TAILLE_MAX_OCTETS) {
            throw new RegleMetierException("La photo dépasse la taille maximale de 5 Mo.");
        }
        String type = fichier.getContentType();
        if (type == null || !TYPES_ACCEPTES.contains(type)) {
            throw new RegleMetierException("Seules les photos JPEG ou PNG sont acceptées.");
        }

        PhotoEleve photo = photos.findById(eleveId).orElseGet(PhotoEleve::new);
        photo.setEleve(eleve);
        try {
            photo.setContenu(fichier.getBytes());
        } catch (java.io.IOException e) {
            throw new RegleMetierException("La photo n'a pas pu être lue.");
        }
        photo.setTypeContenu(type);
        photo.setMiseAJourLe(Instant.now());
        photos.save(photo);
    }

    @DeleteMapping("/{eleveId}/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimerPhoto(@PathVariable Long eleveId) {
        eleve(eleveId);
        if (photos.existsById(eleveId)) photos.deleteById(eleveId);
    }

    private Eleve eleve(Long id) {
        return eleves.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable"));
    }
}
