package fr.club.plongee.sejour;

import fr.club.plongee.sejour.AccesSejourController.DemandeCode;
import fr.club.plongee.sejour.AccesSejourController.DemandeConnexion;
import fr.club.plongee.sejour.AccesSejourService.ConnexionSansLien;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * L'entrée dans son séjour depuis la page de connexion, pour qui n'a plus le
 * lien de l'e-mail : son e-mail, puis le code à 6 chiffres, comme sur la page
 * du lien ({@link AccesSejourController}). Le bon code donne l'adresse du
 * séjour et le jeton ; avant, rien ne dit si l'e-mail participe à un séjour.
 * Ouvert sans connexion (ces deux POST seulement, dans SecurityConfig).
 */
@RestController
@RequestMapping("/api/public/sejours")
public class EntreeSejourController {

    private final AccesSejourService acces;

    public EntreeSejourController(AccesSejourService acces) {
        this.acces = acces;
    }

    /** Toujours 204 : la réponse ne dit pas si l'e-mail est celui d'un participant. */
    @PostMapping("/code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void demanderCode(@Valid @RequestBody DemandeCode d) {
        acces.demanderCodeSansLien(d.email());
    }

    @PostMapping("/connexion")
    public ConnexionSansLien connecter(@Valid @RequestBody DemandeConnexion d) {
        return acces.connecterSansLien(d.email(), d.code());
    }
}
