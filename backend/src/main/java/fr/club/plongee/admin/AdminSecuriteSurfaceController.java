package fr.club.plongee.admin;

import fr.club.plongee.admin.service.AdminSecuriteSurfaceService;
import fr.club.plongee.admin.service.AdminSecuriteSurfaceService.Acces;
import fr.club.plongee.admin.service.AdminSecuriteSurfaceService.Compte;
import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Comptes « sécurité surface » (pas moniteurs du club), réservés aux ADMIN
 * comme les comptes moniteurs ; écran Administration › Personnes ›
 * Sécurité surface. Chaque compte porte les séances qui lui sont confiées
 * et sa date de fin d'accès.
 */
@RestController
@RequestMapping("/api/admin/securite-surface")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSecuriteSurfaceController {

    public record SeanceConfieeVue(Long id, LocalDate date, Integer ordre, String milieu, String lieu,
                                   String site, String commentaire) {}

    /**
     * {@code actif} : le compte se connecte aujourd'hui ; {@code accesTermine} :
     * désactivé parce que sa date de fin d'accès est passée, pas à la main.
     */
    public record CompteSurfaceVue(Long id, String email, String nom, String prenom, boolean actif,
                                   boolean accesTermine, LocalDate accesJusquAu, List<SeanceConfieeVue> seances) {}

    public record DemandeCompteSurface(@NotBlank @Email String email, @NotBlank String nom,
                                       @NotBlank String prenom, List<Long> seanceIds, LocalDate accesJusquAu) {}

    /** Pour réactiver : les séances confiées et la nouvelle date de fin d'accès. */
    public record DemandeActivation(@NotNull Boolean actif, List<Long> seanceIds, LocalDate accesJusquAu) {}

    private final AdminSecuriteSurfaceService service;

    public AdminSecuriteSurfaceController(AdminSecuriteSurfaceService service) {
        this.service = service;
    }

    @GetMapping
    public List<CompteSurfaceVue> lister() {
        return service.lister().stream().map(AdminSecuriteSurfaceController::vue).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompteSurfaceVue creer(@Valid @RequestBody DemandeCompteSurface demande) {
        return vue(service.creer(demande.email(), demande.nom(), demande.prenom(),
                new Acces(demande.seanceIds(), demande.accesJusquAu())));
    }

    @PutMapping("/{id}")
    public CompteSurfaceVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeCompteSurface demande) {
        return vue(service.modifier(id, demande.email(), demande.nom(), demande.prenom(),
                new Acces(demande.seanceIds(), demande.accesJusquAu())));
    }

    @PutMapping("/{id}/activation")
    public CompteSurfaceVue changerActivation(@PathVariable Long id, @Valid @RequestBody DemandeActivation demande) {
        return vue(service.changerActivation(id, demande.actif(),
                new Acces(demande.seanceIds(), demande.accesJusquAu())));
    }

    @PostMapping("/{id}/lien-reinitialisation")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void envoyerLienReinitialisation(@PathVariable Long id) {
        service.envoyerLienReinitialisation(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        service.supprimer(id);
    }

    private static CompteSurfaceVue vue(Compte c) {
        Utilisateur u = c.utilisateur();
        LocalDate aujourdhui = Calendrier.aujourdhui();
        return new CompteSurfaceVue(u.getId(), u.getEmail(), u.getNom(), u.getPrenom(), u.estActifLe(aujourdhui),
                u.isActif() && !u.estActifLe(aujourdhui), u.getAccesJusquAu(),
                c.seances().stream().map(AdminSecuriteSurfaceController::seance).toList());
    }

    private static SeanceConfieeVue seance(Seance s) {
        return new SeanceConfieeVue(s.getId(), s.getDateSeance(), s.getOrdre(), s.getMilieu().name(),
                s.getLieu(), s.getSite(), s.getCommentaire());
    }
}
