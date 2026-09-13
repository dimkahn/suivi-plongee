package fr.club.plongee.formation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.referentiel.Niveau;
import fr.club.plongee.referentiel.Referentiel;
import fr.club.plongee.referentiel.ReferentielRepository;
import fr.club.plongee.securite.RoleNom;
import fr.club.plongee.securite.Utilisateur;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.UtilisateurRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cursus")
public class CursusController {

    public record CursusVue(Long id, String eleve, String niveau, String saison, String statut,
                            String moniteurReferent) {}

    /** Le référentiel n'est jamais choisi à la main : on prend la version active du niveau. */
    public record DemandeInscription(@NotNull Long eleveId, @NotNull Long saisonId,
                                     @NotNull Niveau niveau, Long moniteurReferentId) {}

    /** Edition complete : le front renvoie l'etat courant modifie, moniteurReferentId a null retire le referent. */
    public record DemandeModificationCursus(Long moniteurReferentId, @NotNull Cursus.Statut statut) {}

    private final CursusRepository cursus;
    private final SaisonRepository saisons;
    private final EleveRepository eleves;
    private final ReferentielRepository referentiels;
    private final UtilisateurRepository utilisateurs;

    public CursusController(CursusRepository cursus, SaisonRepository saisons, EleveRepository eleves,
                            ReferentielRepository referentiels, UtilisateurRepository utilisateurs) {
        this.cursus = cursus;
        this.saisons = saisons;
        this.eleves = eleves;
        this.referentiels = referentiels;
        this.utilisateurs = utilisateurs;
    }

    /** Inscription d'un élève dans une formation : réservée à l'ADMIN. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public CursusVue inscrire(@Valid @RequestBody DemandeInscription demande) {
        Eleve eleve = eleves.findById(demande.eleveId())
                .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable"));
        Saison saison = saisons.findById(demande.saisonId())
                .orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"));
        Referentiel referentiel = referentiels.versionCourante(demande.niveau())
                .orElseThrow(() -> new RegleMetierException(
                        "Aucun référentiel actif pour le niveau " + demande.niveau() + "."));

        if (cursus.existsByEleveIdAndSaisonIdAndReferentielId(eleve.getId(), saison.getId(), referentiel.getId())) {
            throw new RegleMetierException(
                    "Cet élève est déjà inscrit dans ce référentiel pour cette saison.");
        }

        Cursus c = new Cursus();
        c.setEleve(eleve);
        c.setSaison(saison);
        c.setReferentiel(referentiel);
        c.setMoniteurReferent(moniteur(demande.moniteurReferentId()));
        cursus.save(c);
        return vue(cursus.chargerComplet(c.getId()).orElseThrow());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CursusVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeModificationCursus demande) {
        Cursus c = cursus.chargerComplet(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
        c.setStatut(demande.statut());
        c.setMoniteurReferent(moniteur(demande.moniteurReferentId()));
        cursus.save(c);
        return vue(c);
    }

    private Utilisateur moniteur(Long id) {
        if (id == null) return null;
        return utilisateurs.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Moniteur introuvable"));
    }

    /**
     * Un eleve ne recoit que ses propres cursus : le filtrage se fait dans la
     * requete, pas par un 403 apres coup.
     */
    @GetMapping
    public List<CursusVue> lister(@RequestParam(required = false) Long saisonId,
                                  @AuthenticationPrincipal UtilisateurPrincipal principal) {
        Long saison = saisonId != null ? saisonId
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"))
                    .getId();

        List<Cursus> liste = cursus.parSaison(saison);
        boolean encadrant = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + RoleNom.MONITEUR)
                        || a.getAuthority().equals("ROLE_" + RoleNom.ADMIN));
        if (!encadrant) {
            List<Long> siens = cursus.idsDeLEleve(principal.id());
            liste = liste.stream().filter(c -> siens.contains(c.getId())).toList();
        }
        return liste.stream().map(this::vue).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("@habilitation.peutConsulter(#id, authentication)")
    public CursusVue detail(@PathVariable Long id) {
        return vue(cursus.chargerComplet(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable")));
    }

    private CursusVue vue(Cursus c) {
        return new CursusVue(c.getId(), c.getEleve().nomComplet(),
                c.getReferentiel().getNiveau().name(), c.getSaison().getLibelle(),
                c.getStatut().name(),
                c.getMoniteurReferent() == null ? null : c.getMoniteurReferent().nomComplet());
    }
}
