package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.List;

/**
 * Fiche de sécurité d'une séance (A322-72) : notamment noms, prénoms,
 * aptitudes et fonction des plongeurs par palanquée, et les paramètres de
 * plongée de chaque palanquée, prévus puis réalisés. Facultative pour les
 * séances en piscine peu profonde (exemption A322-98), disponible ici pour
 * toutes : au DP de juger.
 *
 * <p>Établissement ({@link #enregistrer}) et complément du réalisé
 * ({@link #enregistrerRealise}) sont deux écritures distinctes : la première,
 * avant la mise à l'eau, fixe le DP, les conditions et la composition des
 * palanquées ; la seconde, au retour, ne touche que le profil réellement
 * plongé, sans avoir à ressaisir la liste des plongeurs.
 *
 * <p>Toute la lecture des entités (dp, seance, palanquees, membres — toutes
 * chargées à la demande) reste dans {@link FicheSecuriteService}, dont les
 * méthodes sont transactionnelles : ce contrôleur ne reçoit et ne renvoie que
 * des DTO déjà assemblés, jamais l'entité elle-même.
 */
@RestController
@RequestMapping("/api/seances/{seanceId}/fiche-securite")
public class FicheSecuriteController {

    public record DemandePlongeur(Long eleveId, Long utilisateurId, @NotBlank String nom,
                                  @NotBlank String prenom, String aptitude, String qualificationPreparee,
                                  FonctionPalanquee fonction, String gaz, String moyenDesaturation,
                                  String observations) {}

    public record DemandePalanquee(@NotNull Integer numero, Integer profondeurPrevue, Integer dureePrevue,
                                   @NotNull List<@Valid DemandePlongeur> membres) {}

    public record DemandeFicheSecurite(@NotNull Long dpId, String meteo, String etatMer,
                                       String visibilite, String courant, String maree,
                                       String temperatureEau, String securiteSurface,
                                       String planSecours, String observations,
                                       @NotNull List<@Valid DemandePalanquee> palanquees) {}

    public record DemandeProfilRealise(@NotNull Integer numero, Integer profondeurRealisee,
                                       Integer dureeRealisee, String paliers,
                                       LocalTime heureImmersion, LocalTime heureSortie) {}

    private final FicheSecuriteService service;

    public FicheSecuriteController(FicheSecuriteService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public FicheSecuriteService.FicheSecuriteVue consulter(@PathVariable Long seanceId) {
        return service.consulter(seanceId);
    }

    /** Établissement, avant la mise à l'eau : DP, conditions, composition des palanquées et profil prévu. */
    @PutMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public FicheSecuriteService.FicheSecuriteVue enregistrer(@PathVariable Long seanceId,
                                                             @Valid @RequestBody DemandeFicheSecurite demande) {
        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(
                demande.dpId(), demande.meteo(), demande.etatMer(), demande.visibilite(),
                demande.courant(), demande.maree(), demande.temperatureEau(),
                demande.securiteSurface(), demande.planSecours(), demande.observations(),
                demande.palanquees().stream()
                        .map(p -> new FicheSecuriteService.GroupePlongeurs(p.numero(),
                                p.profondeurPrevue(), p.dureePrevue(),
                                p.membres().stream().map(this::plongeur).toList()))
                        .toList());
        return service.enregistrer(seanceId, saisie);
    }

    /** Complément, au retour de plongée : le profil réellement plongé, palanquée par palanquée. */
    @PutMapping("/realise")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public FicheSecuriteService.FicheSecuriteVue enregistrerRealise(@PathVariable Long seanceId,
                                                                    @Valid @RequestBody List<DemandeProfilRealise> demande) {
        List<FicheSecuriteService.ProfilRealise> profils = demande.stream()
                .map(d -> new FicheSecuriteService.ProfilRealise(d.numero(), d.profondeurRealisee(),
                        d.dureeRealisee(), d.paliers(), d.heureImmersion(), d.heureSortie()))
                .toList();
        return service.enregistrerRealise(seanceId, profils);
    }

    /** Réservée à l'ADMIN, comme la suppression d'une séance : un geste rare, pour corriger une erreur. */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void supprimer(@PathVariable Long seanceId) {
        service.supprimer(seanceId);
    }

    @GetMapping(value = "/fiche.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> fichePdf(@PathVariable Long seanceId) {
        FicheSecuritePdfService.FichePdf pdf = service.genererPdf(seanceId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + pdf.nomFichier() + "\"")
                .body(pdf.contenu());
    }

    @GetMapping(value = "/fiche.xlsx",
            produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public ResponseEntity<byte[]> ficheExcel(@PathVariable Long seanceId) {
        FicheSecuriteExcelService.FicheExcel excel = service.genererExcel(seanceId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + excel.nomFichier() + "\"")
                .body(excel.contenu());
    }

    private FicheSecuriteService.Plongeur plongeur(DemandePlongeur d) {
        return new FicheSecuriteService.Plongeur(d.eleveId(), d.utilisateurId(), d.nom(), d.prenom(),
                d.aptitude(), d.qualificationPreparee(), d.fonction(),
                d.gaz(), d.moyenDesaturation(), d.observations());
    }
}
