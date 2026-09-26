package fr.club.plongee.progression;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.progression.domain.PeriodeProgression;
import fr.club.plongee.progression.domain.ProgressionType;
import fr.club.plongee.progression.repository.ProgressionTypeRepository;
import fr.club.plongee.progression.service.ProgressionService;
import fr.club.plongee.progression.service.ProgressionService.DemandePeriode;
import fr.club.plongee.progression.service.ProgressionService.DemandeProgression;
import fr.club.plongee.progression.service.ProgressionService.ProgressionVue;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Niveau;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.BlocCompetenceRepository;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.when;

/** Tests unitaires de l'enregistrement d'une progression type. */
@ExtendWith(MockitoExtension.class)
class ProgressionServiceTest {

    @Mock ProgressionTypeRepository progressions;
    @Mock ReferentielRepository referentiels;
    @Mock BlocCompetenceRepository blocs;

    ProgressionService service;
    Referentiel n1;
    BlocCompetence immersion;
    BlocCompetence equilibre;

    @BeforeEach
    void avantChaqueTest() {
        service = new ProgressionService(progressions, referentiels, blocs);
        n1 = referentiel(1L, Niveau.N1);
        immersion = bloc(10L, 3, "S'immerger", n1);
        equilibre = bloc(11L, 6, "S'équilibrer", n1);
    }

    @Test
    @DisplayName("L'ordre des périodes envoyées donne leur rang ; les blocs sont triés par ordre du référentiel")
    void creer_numeroteLesPeriodesDansLOrdre() {
        when(referentiels.findById(1L)).thenReturn(Optional.of(n1));
        when(blocs.findAllById(anyIterable())).thenReturn(List.of(equilibre, immersion));
        when(progressions.save(any())).thenAnswer(i -> i.getArgument(0));

        ProgressionVue vue = service.creer(new DemandeProgression(1L, " N1 hiver ", null, List.of(
                new DemandePeriode(null, "Piscine", 9, 10, Milieu.ARTIFICIEL, "", List.of(11L, 10L)),
                new DemandePeriode(null, "Mer", 5, 6, Milieu.NATUREL, "Fin de saison", List.of()))));

        assertThat(vue.nom()).isEqualTo("N1 hiver");
        assertThat(vue.periodes()).extracting(ProgressionService.PeriodeVue::rang).containsExactly(1, 2);
        assertThat(vue.periodes().get(0).blocs()).extracting(ProgressionService.BlocResume::ordre)
                .containsExactly(3, 6);
        assertThat(vue.periodes().get(0).note()).isNull();
        assertThat(vue.periodes().get(1).milieu()).isEqualTo("NATUREL");
    }

    @Test
    @DisplayName("Une période qui vise un bloc d'un autre référentiel est refusée")
    void creer_refuseUnBlocDUnAutreReferentiel() {
        BlocCompetence blocN2 = bloc(20L, 1, "Bloc N2", referentiel(2L, Niveau.N2));
        when(referentiels.findById(1L)).thenReturn(Optional.of(n1));
        when(blocs.findAllById(anyIterable())).thenReturn(List.of(blocN2));

        assertThatThrownBy(() -> service.creer(new DemandeProgression(1L, "N1", null, List.of(
                new DemandePeriode(null, "Piscine", 9, 10, null, null, List.of(20L))))))
                .isInstanceOf(RegleMetierException.class);
    }

    @Test
    @DisplayName("Modifier garde les périodes renvoyées (même id), supprime les absentes et renumérote")
    void modifier_conserveReordonneEtSupprime() {
        ProgressionType p = new ProgressionType();
        p.setId(5L);
        p.setReferentiel(n1);
        p.setNom("N1");
        PeriodeProgression automne = periode(51L, p, 1, "Automne");
        PeriodeProgression hiver = periode(52L, p, 2, "Hiver");
        PeriodeProgression printemps = periode(53L, p, 3, "Printemps");
        p.getPeriodes().addAll(List.of(automne, hiver, printemps));
        when(progressions.findById(5L)).thenReturn(Optional.of(p));
        when(progressions.save(any())).thenAnswer(i -> i.getArgument(0));

        ProgressionVue vue = service.modifier(5L, new DemandeProgression(null, "N1", null, List.of(
                new DemandePeriode(53L, "Printemps", 3, 4, null, null, null),
                new DemandePeriode(51L, "Automne", 9, 10, null, null, null))));

        assertThat(p.getPeriodes()).containsExactly(printemps, automne);
        assertThat(printemps.getRang()).isEqualTo(1);
        assertThat(automne.getRang()).isEqualTo(2);
        assertThat(vue.periodes()).extracting(ProgressionService.PeriodeVue::id).containsExactly(53L, 51L);
    }

    @Test
    @DisplayName("La copie reprend les périodes et leurs blocs sous un nouveau nom")
    void copier_reprendPeriodesEtBlocs() {
        ProgressionType p = new ProgressionType();
        p.setId(5L);
        p.setReferentiel(n1);
        p.setNom("N1 hiver");
        PeriodeProgression automne = periode(51L, p, 1, "Automne");
        automne.setBlocs(new java.util.LinkedHashSet<>(Set.of(immersion)));
        p.getPeriodes().add(automne);
        when(progressions.findById(5L)).thenReturn(Optional.of(p));
        when(progressions.save(any())).thenAnswer(i -> i.getArgument(0));

        ProgressionVue copie = service.copier(5L);

        assertThat(copie.nom()).isEqualTo("N1 hiver (copie)");
        assertThat(copie.periodes()).hasSize(1);
        assertThat(copie.periodes().get(0).id()).isNull();
        assertThat(copie.periodes().get(0).blocs()).extracting(ProgressionService.BlocResume::id)
                .containsExactly(10L);
    }

    private static Referentiel referentiel(Long id, Niveau niveau) {
        Referentiel r = new Referentiel();
        r.setId(id);
        r.setNiveau(niveau);
        r.setVersionMft("test");
        return r;
    }

    private static BlocCompetence bloc(Long id, int ordre, String intitule, Referentiel r) {
        BlocCompetence b = new BlocCompetence();
        b.setId(id);
        b.setOrdre(ordre);
        b.setIntitule(intitule);
        b.setReferentiel(r);
        return b;
    }

    private static PeriodeProgression periode(Long id, ProgressionType p, int rang, String intitule) {
        PeriodeProgression pp = new PeriodeProgression();
        pp.setId(id);
        pp.setProgression(p);
        pp.setRang(rang);
        pp.setIntitule(intitule);
        pp.setMoisDebut(9);
        pp.setMoisFin(10);
        return pp;
    }
}
