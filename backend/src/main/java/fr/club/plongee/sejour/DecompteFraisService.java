package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.notification.service.ServiceNotification;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Le décompte envoyé à chacun quand les frais sont clos (demande du club,
 * 2026) : les dépenses où il a une part ou qu'il a payées, sa part de
 * chacune, son compte, à qui verser combien, et l'adresse où envoyer la
 * preuve de son virement. Rien n'est mémorisé de l'envoi : le refaire
 * renvoie le décompte à jour (remboursements confirmés compris).
 * <p>
 * Chacun ne lit que ce qu'il lit dans l'appli ({@link FraisService#lire}
 * en son nom) : les lignes d'additions de restaurant des autres restent
 * masquées.
 */
@Service
public class DecompteFraisService {

    /** {@code sansFrais} : ni payé, ni part, ni remboursement : rien à leur envoyer. */
    public record BilanDecompte(List<String> envoyes, List<String> sansEmail, List<String> echecs,
                                List<String> sansFrais) {}

    private record Destinataire(Long id, String prenom, String nom, String email, boolean encadrant) {
        String nomComplet() { return prenom + " " + nom; }
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final FraisService frais;
    private final AccesSejourService acces;
    private final ServiceNotification notification;
    private final IdentiteStructureService identite;
    private final String urlFrontend;

    public DecompteFraisService(NamedParameterJdbcTemplate jdbc, FraisService frais, AccesSejourService acces,
                                ServiceNotification notification, IdentiteStructureService identite,
                                @Value("${app.frontend-url}") String urlFrontend) {
        this.jdbc = jdbc;
        this.frais = frais;
        this.acces = acces;
        this.notification = notification;
        this.identite = identite;
        this.urlFrontend = urlFrontend;
    }

    /** {@code participantIds} null : à tous ; sinon aux seuls choisis (relancer). Frais clos seulement. */
    @Transactional
    public BilanDecompte envoyer(Long sortieId, Collection<Long> participantIds) {
        Set<Long> choisis = participantIds == null ? null : new HashSet<>(participantIds);
        if (choisis != null && choisis.isEmpty()) throw new RegleMetierException("Choisissez au moins un participant.");
        String code = acces.codeFrais(sortieId);
        if (frais.closLe(sortieId) == null) {
            throw new RegleMetierException("Clôturez d'abord les frais : le décompte ne doit plus changer une fois envoyé.");
        }
        AccesSejourService.EnteteVue sejour = acces.entete(code);
        List<Destinataire> tous = jdbc.query("""
                SELECT p.id, p.prenom, p.nom, p.email, CASE WHEN %s THEN 1 ELSE 0 END AS encadrant
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.sortie_id = :sortie ORDER BY p.nom, p.prenom""".formatted(AccesSejourService.EST_ENCADRANT),
                new MapSqlParameterSource("sortie", sortieId),
                (rs, i) -> new Destinataire(rs.getLong("id"), rs.getString("prenom"), rs.getString("nom"),
                        rs.getString("email"), rs.getInt("encadrant") == 1));
        Map<Long, String> noms = new HashMap<>();
        tous.forEach(d -> noms.put(d.id(), d.nomComplet()));
        List<Destinataire> destinataires = tous.stream().filter(d -> choisis == null || choisis.contains(d.id())).toList();
        if (choisis != null && destinataires.size() < choisis.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
        List<String> envoyes = new ArrayList<>(), sansEmail = new ArrayList<>(), echecs = new ArrayList<>(),
                sansFrais = new ArrayList<>();
        for (Destinataire d : destinataires) {
            FraisService.FraisVue vue = frais.lire(sortieId, frais.acteurParticipant(d.id()));
            if (!concerne(vue, d.id())) {
                sansFrais.add(d.nomComplet());
            } else if (SejourService.blanc(d.email())) {
                sansEmail.add(d.nomComplet());
            } else if (notification.envoyerCourriel(d.email().trim(), "Décompte des frais — " + sejour.nom(),
                    composer(sejour, sortieId, code, d, vue, noms))) {
                envoyes.add(d.nomComplet());
            } else {
                echecs.add(d.nomComplet());
            }
        }
        return new BilanDecompte(envoyes, sansEmail, echecs, sansFrais);
    }

    private static boolean concerne(FraisService.FraisVue vue, Long moi) {
        return vue.comptes().soldes().stream().anyMatch(s -> moi.equals(s.participantId())
                && (s.payeCentimes() != 0 || s.duCentimes() != 0 || s.soldeCentimes() != 0))
                || vue.versements().stream().anyMatch(v -> moi.equals(v.deId()) || moi.equals(v.aId()));
    }

    private String composer(AccesSejourService.EnteteVue sejour, Long sortieId, String code, Destinataire moi,
                            FraisService.FraisVue vue, Map<Long, String> noms) {
        Long id = moi.id();
        java.util.function.Function<Long, String> nom = p -> p == null ? "le club" : noms.getOrDefault(p, "?");
        StringBuilder t = new StringBuilder();
        t.append("Bonjour ").append(moi.prenom()).append(",\n\n")
                .append("Les frais du séjour « ").append(sejour.nom()).append(" » (")
                .append(AccesSejourService.periode(sejour)).append(") sont clos. Voici votre décompte.\n");

        t.append("\nVOS DÉPENSES\n");
        long sommeParts = 0;
        for (FraisSejour.Depense d : vue.depenses()) {
            Long part = FraisSejour.repartir(d.montantCentimes(), d.parts()).get(id);
            if (part == null && !id.equals(d.payeurId())) continue;
            if (part != null) sommeParts += part;
            t.append("  - ").append(d.libelle());
            if (d.jour() != null) t.append(", le ").append(d.jour().format(Calendrier.DATE_FR));
            t.append(" (payé par ").append(id.equals(d.payeurId()) ? "vous" : nom.apply(d.payeurId())).append(") : ")
                    .append(FraisSejour.euros(d.montantCentimes())).append(" au total ; votre part : ")
                    .append(part == null ? "aucune" : FraisSejour.euros(part)).append("\n");
        }
        FraisSejour.Solde solde = vue.comptes().soldes().stream().filter(s -> id.equals(s.participantId()))
                .findFirst().orElse(new FraisSejour.Solde(id, 0, 0, 0));
        if (sommeParts != solde.duCentimes()) {
            t.append("  (Les parts ci-dessus sont arrondies une à une ; votre part totale, calculée sur l'ensemble, "
                    + "fait foi.)\n");
        }

        long rembourse = vue.versements().stream().filter(v -> id.equals(v.deId()))
                .mapToLong(FraisSejour.Versement::montantCentimes).sum();
        long recu = vue.versements().stream().filter(v -> id.equals(v.aId()))
                .mapToLong(FraisSejour.Versement::montantCentimes).sum();
        t.append("\nVOTRE COMPTE\n")
                .append("  Votre part : ").append(FraisSejour.euros(solde.duCentimes())).append("\n")
                .append("  Vous avez payé : ").append(FraisSejour.euros(solde.payeCentimes())).append("\n");
        if (rembourse != 0) t.append("  Vous avez déjà remboursé : ").append(FraisSejour.euros(rembourse)).append("\n");
        if (recu != 0) t.append("  On vous a déjà remboursé : ").append(FraisSejour.euros(recu)).append("\n");
        t.append("  Solde : ").append(solde.soldeCentimes() > 0 ? "+" : "")
                .append(FraisSejour.euros(solde.soldeCentimes()))
                .append(solde.soldeCentimes() > 0 ? " (on vous doit de l'argent)"
                        : solde.soldeCentimes() < 0 ? " (vous devez de l'argent)" : "").append("\n");

        t.append("\nÀ RÉGLER\n");
        boolean doit = false;
        for (FraisSejour.Remboursement r : vue.comptes().remboursements()) {
            if (id.equals(r.deId())) {
                doit = true;
                t.append("  À verser ").append(r.aId() == null ? "au club" : "à " + nom.apply(r.aId()))
                        .append(" : ").append(FraisSejour.euros(r.montantCentimes())).append("\n");
            } else if (id.equals(r.aId())) {
                t.append("  ").append(r.deId() == null ? "Le club" : nom.apply(r.deId())).append(" vous doit ")
                        .append(FraisSejour.euros(r.montantCentimes())).append("\n");
            }
        }
        if (solde.soldeCentimes() == 0) t.append("  Rien : vos comptes sont soldés.\n");

        String adresse = moi.encadrant() ? urlFrontend + "/sejours/" + sortieId : urlFrontend + "/sejour/" + code;
        t.append("\nLe détail de toutes les dépenses est dans l'onglet « Frais » du séjour :\n").append(adresse).append("\n");
        if (doit) {
            t.append("Une fois votre virement fait, envoyez-y sa preuve (photo ou PDF) avec le bouton « J'ai payé » : "
                    + "le bénéficiaire ou un organisateur confirmera le remboursement.\n");
        }
        if (!moi.encadrant()) {
            t.append("Donnez-y cette adresse e-mail (").append(moi.email().trim())
                    .append(") : vous recevrez un code à 6 chiffres pour entrer.\n");
        }
        t.append("\nMerci,\n").append(identite.nom()).append("\n");
        return t.toString();
    }
}
