package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Roster des plongeurs connus du club (élèves et encadrants), pour le
 * sélecteur d'un membre de palanquée sur la fiche de sécurité. Réservé aux
 * encadrants, comme le reste des écritures et lectures de formation.
 */
@RestController
@RequestMapping("/api/plongeurs-connus")
public class PlongeurConnuController {

    private final PlongeurConnuService service;

    public PlongeurConnuController(PlongeurConnuService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MONITEUR','ADMIN')")
    public List<PlongeurConnuService.PlongeurConnuVue> lister() {
        return service.lister();
    }
}
