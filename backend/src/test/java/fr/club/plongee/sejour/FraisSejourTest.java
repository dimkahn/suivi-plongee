package fr.club.plongee.sejour;

import fr.club.plongee.sejour.FraisSejour.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Le calcul du partage des frais, sans base. */
class FraisSejourTest {

    private static Part part(long id, int n) {
        return new Part(id, n);
    }

    @Test
    @DisplayName("Une dépense se répartit au centime près, les centimes restants aux premiers")
    void repartitionAuCentime() {
        Map<Long, Long> parts = FraisSejour.repartir(1000, List.of(part(3, 1), part(1, 1), part(2, 1)));
        assertThat(parts).containsEntry(1L, 334L).containsEntry(2L, 333L).containsEntry(3L, 333L);
        assertThat(parts.values().stream().mapToLong(Long::longValue).sum()).isEqualTo(1000);

        // Un couple compte pour deux parts.
        assertThat(FraisSejour.repartir(900, List.of(part(1, 2), part(2, 1))))
                .containsEntry(1L, 600L).containsEntry(2L, 300L);
    }

    @Test
    @DisplayName("Les centimes d'arrondi ne s'accumulent pas sur les premiers d'une dépense à l'autre")
    void arrondiSurLeTotalDeChacun() {
        // Trois repas de 10 € pour trois : chacun doit exactement 10 €, pas 10,02 € pour l'un et 9,99 € pour les autres.
        List<Depense> depenses = new java.util.ArrayList<>();
        for (long i = 1; i <= 3; i++) {
            depenses.add(new Depense(i, "Repas " + i, CategorieDepense.REPAS, 1000, 4L, null,
                    List.of(part(1, 1), part(2, 1), part(3, 1)), List.of(), null, null));
        }
        Comptes c = FraisSejour.calculer(List.of(1L, 2L, 3L, 4L), depenses, List.of());
        assertThat(c.soldes()).extracting(Solde::duCentimes).containsExactly(1000L, 1000L, 1000L, 0L);

        // Sur beaucoup de dépenses, l'écart entre deux personnes aux mêmes parts reste d'un centime au plus.
        depenses.clear();
        for (long i = 1; i <= 40; i++) {
            depenses.add(new Depense(i, "Dépense " + i, CategorieDepense.AUTRE, 1003 + 10 * i, 1L, null,
                    List.of(part(1, 1), part(2, 1), part(3, 1), part(4, 1), part(5, 1), part(6, 1), part(7, 1)),
                    List.of(), null, null));
        }
        c = FraisSejour.calculer(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L), depenses, List.of());
        long plusGrand = c.soldes().stream().mapToLong(Solde::duCentimes).max().orElseThrow();
        long plusPetit = c.soldes().stream().mapToLong(Solde::duCentimes).min().orElseThrow();
        assertThat(plusGrand - plusPetit).isLessThanOrEqualTo(1);
        assertThat(c.soldes().stream().mapToLong(Solde::duCentimes).sum()).isEqualTo(c.totalCentimes());
        assertThat(c.soldes().stream().mapToLong(Solde::soldeCentimes).sum()).isZero();
    }

    @Test
    @DisplayName("Soldes et remboursements à faire, remboursements déjà faits compris")
    void soldesEtRemboursements() {
        // Anne paie le gîte 300 € pour trois, Bruno les courses 60 € pour trois.
        List<Depense> depenses = List.of(
                new Depense(1L, "Gîte", CategorieDepense.HEBERGEMENT, 30000, 1L, null,
                        List.of(part(1, 1), part(2, 1), part(3, 1)), List.of(), null, null),
                new Depense(2L, "Courses", CategorieDepense.REPAS, 6000, 2L, null,
                        List.of(part(1, 1), part(2, 1), part(3, 1)), List.of(), null, null));
        Comptes c = FraisSejour.calculer(List.of(1L, 2L, 3L), depenses, List.of());
        assertThat(c.totalCentimes()).isEqualTo(36000);
        // Chacun doit 120 € : Anne +180, Bruno -60, Chloé -120.
        assertThat(c.soldes()).extracting(Solde::soldeCentimes).containsExactly(18000L, -6000L, -12000L);
        assertThat(c.remboursements()).containsExactlyInAnyOrder(
                new Remboursement(3L, 1L, 12000), new Remboursement(2L, 1L, 6000));

        // Chloé a déjà remboursé Anne : il ne reste que Bruno.
        Comptes apres = FraisSejour.calculer(List.of(1L, 2L, 3L), depenses,
                List.of(new Versement(1L, 3L, 1L, 12000, null, null, null)));
        assertThat(apres.soldes()).extracting(Solde::soldeCentimes).containsExactly(6000L, -6000L, 0L);
        assertThat(apres.remboursements()).containsExactly(new Remboursement(2L, 1L, 6000));
    }

    @Test
    @DisplayName("Le club peut avancer une dépense : on lui rembourse sa part comme à un participant")
    void depenseAvanceeParLeClub() {
        // Le club avance le bateau 300 € pour trois ; Anne paie les courses 60 € pour trois.
        List<Depense> depenses = List.of(
                new Depense(1L, "Bateau", CategorieDepense.PLONGEE, 30000, null, null,
                        List.of(part(1, 1), part(2, 1), part(3, 1)), List.of(), null, null),
                new Depense(2L, "Courses", CategorieDepense.REPAS, 6000, 1L, null,
                        List.of(part(1, 1), part(2, 1), part(3, 1)), List.of(), null, null));
        Comptes c = FraisSejour.calculer(List.of(1L, 2L, 3L), depenses, List.of());
        // Chacun doit 120 € : Anne -60, Bruno -120, Chloé -120 ; le club +300, après les participants.
        assertThat(c.soldes()).containsExactly(new Solde(1L, 6000, 12000, -6000), new Solde(2L, 0, 12000, -12000),
                new Solde(3L, 0, 12000, -12000), new Solde(null, 30000, 0, 30000));
        assertThat(c.remboursements()).containsExactlyInAnyOrder(new Remboursement(2L, null, 12000),
                new Remboursement(3L, null, 12000), new Remboursement(1L, null, 6000));

        // Bruno a remboursé le club.
        Comptes apres = FraisSejour.calculer(List.of(1L, 2L, 3L), depenses,
                List.of(new Versement(1L, 2L, null, 12000, null, null, null)));
        assertThat(apres.remboursements()).containsExactlyInAnyOrder(
                new Remboursement(3L, null, 12000), new Remboursement(1L, null, 6000));
    }

    @Test
    @DisplayName("Montant écrit en euros, à la française")
    void euros() {
        assertThat(FraisSejour.euros(123450)).isEqualTo("1 234,50 €");
        assertThat(FraisSejour.euros(5)).isEqualTo("0,05 €");
    }
}
