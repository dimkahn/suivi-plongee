package fr.club.plongee.progression.service;

import fr.club.plongee.progression.domain.PeriodeProgression;
import fr.club.plongee.progression.domain.ProgressionType;
import fr.club.plongee.referentiel.domain.BlocCompetence;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.Map;

/**
 * Échéance de chaque bloc d'une progression sur une saison donnée : le
 * dernier jour de la dernière période qui le contient. Un bloc travaillé de
 * septembre à décembre puis repris en mai a pour échéance le 31 mai.
 * Les mois d'une période sont situés dans l'année de la saison : un mois
 * antérieur au mois de début de la saison tombe l'année suivante (saison
 * 2026-2027 commencée en septembre : février = février 2027).
 */
public final class EcheancesProgression {

    private EcheancesProgression() {}

    public static Map<Long, LocalDate> parBloc(ProgressionType progression, LocalDate debutSaison) {
        Map<Long, LocalDate> echeances = new HashMap<>();
        for (PeriodeProgression p : progression.getPeriodes()) {
            LocalDate fin = finDePeriode(p, debutSaison);
            for (BlocCompetence b : p.getBlocs()) {
                echeances.merge(b.getId(), fin, (a, c) -> a.isAfter(c) ? a : c);
            }
        }
        return echeances;
    }

    static LocalDate finDePeriode(PeriodeProgression p, LocalDate debutSaison) {
        int annee = p.getMoisFin() >= debutSaison.getMonthValue()
                ? debutSaison.getYear() : debutSaison.getYear() + 1;
        return YearMonth.of(annee, p.getMoisFin()).atEndOfMonth();
    }

    /**
     * En retard : l'échéance est passée, le bloc n'est pas validé et tous ses
     * critères ne sont pas acquis (tout acquis mais pas encore validé, c'est
     * une validation en attente, pas un retard).
     */
    public static boolean enRetard(LocalDate echeance, LocalDate aujourdhui, boolean valide, int acquis, int total) {
        return echeance != null && aujourdhui.isAfter(echeance) && !valide && acquis < total;
    }
}
