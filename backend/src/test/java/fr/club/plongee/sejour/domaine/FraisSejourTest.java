package fr.club.plongee.sejour.domaine;

import fr.club.plongee.sejour.domaine.FraisSejour.*;
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
    @DisplayName("Montant écrit en euros, à la française")
    void euros() {
        assertThat(FraisSejour.euros(123450)).isEqualTo("1 234,50 €");
        assertThat(FraisSejour.euros(5)).isEqualTo("0,05 €");
    }
}
