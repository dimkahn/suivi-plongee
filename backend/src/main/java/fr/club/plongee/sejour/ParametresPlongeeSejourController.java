package fr.club.plongee.sejour;

import fr.club.plongee.formation.service.EnvoiParametresSejourService.BilanEnvoi;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Les paramètres de plongée envoyés par l'organisateur du séjour aux
 * participants qu'il coche ({@link ParametresPlongeeSejourService}).
 */
@RestController
@RequestMapping("/api/sejours/{id}")
public class ParametresPlongeeSejourController {

    private static final String GERE = "@droitsSejour.organise(#id, authentication)";

    /** Les participants choisis, au moins un. */
    public record DemandeEnvoiParametres(List<Long> participantIds) {}

    private final ParametresPlongeeSejourService service;

    public ParametresPlongeeSejourController(ParametresPlongeeSejourService service) {
        this.service = service;
    }

    @PostMapping("/envoi-parametres")
    @PreAuthorize(GERE)
    public BilanEnvoi envoyer(@PathVariable Long id, @RequestBody(required = false) DemandeEnvoiParametres d) {
        return service.envoyer(id, d == null ? null : d.participantIds());
    }
}
