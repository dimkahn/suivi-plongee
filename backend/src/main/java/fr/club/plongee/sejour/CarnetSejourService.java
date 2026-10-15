package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService.SeanceSortieVue;
import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.notification.service.ServiceNotification;
import fr.club.plongee.sejour.SejourService.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Le carnet du séjour envoyé par e-mail à chaque participant : son voyage
 * (arrivée, départ, voiture, chambre), le programme jour par jour, les
 * affaires à prévoir, ses frais (ce qu'il a payé, sa part, qui rembourser)
 * et les infos pratiques. Pour ceux qui n'ont pas de
 * compte, ou pour l'avoir hors connexion sur place. Rien n'est mémorisé
 * de l'envoi : le refaire renvoie le carnet à jour.
 * <p>
 * Ni régime, ni téléphone, ni personne à prévenir des autres : seulement
 * ce que lit un participant dans l'appli.
 */
@Service
public class CarnetSejourService {

    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH'h'mm");

    public record BilanEnvoiCarnet(List<String> envoyes, List<String> sansEmail, List<String> echecs) {}

    private final SejourService sejours;
    private final ServiceNotification notification;
    private final IdentiteStructureService identite;

    public CarnetSejourService(SejourService sejours, ServiceNotification notification,
                               IdentiteStructureService identite) {
        this.sejours = sejours;
        this.notification = notification;
        this.identite = identite;
    }

    /**
     * {@code participantIds} null : à tous ; sinon aux seuls participants
     * choisis (relancer ceux qui ne l'ont pas reçu sans le renvoyer à tous).
     */
    @Transactional(readOnly = true)
    public BilanEnvoiCarnet envoyer(Long sortieId, Collection<Long> participantIds) {
        Set<Long> choisis = participantIds == null ? null : new HashSet<>(participantIds);
        if (choisis != null && choisis.isEmpty()) {
            throw new RegleMetierException("Choisissez au moins un participant.");
        }
        SejourVue s = sejours.vueComplete(sortieId, null, true, true);
        List<ParticipantVue> destinataires = s.participants().stream()
                .filter(p -> choisis == null || choisis.contains(p.id())).toList();
        if (choisis != null && destinataires.size() < choisis.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
        List<String> envoyes = new ArrayList<>();
        List<String> sansEmail = new ArrayList<>();
        List<String> echecs = new ArrayList<>();
        for (ParticipantVue p : destinataires) {
            String nom = p.prenom() + " " + p.nom();
            if (SejourService.blanc(p.email())) {
                sansEmail.add(nom);
            } else if (notification.envoyerCourriel(p.email().trim(), "Carnet du séjour — " + s.sortie().nom(),
                    composer(s, p))) {
                envoyes.add(nom);
            } else {
                echecs.add(nom);
            }
        }
        return new BilanEnvoiCarnet(envoyes, sansEmail, echecs);
    }

    /** Le texte du courriel d'un participant. */
    String composer(SejourVue s, ParticipantVue moi) {
        Map<Long, ParticipantVue> parId = s.participants().stream()
                .collect(Collectors.toMap(ParticipantVue::id, Function.identity()));
        Function<Long, String> nom = id -> {
            ParticipantVue p = parId.get(id);
            return p == null ? "?" : p.prenom() + " " + p.nom();
        };

        StringBuilder t = new StringBuilder();
        t.append("Bonjour ").append(moi.prenom()).append(",\n\n")
                .append("Voici le carnet du séjour « ").append(s.sortie().nom()).append(" »")
                .append(s.sortie().lieu() == null ? "" : " (" + s.sortie().lieu() + ")")
                .append(", ").append(periode(s.sortie().dateDebut(), s.sortie().dateFin())).append(".\n");

        t.append("\nVOTRE VOYAGE\n");
        t.append("  Arrivée : ").append(trajet(moi.arrivee(), true)).append("\n");
        t.append("  Départ : ").append(trajet(moi.depart(), false)).append("\n");
        for (VoitureVue v : s.voitures()) {
            boolean conduit = moi.id().equals(v.conducteurId());
            if (!conduit && !v.passagerIds().contains(moi.id())) continue;
            List<String> autres = v.passagerIds().stream().filter(id -> !id.equals(moi.id())).map(nom).toList();
            t.append("  Voiture « ").append(v.nom()).append(" »");
            if (v.trajet() != null) t.append(", ").append(v.trajet());
            if (conduit) t.append(" : vous conduisez");
            else t.append(" : conduite par ").append(v.conducteurId() == null ? "(à préciser)" : nom.apply(v.conducteurId()));
            if (!autres.isEmpty()) t.append(conduit ? ", avec " : " ; avec ").append(String.join(", ", autres));
            t.append("\n");
        }
        for (LogementVue l : s.logements()) {
            for (ChambreVue c : l.chambres()) {
                if (!c.occupantIds().contains(moi.id())) continue;
                List<String> autres = c.occupantIds().stream().filter(id -> !id.equals(moi.id())).map(nom).toList();
                t.append("  Chambre « ").append(c.nom()).append(" », ").append(l.nom());
                if (l.adresse() != null) t.append(" (").append(l.adresse()).append(")");
                if (!autres.isEmpty()) t.append(", avec ").append(String.join(", ", autres));
                t.append("\n");
            }
        }

        Map<LocalDate, List<String>> programme = new TreeMap<>();
        for (EvenementVue e : s.evenements()) {
            String ligne = horaire(e.heureDebut(), e.heureFin()) + e.titre()
                    + (e.lieu() == null ? "" : " — " + e.lieu())
                    + (e.details() == null ? "" : "\n      " + e.details().replace("\n", "\n      "));
            programme.computeIfAbsent(e.jour(), k -> new ArrayList<>()).add(ligne);
        }
        for (SeanceSortieVue se : s.sortie().seances()) {
            String lieu = String.join(" — ", java.util.stream.Stream.of(se.lieu(), se.site())
                    .filter(x -> x != null && !x.isBlank()).toList());
            programme.computeIfAbsent(se.date(), k -> new ArrayList<>())
                    .add("Plongée" + (se.ordre() == null ? "" : " " + se.ordre()) + (lieu.isEmpty() ? "" : " — " + lieu));
        }
        if (!programme.isEmpty()) {
            t.append("\nPROGRAMME\n");
            programme.forEach((jour, lignes) -> {
                t.append("  ").append(jour(jour)).append("\n");
                lignes.forEach(l -> t.append("    ").append(l).append("\n"));
            });
        }

        if (!s.affaires().isEmpty()) {
            t.append("\nAFFAIRES À PRÉVOIR (* indispensable)\n");
            for (CategorieAffaire c : CategorieAffaire.values()) {
                List<AffaireVue> liste = s.affaires().stream().filter(a -> a.categorie() == c).toList();
                if (liste.isEmpty()) continue;
                t.append("  ").append(c.libelle()).append("\n");
                liste.forEach(a -> t.append("    - ").append(a.libelle()).append(a.indispensable() ? " *" : "").append("\n"));
            }
        }

        FraisSejour.Comptes comptes = s.frais().comptes();
        comptes.soldes().stream().filter(x -> x.participantId().equals(moi.id())).findFirst()
                .filter(x -> x.payeCentimes() != 0 || x.duCentimes() != 0)
                .ifPresent(solde -> {
                    t.append("\nVOS FRAIS\n")
                            .append("  Vous avez payé ").append(FraisSejour.euros(solde.payeCentimes()))
                            .append(" ; votre part des dépenses : ").append(FraisSejour.euros(solde.duCentimes()))
                            .append(".\n");
                    for (FraisSejour.Remboursement r : comptes.remboursements()) {
                        if (r.deId().equals(moi.id())) {
                            t.append("  À rembourser à ").append(nom.apply(r.aId())).append(" : ")
                                    .append(FraisSejour.euros(r.montantCentimes())).append("\n");
                        } else if (r.aId().equals(moi.id())) {
                            t.append("  ").append(nom.apply(r.deId())).append(" vous doit ")
                                    .append(FraisSejour.euros(r.montantCentimes())).append("\n");
                        }
                    }
                    if (solde.soldeCentimes() == 0) t.append("  Vos comptes sont soldés.\n");
                });

        if (s.infosPratiques() != null) {
            t.append("\nINFOS PRATIQUES\n").append(s.infosPratiques()).append("\n");
        }
        t.append("\nBon séjour,\n").append(identite.nom()).append("\n");
        return t.toString();
    }

    /** aller : le voyage d'arrivée au séjour (le conseil porte sur l'heure de départ de chez soi). */
    private static String trajet(Trajet tr, boolean aller) {
        if (tr == null) return "à préciser";
        List<String> morceaux = new ArrayList<>();
        if (tr.date() != null) morceaux.add(jour(tr.date()) + (tr.heure() == null ? "" : " à " + tr.heure().format(HEURE)));
        else if (tr.heure() != null) morceaux.add("à " + tr.heure().format(HEURE));
        if (tr.transport() != null) {
            morceaux.add(tr.transport().libelle() + (SejourService.blanc(tr.numero()) ? "" : " " + tr.numero().trim()));
        } else if (!SejourService.blanc(tr.numero())) {
            morceaux.add(tr.numero().trim());
        }
        if (!SejourService.blanc(tr.lieu())) morceaux.add(tr.lieu().trim());
        // Arrivée : d'où et à quelle heure part l'avion ou le train ; départ : l'heure est déjà celle du départ.
        if (aller && (tr.heureDepart() != null || !SejourService.blanc(tr.lieuDepart()))) {
            morceaux.add("départ" + (tr.heureDepart() == null ? "" : " à " + tr.heureDepart().format(HEURE))
                    + (SejourService.blanc(tr.lieuDepart()) ? "" : " de " + tr.lieuDepart().trim()));
        }
        String conseil = tr.transport() == null ? null : tr.transport().conseil(aller ? tr.heureDepart() : tr.heure(), HEURE);
        return String.join(", ", morceaux) + (conseil == null ? "" : " : " + conseil);
    }

    private static String horaire(LocalTime debut, LocalTime fin) {
        if (debut == null) return "";
        return debut.format(HEURE) + (fin == null ? "" : "-" + fin.format(HEURE)) + " : ";
    }

    private static String jour(LocalDate d) {
        String nom = d.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.FRENCH);
        return Character.toUpperCase(nom.charAt(0)) + nom.substring(1) + " " + d.format(Calendrier.DATE_FR);
    }

    private static String periode(LocalDate debut, LocalDate fin) {
        return fin == null || fin.equals(debut) ? "le " + debut.format(Calendrier.DATE_FR)
                : "du " + debut.format(Calendrier.DATE_FR) + " au " + fin.format(Calendrier.DATE_FR);
    }
}
