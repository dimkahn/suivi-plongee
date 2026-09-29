package fr.club.plongee.ia;

import fr.club.plongee.ia.domain.JournalIa;
import fr.club.plongee.ia.domain.SessionIa;
import fr.club.plongee.ia.service.AccesIaService;
import fr.club.plongee.ia.service.AssistantIaService;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import fr.club.plongee.commun.RegleMetierException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;

import java.time.Instant;
import java.util.List;

/**
 * Assistant IA (Claude Code) : conversation, tests, merge et tag. N'existe
 * qu'en profil dev : Claude Code tourne sur le poste du développeur, jamais
 * sur le serveur de production, où ces adresses répondent 404.
 *
 * <p>Réservé à un ADMIN qui a aussi le rôle IA, et qui a saisi le code
 * d'accès envoyé par courriel ({@link AccesIaService}) ; seules les
 * adresses {@code /acces} échappent à cette dernière condition. L'auteur
 * de chaque geste vient du SecurityContext.
 */
@RestController
@RequestMapping("/api/ia")
@ConditionalOnProperty(name = "app.ia.active", havingValue = "true")
@PreAuthorize("hasRole('ADMIN') and hasRole('IA') and @accesIa.ouvert(authentication)")
public class IaController {

    /** Les adresses du code d'accès : les rôles suffisent, l'accès n'est pas encore ouvert. */
    private static final String ROLES = "hasRole('ADMIN') and hasRole('IA')";

    public record EtatVue(boolean disponible, String depot, String brancheCourante, String dossierTravail) {}

    public record SessionVue(Long id, String titre, String branche, String creePar, Instant creeLe,
                             String travailEnCours) {}

    public record LigneJournalVue(Long id, String type, String contenu, String commitSha, String auteur,
                                  Instant creeLe) {}

    public record DemandeSession(@NotBlank String titre) {}

    public record DemandeMessage(@NotBlank String texte) {}

    public record DemandeTag(@NotBlank String tag) {}

    public record DemandeCode(@NotBlank String code) {}

    private final AssistantIaService service;
    private final AccesIaService acces;

    public IaController(AssistantIaService service, AccesIaService acces) {
        this.service = service;
        this.acces = acces;
    }

    @GetMapping("/acces")
    @PreAuthorize(ROLES)
    public AccesIaService.EtatAcces etatAcces(@AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return acces.etat(auteur.id());
    }

    /** Envoie un code à l'adresse configurée (app.ia.email-code), jamais à celle du demandeur. */
    @PostMapping("/acces/code")
    @PreAuthorize(ROLES)
    public AccesIaService.EtatAcces demanderCode(@AuthenticationPrincipal UtilisateurPrincipal auteur) {
        acces.demanderCode(auteur.id());
        return acces.etat(auteur.id());
    }

    @PostMapping("/acces")
    @PreAuthorize(ROLES)
    public AccesIaService.EtatAcces validerCode(@Valid @RequestBody DemandeCode demande,
                                                @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        return acces.valider(auteur.id(), demande.code());
    }

    @DeleteMapping("/acces")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(ROLES)
    public void fermerAcces(@AuthenticationPrincipal UtilisateurPrincipal auteur) {
        acces.fermer(auteur.id());
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

    @PostMapping(value = "/sessions/{id}/messages", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void envoyer(@PathVariable Long id, @Valid @RequestBody DemandeMessage demande,
                        @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        service.envoyer(id, demande.texte(), auteur.id());
    }

    /** Message avec pièces jointes (captures d'écran, documents) : texte facultatif s'il y a des fichiers. */
    @PostMapping(value = "/sessions/{id}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void envoyerAvecPieces(@PathVariable Long id, @RequestParam(required = false) String texte,
                                  @RequestParam(value = "fichiers", required = false) List<MultipartFile> fichiers,
                                  @AuthenticationPrincipal UtilisateurPrincipal auteur) {
        List<AssistantIaService.PieceJointe> pieces = new ArrayList<>();
        for (MultipartFile f : fichiers == null ? List.<MultipartFile>of() : fichiers) {
            try {
                pieces.add(new AssistantIaService.PieceJointe(f.getOriginalFilename(), f.getBytes()));
            } catch (IOException e) {
                throw new RegleMetierException("Le fichier « " + f.getOriginalFilename() + " » n'a pas pu être lu.");
            }
        }
        service.envoyer(id, texte, pieces, auteur.id());
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
