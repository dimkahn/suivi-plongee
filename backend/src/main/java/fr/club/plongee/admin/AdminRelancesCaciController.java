package fr.club.plongee.admin;

import fr.club.plongee.notification.relance.RelancesCaciService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Trace des e-mails de relance CACI (spec 2026-10-21-relances-caci, R19 à
 * R21), en lecture seule, réservée aux ADMIN : ni le niveau d'encadrement ni
 * le rôle DIRECTEUR_TECHNIQUE n'y donnent accès. Restreint aussi par
 * {@code /api/admin/**} dans SecurityConfig (redondance délibérée, comme
 * {@link AdminMoniteurController}). Aucune route n'écrit la trace ni ne
 * déclenche le traitement (R22). Pas d'écran (Q7).
 */
@RestController
@RequestMapping("/api/admin/relances-caci")
public class AdminRelancesCaciController {

    /** Une ligne de trace : date d'envoi, destinataire, personnes concernées ; jamais de fin de validité ni de mention. */
    public record RelanceCaciVue(LocalDate envoyeLe, String destinataireNom, String destinatairePrenom,
                                 String destinataireEmail, List<PersonneRelanceeVue> personnes) {}

    public record PersonneRelanceeVue(String nom, String prenom) {}

    private final RelancesCaciService relances;

    public AdminRelancesCaciController(RelancesCaciService relances) {
        this.relances = relances;
    }

    /** Du plus récent au plus ancien (R21). */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<RelanceCaciVue> lister() {
        return relances.lireTrace().stream()
                .map(e -> new RelanceCaciVue(e.envoyeLe(), e.destinataireNom(), e.destinatairePrenom(),
                        e.destinataireEmail(), e.personnes().stream()
                        .map(p -> new PersonneRelanceeVue(p.nom(), p.prenom())).toList()))
                .toList();
    }
}
