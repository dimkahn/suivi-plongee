package fr.club.plongee.notification.relance;

import fr.club.plongee.notification.relance.CalculRelancesCaci.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Le calcul des relances CACI dues un jour D, sans base ni envoi. */
class CalculRelancesCaciTest {

    private static final long PAUL = 1L;
    private static final long TOM = 3L;
    private static final long HUGO = 10L;
    private static final long LEA = 11L;
    /** Exemple filé de la spec : CACI passé le 20/11/2025, J-30 le 21/10/2026. */
    private static final LocalDate F = LocalDate.of(2026, 11, 20);

    private static Moniteur paul(LocalDate fin) {
        return new Moniteur(PAUL, "Marin", "Paul", fin);
    }

    private static Resultat calculer(LocalDate jour, List<Moniteur> moniteurs, List<Eleve> eleves,
                                     List<RelanceFaite> faites) {
        return CalculRelancesCaci.calculer(jour, moniteurs, eleves, faites);
    }

    @Test
    @DisplayName("Relance bientôt due à F = D + 30, pas à F = D + 31")
    void delaiDe30Jours() {
        LocalDate d = LocalDate.of(2026, 10, 21);

        assertThat(calculer(d, List.of(paul(d.plusDays(30))), List.of(), List.of()).dues())
                .containsExactly(new Relance(Qualite.MONITEUR, PAUL, "Marin", "Paul", Moment.BIENTOT,
                        LocalDate.of(2026, 11, 20)));
        assertThat(calculer(d, List.of(paul(d.plusDays(31))), List.of(), List.of()).dues()).isEmpty();
    }

    @Test
    @DisplayName("À F − 31 jours, aucune relance n'est due")
    void rienAvantJMoins30() {
        Resultat r = calculer(LocalDate.of(2026, 10, 20), List.of(paul(F)), List.of(), List.of());

        assertThat(r.dues()).isEmpty();
        assertThat(r.sansCaci()).isEmpty();
    }

    @Test
    @DisplayName("Une relance bientôt déjà faite pour cette F n'est plus due jusqu'à F − 1")
    void uneSeuleRelanceBientot() {
        List<RelanceFaite> faites = List.of(
                new RelanceFaite(Qualite.MONITEUR, PAUL, Moment.BIENTOT, F, LocalDate.of(2026, 10, 21)));

        for (LocalDate d = LocalDate.of(2026, 10, 21); d.isBefore(F); d = d.plusDays(1)) {
            assertThat(calculer(d, List.of(paul(F)), List.of(), faites).dues()).as("le %s", d).isEmpty();
        }
    }

    @Test
    @DisplayName("Après F, ni relance ni rattrapage d'un jour J manqué")
    void rienApresJ() {
        RelanceFaite bientot = new RelanceFaite(Qualite.MONITEUR, PAUL, Moment.BIENTOT, F, LocalDate.of(2026, 10, 21));
        RelanceFaite jourJ = new RelanceFaite(Qualite.MONITEUR, PAUL, Moment.JOUR_J, F, F);

        // Jour J fait : ni le rejeu du jour F, ni le lendemain.
        assertThat(calculer(F, List.of(paul(F)), List.of(), List.of(bientot, jourJ)).dues()).isEmpty();
        assertThat(calculer(F.plusDays(1), List.of(paul(F)), List.of(), List.of(bientot, jourJ)).dues()).isEmpty();
        // Jour J manqué : pas de rattrapage à F + 1, ni au récapitulatif.
        Resultat manque = calculer(F.plusDays(1), List.of(paul(F)), List.of(), List.of(bientot));
        assertThat(manque.dues()).isEmpty();
        assertThat(manque.sansCaci()).isEmpty();
        // CACI expiré depuis 20 jours, jamais relancé.
        LocalDate d = LocalDate.of(2026, 10, 21);
        assertThat(calculer(d, List.of(paul(d.minusDays(20))), List.of(), List.of()).dues()).isEmpty();
    }

