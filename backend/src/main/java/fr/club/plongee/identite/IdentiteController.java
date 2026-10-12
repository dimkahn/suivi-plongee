package fr.club.plongee.identite;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.identite.IdentiteStructureService.DemandeIdentite;
import fr.club.plongee.identite.IdentiteStructureService.IdentiteVue;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;

/**
 * Identité de la structure : lue sans connexion (page de connexion, icônes de
 * l'appli installée), modifiée par un ADMIN depuis /admin/identite.
 */
@RestController
@RequestMapping("/api/identite")
public class IdentiteController {

    /** Tailles d'icône servies : celles du manifeste, et 180 pour iOS. */
    private static final Set<Integer> TAILLES = Set.of(180, 192, 512);

    private final IdentiteStructureService service;

    public IdentiteController(IdentiteStructureService service) {
        this.service = service;
    }

    @GetMapping
    public IdentiteVue lire() {
        return service.lire();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public IdentiteVue modifier(@RequestBody DemandeIdentite demande) {
        return service.modifier(demande);
    }

    /** Le logo en PNG ; l'adresse porte la version (?v=), d'où un long cache. */
    @GetMapping(value = "/logo.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> logo() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .contentType(MediaType.IMAGE_PNG).body(service.logoPng());
    }

    @PutMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public IdentiteVue deposerLogo(@RequestParam("fichier") MultipartFile fichier) throws IOException {
        return service.deposerLogo(fichier.getBytes());
    }

    @DeleteMapping("/logo")
    @PreAuthorize("hasRole('ADMIN')")
    public IdentiteVue supprimerLogo() {
        return service.supprimerLogo();
    }

    @GetMapping(value = "/icone/{taille}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> icone(@PathVariable int taille,
                                        @RequestParam(defaultValue = "false") boolean masquable) {
        if (!TAILLES.contains(taille)) {
            throw new RegleMetierException("Taille d'icône inconnue : 180, 192 ou 512.");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .contentType(MediaType.IMAGE_PNG).body(service.icone(taille, masquable, taille == 180));
    }

    @GetMapping(value = "/manifest.webmanifest", produces = "application/manifest+json")
    public Map<String, Object> manifeste() {
        return service.manifeste();
    }
}
