package fr.club.plongee.materiel;

import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.InterventionEquipement;
import fr.club.plongee.materiel.domain.InterventionEquipement.Resultat;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;
import fr.club.plongee.materiel.service.EcheancesEquipement;
import fr.club.plongee.materiel.service.EcheancesEquipement.Etat;
import fr.club.plongee.materiel.service.EcheancesEquipement.Gravite;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Échéances réglementaires d'un équipement, calculées depuis son journal. */
class EcheancesEquipementTest {

    private static final LocalDate AUJOURDHUI = LocalDate.of(2026, 10, 1);

    @Test
    @DisplayName("Bloc sous régime TIV : inspection dans les 12 mois, requalification dans les 6 ans")
    void bloc_regimeTiv() {
        Equipement b = bloc(true);
        Etat etat = calculer(b, List.of(
                intervention(TypeIntervention.REQUALIFICATION, LocalDate.of(2024, 3, 1), Resultat.CONFORME),
                intervention(TypeIntervention.INSPECTION_VISUELLE, LocalDate.of(2026, 3, 1), Resultat.CONFORME)));

        assertThat(etat.prochaineInspection()).isEqualTo(LocalDate.of(2027, 3, 1));
        assertThat(etat.prochaineRequalification()).isEqualTo(LocalDate.of(2030, 3, 1));
        assertThat(etat.alertes()).isEmpty();
    }

    @Test
    @DisplayName("Bloc hors régime TIV : requalification tous les 2 ans")
    void bloc_regimeGeneral() {
        Equipement b = bloc(false);
        Etat etat = calculer(b, List.of(
                intervention(TypeIntervention.REQUALIFICATION, LocalDate.of(2024, 3, 1), Resultat.CONFORME),
                intervention(TypeIntervention.INSPECTION_VISUELLE, LocalDate.of(2026, 3, 1), Resultat.CONFORME)));

        assertThat(etat.prochaineRequalification()).isEqualTo(LocalDate.of(2026, 3, 1));
        assertThat(etat.bloquant()).isTrue();
        assertThat(etat.motifsBloquants()).anyMatch(m -> m.startsWith("Requalification dépassée"));
    }

    @Test
    @DisplayName("Sans aucune inspection, un bloc ne se prête pas ; la première épreuve sert de base à la requalification")
    void bloc_sansHistorique() {
        Equipement b = bloc(true);
        b.setDatePremiereEpreuve(LocalDate.of(2023, 1, 1));
        Etat etat = calculer(b, List.of());

        assertThat(etat.prochaineRequalification()).isEqualTo(LocalDate.of(2029, 1, 1));
        assertThat(etat.motifsBloquants()).containsExactly("Aucune inspection visuelle (TIV) enregistrée.");
    }

    @Test
    @DisplayName("Une inspection non conforme ne compte pas, et bloque tant qu'un contrôle conforme ne la suit pas")
    void bloc_nonConforme() {
        Equipement b = bloc(true);
        List<InterventionEquipement> journal = List.of(
                intervention(TypeIntervention.REQUALIFICATION, LocalDate.of(2024, 3, 1), Resultat.CONFORME),
                intervention(TypeIntervention.INSPECTION_VISUELLE, LocalDate.of(2026, 9, 1), Resultat.NON_CONFORME));

        Etat etat = calculer(b, journal);
        assertThat(etat.derniereInspection()).isEqualTo(LocalDate.of(2024, 3, 1));
        assertThat(etat.motifsBloquants()).anyMatch(m -> m.startsWith("Dernier contrôle non conforme"));

        Etat apresReparation = calculer(b, List.of(journal.get(0), journal.get(1),
                intervention(TypeIntervention.INSPECTION_VISUELLE, LocalDate.of(2026, 9, 20), Resultat.CONFORME)));
        assertThat(apresReparation.bloquant()).isFalse();
    }

    @Test
    @DisplayName("Une échéance qui tombe pendant le prêt le bloque ; proche, elle n'est qu'un avertissement")
    void bloc_echeancePendantLePret() {
        Equipement b = bloc(true);
        List<InterventionEquipement> journal = List.of(
                intervention(TypeIntervention.REQUALIFICATION, LocalDate.of(2024, 3, 1), Resultat.CONFORME),
                intervention(TypeIntervention.INSPECTION_VISUELLE, LocalDate.of(2025, 10, 10), Resultat.CONFORME));

        Etat aujourdhui = EcheancesEquipement.calculer(b, journal, AUJOURDHUI, AUJOURDHUI);
        assertThat(aujourdhui.bloquant()).isFalse();
        assertThat(aujourdhui.alertes()).extracting(EcheancesEquipement.Alerte::gravite)
                .containsExactly(Gravite.AVERTISSEMENT);

        Etat pourUnPretDeQuinzeJours = EcheancesEquipement.calculer(b, journal, AUJOURDHUI.plusDays(15), AUJOURDHUI);
        assertThat(pourUnPretDeQuinzeJours.motifsBloquants())
                .containsExactly("Inspection visuelle (TIV) à échéance le 10/10/2026, avant la fin du prêt.");
    }

    @Test
    @DisplayName("Révision de détendeur en retard : avertissement seulement")
    void detendeur_revisionEnRetard() {
        Equipement d = new Equipement();
        d.setType(TypeEquipement.DETENDEUR);
        d.setReference("D-01");
        d.setPeriodiciteRevisionMois(24);
        Etat etat = calculer(d, List.of(
                intervention(TypeIntervention.REVISION, LocalDate.of(2024, 1, 15), Resultat.CONFORME)));

        assertThat(etat.prochaineRevision()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(etat.bloquant()).isFalse();
        assertThat(etat.alertes()).singleElement()
                .satisfies(a -> assertThat(a.message()).isEqualTo("Révision dépassée depuis le 15/01/2026."));
    }

    @Test
    @DisplayName("Date prévue de mise au rebut atteinte, hors service ou rebut : plus de prêt")
    void rebutEtHorsService() {
        Equipement c = new Equipement();
        c.setType(TypeEquipement.COMBINAISON);
        c.setReference("C-01");
        c.setDateRebutPrevue(LocalDate.of(2026, 9, 1));
        assertThat(calculer(c, List.of()).motifsBloquants())
                .containsExactly("Date prévue de mise au rebut dépassée depuis le 01/09/2026.");

        c.setDateRebutPrevue(null);
        c.setHorsService(true);
        assertThat(calculer(c, List.of()).motifsBloquants()).containsExactly("Hors service.");

        c.setDateRebut(LocalDate.of(2026, 9, 30));
        assertThat(calculer(c, List.of()).motifsBloquants()).containsExactly("Mis au rebut le 30/09/2026.");
    }

    private static Etat calculer(Equipement e, List<InterventionEquipement> journal) {
        return EcheancesEquipement.calculer(e, journal, AUJOURDHUI, AUJOURDHUI);
    }

    private static Equipement bloc(boolean regimeTiv) {
        Equipement b = new Equipement();
        b.setType(TypeEquipement.BLOC);
        b.setReference("B-01");
        b.setRegimeTiv(regimeTiv);
        return b;
    }

    private static InterventionEquipement intervention(TypeIntervention type, LocalDate date, Resultat resultat) {
        InterventionEquipement i = new InterventionEquipement();
        i.setType(type);
        i.setDateIntervention(date);
        i.setResultat(resultat);
        return i;
    }
}