    @Test
    @DisplayName("Une nouvelle F ouvre un nouveau cycle ; l'ancienne F ne déclenche plus rien")
    void renouvellementNouveauCycle() {
        // Relancé le 21/10/2026 pour F, puis examen au 30/10/2026 saisi le 01/11/2026 : F′ = 30/10/2027.
        LocalDate nouvelleF = LocalDate.of(2027, 10, 30);
        List<RelanceFaite> faites = List.of(
                new RelanceFaite(Qualite.MONITEUR, PAUL, Moment.BIENTOT, F, LocalDate.of(2026, 10, 21)));

        assertThat(calculer(F, List.of(paul(nouvelleF)), List.of(), faites).dues()).isEmpty();
        assertThat(calculer(LocalDate.of(2027, 9, 30), List.of(paul(nouvelleF)), List.of(), faites).dues())
                .containsExactly(new Relance(Qualite.MONITEUR, PAUL, "Marin", "Paul", Moment.BIENTOT, nouvelleF));
        assertThat(calculer(nouvelleF, List.of(paul(nouvelleF)), List.of(), faites).dues())
                .containsExactly(new Relance(Qualite.MONITEUR, PAUL, "Marin", "Paul", Moment.JOUR_J, nouvelleF));
    }

    @Test
    @DisplayName("Une date d'examen corrigée donne une nouvelle relance bientôt")
    void dateCorrigee() {
        // Relancé le 21/10/2026 pour F, puis examen corrigé au 10/11/2025 le 22/10/2026 : F″ = 10/11/2026.
        LocalDate corrigee = LocalDate.of(2026, 11, 10);
        List<RelanceFaite> faites = List.of(
                new RelanceFaite(Qualite.MONITEUR, PAUL, Moment.BIENTOT, F, LocalDate.of(2026, 10, 21)));

        assertThat(calculer(LocalDate.of(2026, 10, 22), List.of(paul(corrigee)), List.of(), faites).dues())
                .containsExactly(new Relance(Qualite.MONITEUR, PAUL, "Marin", "Paul", Moment.BIENTOT, corrigee));
        assertThat(calculer(corrigee, List.of(paul(corrigee)), List.of(), faites).dues())
                .containsExactly(new Relance(Qualite.MONITEUR, PAUL, "Marin", "Paul", Moment.JOUR_J, corrigee));
        assertThat(calculer(F, List.of(paul(corrigee)), List.of(), faites).dues()).isEmpty();
    }

    @Test
    @DisplayName("Un élève est cité à J-30 sous bientôt, à J sous aujourd'hui, jamais entre les deux")
    void eleveAJMoins30EtAJ() {
        Eleve hugo = new Eleve(HUGO, null, "Lemaire", "Hugo", F);
        LocalDate jMoins30 = LocalDate.of(2026, 10, 21);

        assertThat(calculer(jMoins30, List.of(), List.of(hugo), List.of()).dues())
                .containsExactly(new Relance(Qualite.ELEVE, HUGO, "Lemaire", "Hugo", Moment.BIENTOT, F));
        List<RelanceFaite> faites = List.of(new RelanceFaite(Qualite.ELEVE, HUGO, Moment.BIENTOT, F, jMoins30));
        for (LocalDate d = jMoins30.plusDays(1); d.isBefore(F); d = d.plusDays(1)) {
            assertThat(calculer(d, List.of(), List.of(hugo), faites).dues()).as("le %s", d).isEmpty();
        }
        assertThat(calculer(F, List.of(), List.of(hugo), faites).dues())
                .containsExactly(new Relance(Qualite.ELEVE, HUGO, "Lemaire", "Hugo", Moment.JOUR_J, F));
    }

