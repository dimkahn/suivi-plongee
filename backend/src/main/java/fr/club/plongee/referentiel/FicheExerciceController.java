package fr.club.plongee.referentiel;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.referentiel.MediaExerciceService.PhotoVue;
import fr.club.plongee.referentiel.MediaExerciceService.VideoVue;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Fiche complète d'un exercice de la base : tout ce qu'un encadrant doit
 * savoir pour le mener (déroulement, réussite, conseils, schéma, photos,
 * vidéos) et sa place dans le parcours (périodes des progressions types,
 * exercices voisins de la compétence). Photos et vidéos se déposent ici par
 * un ADMIN ; réseau obligatoire, rien n'est embarqué hors ligne.
 */
@RestController
@RequestMapping("/api/exercices/{exerciceId}")
public class FicheExerciceController {

    public record CritereVue(Long id, String savoirFaire) {}

    /** Exercice voisin dans la compétence (précédent, suivant). */
    public record VoisinVue(Long id, String numero, String intitule, String phase) {}

    /** Période d'une progression type où l'exercice est prévu : mois, ou plongées (découpage par plongées). */
    public record PeriodeVue(Long progressionId, String progression, int rang, String intitule,
                             Integer moisDebut, Integer moisFin, Integer plongeeDebut, Integer plongeeFin,
                             String milieu) {}

    public record FicheVue(Long id, Long referentielId, String niveau, String versionMft,
                           Long blocId, int blocOrdre, String bloc, String regroupement,
                           String numero, String phase, String intitule,
                           String deroulement, String critereReussite, String conseils, boolean actif,
                           boolean aSchema, List<CritereVue> criteres,
                           List<PhotoVue> photos, List<VideoVue> videos, List<PeriodeVue> periodes,
                           VoisinVue precedent, VoisinVue suivant) {}

    public record DemandeVideo(String adresse, String legende) {}

    private final ExerciceCompetenceRepository exercices;
    private final SchemaExerciceService schemas;
    private final MediaExerciceService medias;
    private final JdbcTemplate jdbc;

    public FicheExerciceController(ExerciceCompetenceRepository exercices, SchemaExerciceService schemas,
                                   MediaExerciceService medias, JdbcTemplate jdbc) {
        this.exercices = exercices;
        this.schemas = schemas;
        this.medias = medias;
        this.jdbc = jdbc;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    @Transactional(readOnly = true)
    public FicheVue fiche(@PathVariable Long exerciceId) {
        ExerciceCompetence e = exercices.findById(exerciceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Exercice introuvable"));
        BlocCompetence bloc = e.getBloc();
        Referentiel r = bloc.getReferentiel();

        // Voisins parmi les exercices actifs de la compétence (et lui-même, même désactivé).
        List<ExerciceCompetence> duBloc = exercices.parReferentiel(r.getId()).stream()
                .filter(x -> x.getBloc().getId().equals(bloc.getId()) && (x.isActif() || x.getId().equals(e.getId())))
                .toList();
        int rang = duBloc.indexOf(duBloc.stream().filter(x -> x.getId().equals(e.getId())).findFirst().orElse(e));
        VoisinVue precedent = rang > 0 ? voisin(duBloc.get(rang - 1)) : null;
        VoisinVue suivant = rang >= 0 && rang < duBloc.size() - 1 ? voisin(duBloc.get(rang + 1)) : null;

        List<PeriodeVue> periodes = jdbc.query("""
                SELECT p.id, p.nom, pp.rang, pp.intitule, pp.mois_debut, pp.mois_fin,
                       pp.plongee_debut, pp.plongee_fin, pp.milieu
                  FROM periode_progression_exercice ppe
                  JOIN periode_progression pp ON pp.id = ppe.periode_id
                  JOIN progression_type p ON p.id = pp.progression_id
                 WHERE ppe.exercice_id = ?
                 ORDER BY p.nom, pp.rang""",
                (rs, i) -> new PeriodeVue(rs.getLong(1), rs.getString(2), rs.getInt(3), rs.getString(4),
                        rs.getObject(5, Integer.class), rs.getObject(6, Integer.class),
                        rs.getObject(7, Integer.class), rs.getObject(8, Integer.class), rs.getString(9)),
                exerciceId);

        return new FicheVue(e.getId(), r.getId(), r.getNiveau().name(), r.getVersionMft(),
                bloc.getId(), bloc.getOrdre(), bloc.getIntitule(), bloc.getRegroupement(),
                e.getNumero(), e.getPhase().name(), e.getIntitule(),
                e.getDeroulement(), e.getCritereReussite(), e.getConseils(), e.isActif(),
                schemas.avecSchema(List.of(e.getId())).contains(e.getId()),
                e.getCriteres().stream().sorted(Comparator.comparingInt(Critere::getOrdre))
                        .map(c -> new CritereVue(c.getId(), c.getSavoirFaire())).toList(),
                medias.photos(exerciceId), medias.videos(exerciceId), periodes, precedent, suivant);
    }

    private static VoisinVue voisin(ExerciceCompetence e) {
        return new VoisinVue(e.getId(), e.getNumero(), e.getIntitule(), e.getPhase().name());
    }

    @GetMapping("/photos/{photoId}")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> photo(@PathVariable Long exerciceId, @PathVariable Long photoId) {
        return medias.lirePhoto(exerciceId, photoId)
                .map(p -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(p.typeContenu()))
                        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
                        .body(p.contenu()))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/photos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public PhotoVue deposerPhoto(@PathVariable Long exerciceId, @RequestParam("fichier") MultipartFile fichier,
                                 @RequestParam(value = "legende", required = false) String legende,
                                 @RequestParam(value = "accordPersonnes", defaultValue = "false") boolean accordPersonnes)
            throws IOException {
        return medias.ajouterPhoto(exerciceId, fichier.getContentType(), fichier.getBytes(), legende, accordPersonnes);
    }

    @DeleteMapping("/photos/{photoId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimerPhoto(@PathVariable Long exerciceId, @PathVariable Long photoId) {
        medias.supprimerPhoto(exerciceId, photoId);
    }

    @PostMapping("/videos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public VideoVue ajouterVideo(@PathVariable Long exerciceId, @RequestBody DemandeVideo demande) {
        return medias.ajouterVideo(exerciceId, demande.adresse(), demande.legende());
    }

    @DeleteMapping("/videos/{videoId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimerVideo(@PathVariable Long exerciceId, @PathVariable Long videoId) {
        medias.supprimerVideo(exerciceId, videoId);
    }
}
