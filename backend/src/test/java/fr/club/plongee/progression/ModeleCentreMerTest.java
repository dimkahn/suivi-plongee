package fr.club.plongee.progression;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.progression.service.ModeleCentreMerService;
import fr.club.plongee.progression.service.ProgressionService;
import fr.club.plongee.progression.service.ProgressionService.ProgressionVue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Modèle « centre de plongée en mer » installé sur la base de démonstration.
 * Chaque test est annulé à la fin (transaction) : les autres tests gardent la
 * base du club, comme une installation qui ne l'a pas demandé.
 */
@SpringBootTest
@ActiveProfiles("dev")
@Transactional
class ModeleCentreMerTest {

    @Autowired ModeleCentreMerService modele;
    @Autowired ProgressionService progressions;
    @Autowired JdbcTemplate jdbc;

    private static final String BLOCS_N1 = """
            SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
             WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'""";

    @Test
    @DisplayName("Le modèle installe la base N1 en mer et trois progressions par plongées, une seule fois")
    void installeExercicesEtProgressions() {
        assertThat(modele.etat().installe()).isFalse();

        var resultat = modele.installer(false);

        assertThat(resultat.progressions()).isEqualTo(3);
        assertThat(resultat.exercicesMer()).isEqualTo(44);
        assertThat(resultat.exercicesDesactives()).isZero();
        assertThat(modele.etat().installe()).isTrue();

        // Chaque critère technique du N1 relié à un exercice de la mer a un exercice de maîtrise :
        // sans lui, la fiche de suivi ne pourrait jamais le passer à « acquis ».
        Integer sansMaitrise = jdbc.queryForObject("""
                SELECT COUNT(*) FROM critere c
                 WHERE c.bloc_id IN (%s)
                   AND EXISTS (SELECT 1 FROM exercice_competence_critere ec
                                 JOIN exercice_competence e ON e.id = ec.exercice_id
                                WHERE ec.critere_id = c.id AND e.numero LIKE 'M%%')
                   AND NOT EXISTS (SELECT 1 FROM exercice_competence_critere ec
                                     JOIN exercice_competence e ON e.id = ec.exercice_id
                                    WHERE ec.critere_id = c.id AND e.numero LIKE 'M%%' AND e.phase = 'MAITRISE')
                """.formatted(BLOCS_N1), Integer.class);
        assertThat(sansMaitrise).isZero();
        Integer criteresTechniquesSansExercice = jdbc.queryForObject("""
                SELECT COUNT(*) FROM critere c JOIN bloc_competence b ON b.id = c.bloc_id
                 WHERE b.id IN (%s) AND b.evaluation_transverse = FALSE
                   AND NOT EXISTS (SELECT 1 FROM exercice_competence_critere ec
                                     JOIN exercice_competence e ON e.id = ec.exercice_id
                                    WHERE ec.critere_id = c.id AND e.numero LIKE 'M%%')
                """.formatted(BLOCS_N1), Integer.class);
        assertThat(criteresTechniquesSansExercice).isZero();

        List<ProgressionService.ProgressionResume> parPlongees = progressions.lister().stream()
                .filter(p -> "PLONGEES".equals(p.decoupage())).toList();
        assertThat(parPlongees).extracting(ProgressionService.ProgressionResume::niveau)
                .containsExactlyInAnyOrder("N1", "N2", "N3");

        ProgressionVue n1 = progressions.detail(parPlongees.stream()
                .filter(p -> p.niveau().equals("N1")).findFirst().orElseThrow().id());
        assertThat(n1.periodes()).hasSize(5);
        assertThat(n1.periodes().get(4).plongeeDebut()).isEqualTo(5);
        assertThat(n1.periodes().get(4).plongeeFin()).isEqualTo(6);
        assertThat(n1.periodes()).allSatisfy(p -> assertThat(p.moisDebut()).isNull());
        // Tous les exercices de la mer figurent dans le parcours.
        assertThat(n1.periodes().stream().mapToInt(p -> p.exercices().size()).sum()).isEqualTo(44);

        ProgressionVue n2 = progressions.detail(parPlongees.stream()
                .filter(p -> p.niveau().equals("N2")).findFirst().orElseThrow().id());
        assertThat(n2.periodes().stream().mapToInt(p -> p.exercices().size()).sum()).isEqualTo(99);
        ProgressionVue n3 = progressions.detail(parPlongees.stream()
                .filter(p -> p.niveau().equals("N3")).findFirst().orElseThrow().id());
        assertThat(n3.periodes().stream().mapToInt(p -> p.exercices().size()).sum()).isEqualTo(63);

        assertThatThrownBy(() -> modele.installer(false))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("déjà installé");
    }

    @Test
    @DisplayName("Sur demande, les exercices N1 pensés pour la piscine sont désactivés, pas ceux de la mer")
    void desactiveLesExercicesPiscineN1() {
        var resultat = modele.installer(true);

        assertThat(resultat.exercicesDesactives()).isEqualTo(90);
        Integer actifs = jdbc.queryForObject("SELECT COUNT(*) FROM exercice_competence WHERE actif = TRUE"
                + " AND bloc_id IN (" + BLOCS_N1 + ")", Integer.class);
        assertThat(actifs).isEqualTo(44);
    }
}
