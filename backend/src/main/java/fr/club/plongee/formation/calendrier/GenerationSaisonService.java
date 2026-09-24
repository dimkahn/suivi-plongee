package fr.club.plongee.formation.calendrier;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Génère les séances d'une saison : une séance, toujours la même (milieu,
 * lieu, site, profondeur, info), chaque jour de la semaine choisi, en retirant
 * les vacances scolaires d'une zone et/ou les jours fériés. Pour deux séances
 * le même jour (piscine et fosse le lundi), on génère deux fois : la seconde
 * passe prend le n° de plongée suivant. L'aperçu et la création partagent le
 * même calcul : ce qui a été montré est exactement ce qui est créé.
 */
@Service
public class GenerationSaisonService {

    /**
     * {@code jours} : jours de la semaine où la séance a lieu. {@code zoneVacances} : A, B ou C ;
     * vide pour ne pas retirer les vacances. {@code exclureFeries} absent : non.
     */
    public record Demande(@NotNull LocalDate dateDebut, @NotNull LocalDate dateFin,
                          @NotEmpty Set<@NotNull DayOfWeek> jours,
                          @NotNull Milieu milieu, String lieu, String site, Integer profondeurMax, String info,
                          String zoneVacances, Boolean exclureFeries) {}

    public record SeancePrevue(LocalDate date, int ordre) {}

    /** Une raison de ne pas créer de séance (vacances, jour férié) et combien elle en retire. */
    public record Exclusion(String motif, LocalDate debut, LocalDate fin, int seancesRetirees) {}

    /** {@code seancesExistantes} : déjà présentes sur la période, pour prévenir une génération en double. */
    public record Plan(Saison saison, List<SeancePrevue> seances, List<Exclusion> exclusions, int seancesExistantes) {}

    /** Une saison dure moins d'un an ; au-delà, c'est une erreur de saisie. */
    private static final int DUREE_MAX_JOURS = 400;

    private final SaisonRepository saisons;
    private final SeanceRepository seances;
    private final CalendrierScolaire calendrierScolaire;

    public GenerationSaisonService(SaisonRepository saisons, SeanceRepository seances,
                                   CalendrierScolaire calendrierScolaire) {
        this.saisons = saisons;
        this.seances = seances;
        this.calendrierScolaire = calendrierScolaire;
    }

    @Transactional(readOnly = true)
    public Plan planifier(Demande demande) {
        LocalDate debut = demande.dateDebut(), fin = demande.dateFin();
        if (fin.isBefore(debut)) {
            throw new RegleMetierException("La date de fin doit être le même jour ou après la date de début.");
        }
        if (ChronoUnit.DAYS.between(debut, fin) + 1 > DUREE_MAX_JOURS) {
            throw new RegleMetierException("La période ne peut pas dépasser " + DUREE_MAX_JOURS
                    + " jours : générez une saison à la fois.");
        }
        Saison saison = saisons.findAll().stream()
                .filter(s -> !debut.isBefore(s.getDateDebut()) && !fin.isAfter(s.getDateFin()))
                .findFirst()
                .orElseThrow(() -> new RegleMetierException("Les dates doivent tenir dans une seule saison. "
                        + "Créez d'abord la saison dans Administration → Saisons, ou ajustez les dates."));

        String zone = demande.zoneVacances() == null ? "" : demande.zoneVacances().trim().toUpperCase();
        if (!zone.isEmpty() && !CalendrierScolaire.ZONES.contains(zone)) {
            throw new RegleMetierException("Zone de vacances inconnue : choisissez A, B ou C.");
        }
        List<PeriodeVacances> vacances = zone.isEmpty() ? List.of() : calendrierScolaire.vacances(zone, debut, fin);
        Map<LocalDate, String> feries = Boolean.TRUE.equals(demande.exclureFeries()) ? JoursFeries.entre(debut, fin) : Map.of();

        Map<LocalDate, Integer> dernierOrdre = new HashMap<>();
        int existantes = 0;
        for (Seance existante : seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison.getId())) {
            dernierOrdre.merge(existante.getDateSeance(), existante.getOrdre(), Math::max);
            if (!existante.getDateSeance().isBefore(debut) && !existante.getDateSeance().isAfter(fin)) existantes++;
        }

        // Chaque période de vacances apparaît dans l'aperçu, même si elle ne retire
        // aucune séance : l'admin voit ce qui a été pris en compte.
        Map<String, int[]> retraits = new LinkedHashMap<>();
        Map<String, Exclusion> motifs = new LinkedHashMap<>();
        for (PeriodeVacances v : vacances) {
            String cle = "V" + v.premierJour() + v.libelle();
            motifs.put(cle, new Exclusion(v.libelle() + " (zone " + zone + ")",
                    max(v.premierJour(), debut), min(v.dernierJour(), fin), 0));
            retraits.put(cle, new int[1]);
        }

        List<SeancePrevue> prevues = new ArrayList<>();
        for (LocalDate jour = debut; !jour.isAfter(fin); jour = jour.plusDays(1)) {
            if (!demande.jours().contains(jour.getDayOfWeek())) continue;

            String cle = null;
            if (feries.containsKey(jour)) {
                cle = "F" + jour;
                motifs.putIfAbsent(cle, new Exclusion("Jour férié : " + feries.get(jour), jour, jour, 0));
                retraits.putIfAbsent(cle, new int[1]);
            } else {
                for (PeriodeVacances v : vacances) {
                    if (v.contient(jour)) { cle = "V" + v.premierJour() + v.libelle(); break; }
                }
            }
            if (cle != null) {
                retraits.get(cle)[0]++;
                continue;
            }
            prevues.add(new SeancePrevue(jour, dernierOrdre.getOrDefault(jour, 0) + 1));
        }

        List<Exclusion> exclusions = new ArrayList<>();
        motifs.forEach((cle, e) -> exclusions.add(
                new Exclusion(e.motif(), e.debut(), e.fin(), retraits.get(cle)[0])));
        exclusions.sort(Comparator.comparing(Exclusion::debut));
        return new Plan(saison, prevues, exclusions, existantes);
    }

    /** Crée les séances du plan, en une transaction : tout ou rien. */
    @Transactional
    public Plan generer(Demande demande) {
        Plan plan = planifier(demande);
        List<Seance> creees = new ArrayList<>();
        for (SeancePrevue p : plan.seances()) {
            Seance s = new Seance();
            s.setSaison(plan.saison());
            s.setDateSeance(p.date());
            s.setOrdre(p.ordre());
            s.setMilieu(demande.milieu());
            s.setLieu(vide(demande.lieu()));
            s.setSite(vide(demande.site()));
            s.setProfondeurMax(demande.profondeurMax());
            s.setCommentaire(vide(demande.info()));
            creees.add(s);
        }
        seances.saveAll(creees);
        return plan;
    }

    private static String vide(String texte) {
        return texte == null || texte.isBlank() ? null : texte.trim();
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }
}
