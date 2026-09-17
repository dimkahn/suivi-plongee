package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import fr.club.plongee.commun.RessourceIntrouvableException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Gestion des saisons : lecture pour les encadrants, ouverture/fermeture réservées à l'ADMIN. */
@RestController
@RequestMapping("/api/saisons")
public class SaisonController {

    public record SaisonVue(Long id, String libelle, LocalDate dateDebut, LocalDate dateFin, boolean ouverte) {}

    public record DemandeSaison(@NotBlank String libelle, @NotNull LocalDate dateDebut,
                                @NotNull LocalDate dateFin) {}

    public record DemandeOuverture(@NotNull Boolean ouverte) {}

    private final SaisonRepository saisons;

    public SaisonController(SaisonRepository saisons) {
        this.saisons = saisons;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<SaisonVue> lister() {
        return saisons.findAll().stream()
                .sorted((a, b) -> b.getDateDebut().compareTo(a.getDateDebut()))
                .map(this::vue)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public SaisonVue creer(@Valid @RequestBody DemandeSaison demande) {
        Saison s = new Saison();
        s.setLibelle(demande.libelle());
        s.setDateDebut(demande.dateDebut());
        s.setDateFin(demande.dateFin());
        s.setOuverte(true);
        saisons.save(s);
        return vue(s);
    }

    /** Les dates sont purement informatives (aucune règle métier ne s'y appuie) : modifiables sans restriction. */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public SaisonVue modifier(@PathVariable Long id, @Valid @RequestBody DemandeSaison demande) {
        Saison s = saisons.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"));
        s.setLibelle(demande.libelle());
        s.setDateDebut(demande.dateDebut());
        s.setDateFin(demande.dateFin());
        saisons.save(s);
        return vue(s);
    }

    /** Une saison fermée ne bloque rien de rétroactif : elle sort seulement des saisons proposées par défaut. */
    @PutMapping("/{id}/ouverture")
    @PreAuthorize("hasRole('ADMIN')")
    public SaisonVue changerOuverture(@PathVariable Long id, @Valid @RequestBody DemandeOuverture demande) {
        Saison s = saisons.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"));
        s.setOuverte(demande.ouverte());
        saisons.save(s);
        return vue(s);
    }

    private SaisonVue vue(Saison s) {
        return new SaisonVue(s.getId(), s.getLibelle(), s.getDateDebut(), s.getDateFin(), s.isOuverte());
    }
}
