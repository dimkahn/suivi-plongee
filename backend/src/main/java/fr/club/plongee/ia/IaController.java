package fr.club.plongee.ia;

import fr.club.plongee.ia.domain.JournalIa;
import fr.club.plongee.ia.domain.SessionIa;
import fr.club.plongee.ia.service.AssistantIaService;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/**
 * Assistant IA (Claude Code) : conversation, tests, merge et tag. N'existe
 * qu'en profil dev : Claude Code tourne sur le poste du développeur, jamais
 * sur le serveur de production, où ces adresses répondent 404.
 *
 * <p>Réservé à un ADMIN qui a aussi le rôle IA. L'auteur de chaque geste
 * vient du SecurityContext.
 */
@RestController
@RequestMapping("/api/ia")
@Profile("dev")
@PreAuthorize("hasRole('ADMIN') and hasRole('IA')")
public class IaController {

    public record EtatVue(boolean disponible, String depot, String brancheCourante, String dossierTravail) {}

    public record SessionVue(Long id, String titre, String branche, String creePar, Instant creeLe,
                             String travailEnCours) {}

    public record LigneJournalVue(Long id, String type, String contenu, String commitSha, String auteur,
                                  Instant creeLe) {}

    public record DemandeSession(@NotBlank String titre) {}

    public record DemandeMessage(@NotBlank String texte) {}

    public record DemandeTag(@NotBlank String tag) {}

    private final AssistantIaService service;

    public IaController(AssistantIaService service) {
        this.service = service;
    }

    @GetMapping("/etat")
    public EtatVue etat() {
        AssistantIaService.Etat e = service.etat();
        return new EtatVue(true, e.depot(), e.brancheCourante(), e.dossierTravail());
    }

    @GetMapping("/sessions")
    public List<SessionVue> sessions() {
        return service.sessions().stream().map(this::vue).toList();
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionVue creer(@Valid @RequestBody DemandeSession demande,
                            @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return vue(service.creer(demande.titre(), auteur.id()));
    }

    /** Le journal après la ligne {@code apres} : la page l'interroge toutes les secondes pendant un travail. */
    @GetMapping("/sessions/{id}/journal")
    public List<LigneJournalVue> journal(@PathVariable Long id, @RequestParam(defaultValue = "0") long apres) {
        return service.journal(id, apres).stream().map(IaController::vue).toList();
    }

    @PostMapping("/sessions/{id}/messages")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void envoyer(@PathVariable Long id, @Valid @RequestBody DemandeMessage demande,
                        @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.envoyer(id, demande.texte(), auteur.id());
    }

    @PostMapping("/sessions/{id}/arret")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void arreter(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.arreter(id, auteur.id());
    }

    @GetMapping("/sessions/{id}/livraison")
    public AssistantIaService.Livraison livraison(@PathVariable Long id) {
        return service.livraison(id);
    }

    @PostMapping("/sessions/{id}/tests")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void lancerTests(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.lancerTests(id, auteur.id());
    }

    @PostMapping("/sessions/{id}/merge")
    public AssistantIaService.Livraison merger(@PathVariable Long id,
                                               @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.merger(id, auteur.id());
        return service.livraison(id);
    }

    @PostMapping("/sessions/{id}/tag")
    public AssistantIaService.Livraison taggerEtPousser(@PathVariable Long id, @Valid @RequestBody DemandeTag demande,
                                                        @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.taggerEtPousser(id, demande.tag().strip(), auteur.id());
        return service.livraison(id);
    }

    private SessionVue vue(SessionIa s) {
        return new SessionVue(s.getId(), s.getTitre(), s.getBranche(),
                s.getCreePar().getPrenom() + " " + s.getCreePar().getNom(), s.getCreeLe(),
                service.travailEnCours(s.getId()));
    }

    private static LigneJournalVue vue(JournalIa j) {
        return new LigneJournalVue(j.getId(), j.getType().name(), j.getContenu(), j.getCommitSha(),
                j.getAuteur() == null ? null : j.getAuteur().getPrenom() + " " + j.getAuteur().getNom(),
                j.getCreeLe());
    }
}