    @Test
    @DisplayName("Un dossier élève rattaché à un moniteur du périmètre est ignoré")
    void moniteurEtEleve() {
        // Dossier élève de Paul, rattaché à son compte, avec un autre CACI (F = 25/11/2026).
        Eleve paulEleve = new Eleve(20L, PAUL, "Marin", "Paul", LocalDate.of(2026, 11, 25));

        Resultat r = calculer(LocalDate.of(2026, 10, 21), List.of(paul(F)), List.of(paulEleve), List.of());
        assertThat(r.dues())
                .containsExactly(new Relance(Qualite.MONITEUR, PAUL, "Marin", "Paul", Moment.BIENTOT, F));

        List<RelanceFaite> faites = List.of(
                new RelanceFaite(Qualite.MONITEUR, PAUL, Moment.BIENTOT, F, LocalDate.of(2026, 10, 21)));
        Resultat jMoins30DuDossier = calculer(LocalDate.of(2026, 10, 26), List.of(paul(F)), List.of(paulEleve), faites);
        assertThat(jMoins30DuDossier.dues()).isEmpty();
        assertThat(jMoins30DuDossier.sansCaci()).isEmpty();
    }

    @Test
    @DisplayName("Une personne sans CACI n'est citée qu'une fois sur 7 jours")
    void sansCaciUneFoisParSemaine() {
        Moniteur tom = new Moniteur(TOM, "Vidal", "Tom", null);
        Eleve lea = new Eleve(LEA, null, "Durand", "Léa", null);
        Relance tomCite = new Relance(Qualite.MONITEUR, TOM, "Vidal", "Tom", Moment.SANS_CACI, null);
        LocalDate premier = LocalDate.of(2026, 10, 21);

        assertThat(avecUneEcheance(premier, tom, lea, List.of()).sansCaci()).containsExactlyInAnyOrder(
                tomCite, new Relance(Qualite.ELEVE, LEA, "Durand", "Léa", Moment.SANS_CACI, null));

        // Tom a été cité le 21/10/2026 ; une relance est due chacun des jours suivants.
        List<RelanceFaite> faites = List.of(new RelanceFaite(Qualite.MONITEUR, TOM, Moment.SANS_CACI, null, premier));
        assertThat(avecUneEcheance(LocalDate.of(2026, 10, 22), tom, lea, faites).sansCaci()).doesNotContain(tomCite);
        assertThat(avecUneEcheance(LocalDate.of(2026, 10, 27), tom, lea, faites).sansCaci()).doesNotContain(tomCite);
        assertThat(avecUneEcheance(LocalDate.of(2026, 10, 28), tom, lea, faites).sansCaci()).contains(tomCite);
    }

    @Test
    @DisplayName("Une personne sans CACI déjà citée le jour même n'est pas citée une deuxième fois si le traitement repasse")
    void sansCaciPasDeuxFoisLeMemeJour() {
        Moniteur tom = new Moniteur(TOM, "Vidal", "Tom", null);
        Eleve lea = new Eleve(LEA, null, "Durand", "Léa", null);
        Relance tomCite = new Relance(Qualite.MONITEUR, TOM, "Vidal", "Tom", Moment.SANS_CACI, null);
        LocalDate jour = LocalDate.of(2026, 10, 21);
        List<RelanceFaite> faites = List.of(new RelanceFaite(Qualite.MONITEUR, TOM, Moment.SANS_CACI, null, jour));

        assertThat(avecUneEcheance(jour, tom, lea, faites).sansCaci()).doesNotContain(tomCite);
    }

    @Test
    @DisplayName("Sans relance due, pas de récapitulatif même s'il y a des personnes sans CACI")
    void pasDeRecapitulatifSansEcheance() {
        Moniteur tom = new Moniteur(TOM, "Vidal", "Tom", null);
        Eleve lea = new Eleve(LEA, null, "Durand", "Léa", null);

        Resultat r = calculer(LocalDate.of(2026, 10, 21), List.of(tom, paul(F.plusYears(1))), List.of(lea), List.of());

        assertThat(r.recapitulatifDu()).isFalse();
        assertThat(r.dues()).isEmpty();
        assertThat(r.sansCaci()).isEmpty();
    }

    /** Le jour D, avec un autre élève à J-30 pour que le récapitulatif soit dû. */
    private static Resultat avecUneEcheance(LocalDate d, Moniteur moniteur, Eleve eleve, List<RelanceFaite> faites) {
        Eleve aEcheance = new Eleve(99L, null, "Berger", "Inès", d.plusDays(30));
        return calculer(d, List.of(moniteur), List.of(eleve, aEcheance), faites);
    }
}
