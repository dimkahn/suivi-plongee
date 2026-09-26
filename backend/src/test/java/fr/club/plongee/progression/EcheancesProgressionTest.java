package fr.club.plongee.progression;

import fr.club.plongee.progression.domain.PeriodeProgression;
import fr.club.plongee.progression.domain.ProgressionType;
import fr.club.plongee.progression.service.EcheancesProgression;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Échéance d'un bloc dans une progression, et retard qui en découle. */
class EcheancesProgressionTest {

    private static final LocalDate RENTREE_2026 = LocalDate.of(2026, 9, 1);

    @Test
    @DisplayName("Un bloc repris dans plusieurs périodes a pour échéance la fin de la dernière, située dans l'année de la saison")
    void parBloc_retientLaDernierePeriode() {
        BlocCompetence immersion = bloc(1L);
        BlocCompetence milieu = bloc(2L);
        ProgressionType p = new ProgressionType();
        p.getPeriodes().addAll(List.of(
                periode(1, 9, 10, immersion),
                periode(2, 11, 2, immersion),
                periode(3, 5, 6, milieu)));

        Map<Long, LocalDate> echeances = EcheancesProgression.parBloc(p, RENTREE_2026);

        assertThat(echeances).containsEntry(1L, LocalDate.of(2027, 2, 28));
        assertThat(echeances).containsEntry(2L, LocalDate.of(2027, 6, 30));
    }

    @Test
    @DisplayName("Un mois de fin égal ou postérieur à la rentrée reste dans la première année")
    void parBloc_moisDeLaPremiereAnnee() {
        ProgressionType p = new ProgressionType();
        p.getPeriodes().add(periode(1, 9, 12, bloc(1L)));

        assertThat(EcheancesProgression.parBloc(p, RENTREE_2026)).containsEntry(1L, LocalDate.of(2026, 12, 31));
    }

    @Test
    @DisplayName("En retard seulement après l'échéance, sans validation et avec des critères non acquis")
    void enRetard() {
        LocalDate echeance = LocalDate.of(2027, 2, 28);
        LocalDate apres = LocalDate.of(2027, 3, 1);

        assertThat(EcheancesProgression.enRetard(echeance, apres, false, 1, 3)).isTrue();
        assertThat(EcheancesProgression.enRetard(echeance, echeance, false, 1, 3)).isFalse();
        assertThat(EcheancesProgression.enRetard(echeance, apres, true, 1, 3)).isFalse();
        assertThat(EcheancesProgression.enRetard(echeance, apres, false, 3, 3)).isFalse();
        assertThat(EcheancesProgression.enRetard(null, apres, false, 0, 3)).isFalse();
    }

    private static BlocCompetence bloc(Long id) {
        BlocCompetence b = new BlocCompetence();
        b.setId(id);
        return b;
    }

    private static PeriodeProgression periode(int rang, int debut, int fin, BlocCompetence... blocs) {
        PeriodeProgression p = new PeriodeProgression();
        p.setRang(rang);
        p.setMoisDebut(debut);
        p.setMoisFin(fin);
        p.setBlocs(new LinkedHashSet<>(List.of(blocs)));
        return p;
    }
}
