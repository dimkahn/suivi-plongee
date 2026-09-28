package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.InterventionEquipement;
import fr.club.plongee.materiel.domain.InterventionEquipement.Resultat;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Échéances et alertes d'un équipement, calculées à partir de son journal.
 * Sans état ni accès à la base : testable à part.
 *
 * <p>Ce qui BLOQUE un prêt : matériel rebuté ou hors service, dernier
 * contrôle non conforme, date prévue de mise au rebut atteinte, et pour un
 * bloc une inspection visuelle ou une requalification dépassée ou inconnue
 * (arrêté du 20 novembre 2017 : un bloc hors échéance ne se gonfle plus).
 * Une révision fabricant en retard (détendeur, gilet) n'est qu'un
 * avertissement : l'échéance vient de la notice, pas d'un texte, et c'est
 * au directeur technique de juger.
 */
public final class EcheancesEquipement {

    /** Inspection périodique d'un bloc par un TIV : au plus tous les 12 mois. */
    public static final int MOIS_ENTRE_INSPECTIONS_VISUELLES = 12;
    /** Requalification d'un bloc suivi sous le régime TIV (6 ans depuis le 1er janvier 2018). */
    public static final int ANS_REQUALIFICATION_REGIME_TIV = 6;
    /** Requalification d'un bloc hors régime TIV. */
    public static final int ANS_REQUALIFICATION_REGIME_GENERAL = 2;
    /** Une échéance à moins de tant de jours est signalée. */
    public static final int JOURS_PREAVIS = 30;

    public enum Gravite { BLOQUANT, AVERTISSEMENT }

    public record Alerte(Gravite gravite, String message) {}

    public record Etat(LocalDate derniereInspection, LocalDate prochaineInspection,
                       LocalDate derniereRequalification, LocalDate prochaineRequalification,
                       LocalDate derniereRevision, LocalDate prochaineRevision,
                       List<Alerte> alertes) {

        public boolean bloquant() {
            return alertes.stream().anyMatch(a -> a.gravite() == Gravite.BLOQUANT);
        }

        public List<String> motifsBloquants() {
            return alertes.stream().filter(a -> a.gravite() == Gravite.BLOQUANT).map(Alerte::message).toList();
        }
    }

    private EcheancesEquipement() {}

