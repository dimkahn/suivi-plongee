package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.sejour.MenusRestaurantService.DemandeChoix;
import fr.club.plongee.sejour.MenusRestaurantService.MenusVue;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;

/**
 * Les menus des restaurants du séjour ({@link MenusRestaurantService}) :
 * importés et supprimés par le créateur et les organisateurs, choisis par
 * chaque participant pour lui-même. Les participants sans compte passent
 * par {@link AccesSejourController}.
 */
@RestController
@RequestMapping("/api/sejours/{id}/menus")
public class MenusRestaurantController {

    private static final String GERE = "@droitsSejour.organise(#id, authentication)";

    private final MenusRestaurantService menus;

    public MenusRestaurantController(MenusRestaurantService menus) {
        this.menus = menus;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public MenusVue lire(@PathVariable Long id, @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return menus.lire(id, moi);
    }

    /** Le classeur Excel du menu d'un repas ; remplace celui du même repas. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(GERE)
    public MenusVue importer(@PathVariable Long id,
                             @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate jour,
                             @RequestParam RepasSejour repas,
                             @RequestParam(required = false) String restaurant,
                             @RequestParam("fichier") MultipartFile fichier,
                             @AuthenticationPrincipal UtilisateurPrincipal moi) {
        byte[] contenu;
        try {
            contenu = fichier.getBytes();
        } catch (IOException e) {
            throw new RegleMetierException("Le fichier du menu n'a pas pu être lu.");
        }
        return menus.importer(id, jour, repas, restaurant, contenu, moi);
    }

    @DeleteMapping("/{menuId}")
    @PreAuthorize(GERE)
    public MenusVue supprimer(@PathVariable Long id, @PathVariable Long menuId,
                              @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return menus.supprimer(id, menuId, moi);
    }

    /** Le choix d'un participant : le sien, ou celui de tout participant pour un organisateur (vérifié par le service). */
    @PutMapping("/{menuId}/choix/{participantId}")
    @PreAuthorize("isAuthenticated()")
    public MenusVue choisir(@PathVariable Long id, @PathVariable Long menuId, @PathVariable Long participantId,
                            @Valid @RequestBody DemandeChoix d, @AuthenticationPrincipal UtilisateurPrincipal moi) {
        return menus.choisir(id, menuId, participantId, d.platIds(), moi);
    }
}
