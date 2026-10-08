package fr.club.plongee.formation;

import fr.club.plongee.evaluation.service.HabilitationService;
import fr.club.plongee.formation.service.ProgrammeSeanceService;
import fr.club.plongee.formation.service.SchemaProgrammeService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Programme d'exercices d'une séance : un par groupe d'entraînement, plus un
 * programme commun. Consulté par tous les encadrants, préparé par ceux du
 * groupe (ou un admin), avant comme après la séance. La fiche de suivi d'un
 * élève en reçoit sa part avec la grille (voir GrilleService).
 */
@RestController
@RequestMapping("/api/seances/{seanceId}/programme")
public class ProgrammeSeanceController {

    private final ProgrammeSeanceService service;
    private final SchemaProgrammeService schemas;

    public ProgrammeSeanceController(ProgrammeSeanceService service, SchemaProgrammeService schemas) {
        this.service = service;
        this.schemas = schemas;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ProgrammeSeanceService.ProgrammeVue lire(@PathVariable Long seanceId, Authentication authentication) {
        return service.programme(seanceId, HabilitationService.principal(authentication));
    }

    /** Remplace le programme d'un groupe (sans groupe : le programme commun) par la liste reçue, dans son ordre. */
    @PutMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ProgrammeSeanceService.ProgrammeVue enregistrer(
            @PathVariable Long seanceId,
            @RequestParam(required = false) Long groupeId,
            @RequestBody List<ProgrammeSeanceService.DemandeExercice> exercices,
            Authentication authentication) {
        return service.enregistrer(seanceId, groupeId, exercices, HabilitationService.principal(authentication));
    }

    /**
     * Dépose le schéma d'un exercice libre ; renvoie son id, que l'exercice
     * cite à l'enregistrement du programme (sinon il est effacé après un jour).
     */
    @PostMapping("/schemas")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public Map<String, Long> deposerSchema(@PathVariable Long seanceId,
                                           @RequestParam("fichier") MultipartFile fichier) throws IOException {
        return Map.of("id", schemas.deposer(seanceId, fichier.getContentType(), fichier.getBytes()));
    }

    /** Un schéma ne change jamais : un nouveau dépôt a un nouvel id. */
    @GetMapping("/schemas/{schemaId}")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> lireSchema(@PathVariable Long seanceId, @PathVariable Long schemaId) {
        return schemas.lire(seanceId, schemaId)
                .map(s -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(s.typeContenu()))
                        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
                        .body(s.contenu()))
                .orElse(ResponseEntity.notFound().build());
    }
}
