package fr.club.plongee.securite;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.PhotoUtilisateurRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import fr.club.plongee.securite.service.PhotoMoniteurService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Le moniteur dépose ou retire lui-même sa photo du trombinoscope, depuis
 * « Mon compte ». Déposer sa propre photo vaut consentement (le droit à
 * l'image est coché au passage) ; la retirer retire aussi ce consentement.
 * L'utilisateur vient toujours du SecurityContext, jamais d'un identifiant
 * transmis par le client.
 */
@RestController
@RequestMapping("/api/auth/moi/photo")
public class MaPhotoController {

    private final UtilisateurRepository utilisateurs;
    private final PhotoUtilisateurRepository photos;
    private final PhotoMoniteurService photoService;

    public MaPhotoController(UtilisateurRepository utilisateurs, PhotoUtilisateurRepository photos,
                             PhotoMoniteurService photoService) {
        this.utilisateurs = utilisateurs;
        this.photos = photos;
        this.photoService = photoService;
    }

    @GetMapping
    @PreAuthorize("hasRole('MONITEUR')")
    public ResponseEntity<byte[]> photo(@AuthenticationPrincipal UtilisateurPrincipal principal) {
        Utilisateur u = moi(principal);
        if (!u.isAutorisationImage()) return ResponseEntity.notFound().build();
        return photos.findById(u.getId())
                .map(p -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(p.getTypeContenu()))
                        .body(p.getContenu()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('MONITEUR')")
    @Transactional
    public void deposer(@AuthenticationPrincipal UtilisateurPrincipal principal,
                        @RequestParam("fichier") MultipartFile fichier) {
        Utilisateur u = moi(principal);
        u.setAutorisationImage(true);
        try {
            photoService.deposer(u, fichier.getBytes(), fichier.getContentType());
        } catch (IOException e) {
            throw new RegleMetierException("La photo n'a pas pu être lue.");
        }
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('MONITEUR')")
    public void retirer(@AuthenticationPrincipal UtilisateurPrincipal principal) {
        photoService.changerAutorisationImage(moi(principal), false);
    }

    private Utilisateur moi(UtilisateurPrincipal principal) {
        return utilisateurs.findById(principal.id()).orElseThrow();
    }
}