    /**
     * @param dateReference jusqu'où l'équipement doit rester utilisable (fin
     *                      d'un prêt ; aujourd'hui pour l'inventaire)
     * @param aujourdhui    pour les préavis « à faire avant le… »
     */
    public static Etat calculer(Equipement e, List<InterventionEquipement> journal,
                                LocalDate dateReference, LocalDate aujourdhui) {
        List<Alerte> alertes = new ArrayList<>();
        if (e.estRebute()) {
            alertes.add(new Alerte(Gravite.BLOQUANT, "Mis au rebut le " + fr(e.getDateRebut()) + "."));
            return new Etat(null, null, null, null, null, null, alertes);
        }
        if (e.isHorsService()) {
            alertes.add(new Alerte(Gravite.BLOQUANT, "Hors service."));
        }

        dernierAvecResultat(journal)
                .filter(i -> i.getResultat() == Resultat.NON_CONFORME)
                .ifPresent(i -> alertes.add(new Alerte(Gravite.BLOQUANT,
                        "Dernier contrôle non conforme (" + i.getType().libelle().toLowerCase() + " du "
                                + fr(i.getDateIntervention()) + ") : enregistrez un contrôle conforme avant tout prêt.")));

        if (e.getDateRebutPrevue() != null) {
            echeance(alertes, e.getDateRebutPrevue(), dateReference, aujourdhui, true,
                    "Date prévue de mise au rebut");
        }

        LocalDate derniereInspection = null, prochaineInspection = null;
        LocalDate derniereRequalification = null, prochaineRequalification = null;
        LocalDate derniereRevision = null, prochaineRevision = null;

        if (e.getType() == TypeEquipement.BLOC) {
            derniereInspection = derniere(journal, Set.of(TypeIntervention.INSPECTION_VISUELLE,
                    TypeIntervention.REQUALIFICATION));
            if (derniereInspection == null) {
                alertes.add(new Alerte(Gravite.BLOQUANT, "Aucune inspection visuelle (TIV) enregistrée."));
            } else {
                prochaineInspection = derniereInspection.plusMonths(MOIS_ENTRE_INSPECTIONS_VISUELLES);
                echeance(alertes, prochaineInspection, dateReference, aujourdhui, true, "Inspection visuelle (TIV)");
            }

            derniereRequalification = derniere(journal, Set.of(TypeIntervention.REQUALIFICATION));
            if (derniereRequalification == null) derniereRequalification = e.getDatePremiereEpreuve();
            if (derniereRequalification == null) {
                alertes.add(new Alerte(Gravite.BLOQUANT,
                        "Date de la dernière requalification inconnue (ni requalification, ni première épreuve)."));
            } else {
                prochaineRequalification = derniereRequalification.plusYears(e.isRegimeTiv()
                        ? ANS_REQUALIFICATION_REGIME_TIV : ANS_REQUALIFICATION_REGIME_GENERAL);
                echeance(alertes, prochaineRequalification, dateReference, aujourdhui, true, "Requalification");
            }
        } else if (e.getPeriodiciteRevisionMois() != null) {
            derniereRevision = derniere(journal, Set.of(TypeIntervention.REVISION));
            LocalDate base = derniereRevision != null ? derniereRevision
                    : e.getDateMiseEnService() != null ? e.getDateMiseEnService() : e.getDateAchat();
            if (base == null) {
                alertes.add(new Alerte(Gravite.AVERTISSEMENT, "Aucune révision enregistrée."));
            } else {
                prochaineRevision = base.plusMonths(e.getPeriodiciteRevisionMois());
                echeance(alertes, prochaineRevision, dateReference, aujourdhui, false, "Révision");
            }
        }

        return new Etat(derniereInspection, prochaineInspection, derniereRequalification, prochaineRequalification,
                derniereRevision, prochaineRevision, alertes);
    }

    public static Etat calculer(Equipement e, List<InterventionEquipement> journal) {
        LocalDate aujourdhui = Calendrier.aujourdhui();
        return calculer(e, journal, aujourdhui, aujourdhui);
    }

    /**
     * Dépassée à la date de référence : bloquant ou avertissement selon
     * {@code bloquante} ; proche (préavis) : avertissement.
     */
    private static void echeance(List<Alerte> alertes, LocalDate date, LocalDate dateReference,
                                 LocalDate aujourdhui, boolean bloquante, String quoi) {
        if (date.isBefore(aujourdhui)) {
            alertes.add(new Alerte(bloquante ? Gravite.BLOQUANT : Gravite.AVERTISSEMENT,
                    quoi + " dépassée depuis le " + fr(date) + "."));
        } else if (date.isBefore(dateReference)) {
            alertes.add(new Alerte(bloquante ? Gravite.BLOQUANT : Gravite.AVERTISSEMENT,
                    quoi + " à échéance le " + fr(date) + ", avant la fin du prêt."));
        } else if (!date.isAfter(aujourdhui.plusDays(JOURS_PREAVIS))) {
            alertes.add(new Alerte(Gravite.AVERTISSEMENT, quoi + " à faire avant le " + fr(date) + "."));
        }
    }

    /** Un contrôle non conforme ne compte pas comme inspection ou révision faite. */
    private static LocalDate derniere(List<InterventionEquipement> journal, Set<TypeIntervention> types) {
        return journal.stream()
                .filter(i -> types.contains(i.getType()) && i.getResultat() != Resultat.NON_CONFORME)
                .map(InterventionEquipement::getDateIntervention)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    private static Optional<InterventionEquipement> dernierAvecResultat(List<InterventionEquipement> journal) {
        return journal.stream()
                .filter(i -> i.getResultat() != null)
                .max(Comparator.comparing(InterventionEquipement::getDateIntervention)
                        .thenComparing(i -> i.getId() == null ? Long.MAX_VALUE : i.getId()));
    }

    private static String fr(LocalDate d) {
        return d.format(Calendrier.DATE_FR);
    }
}
