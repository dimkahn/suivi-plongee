package fr.club.plongee.referentiel;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Schéma d'un exercice de la base : lu par les encadrants (grille, vue
 * globale, programme), déposé ou retiré par un ADMIN depuis /admin/exercices.
 */
@RestController
@RequestMapping("/api/exercices/{exerciceId}/schema")
public class SchemaExerciceController {

    private final SchemaExerciceService schemas;

    public SchemaExerciceController(SchemaExerciceService schemas) {
        this.schemas = schemas;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> lire(@PathVariable Long exerciceId) {
        return schemas.lire(exerciceId)
                .map(s -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(s.typeContenu()))
                        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
                        .body(s.contenu()))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public void deposer(@PathVariable Long exerciceId, @RequestParam("fichier") MultipartFile fichier)
            throws IOException {
        schemas.enregistrer(exerciceId, fichier.getContentType(), fichier.getBytes());
    }

    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long exerciceId) {
        schemas.supprimer(exerciceId);
    }
}
