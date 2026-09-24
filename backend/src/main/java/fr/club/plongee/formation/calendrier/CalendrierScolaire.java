package fr.club.plongee.formation.calendrier;

import java.time.LocalDate;
import java.util.List;

/**
 * Source des vacances scolaires. L'implémentation réelle interroge le jeu de
 * données officiel de l'Éducation nationale ; les tests en fournissent une
 * fausse, pour ne pas dépendre du réseau.
 */
public interface CalendrierScolaire {

    /** Zones de métropole proposées à l'écran. */
    List<String> ZONES = List.of("A", "B", "C");

    /**
     * Périodes de vacances de la zone qui touchent l'intervalle demandé.
     * Lève {@link fr.club.plongee.commun.RegleMetierException} si la source
     * est injoignable : on ne génère jamais une saison sur des vacances devinées.
     */
    List<PeriodeVacances> vacances(String zone, LocalDate debut, LocalDate fin);
}
