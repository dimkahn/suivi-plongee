package fr.club.plongee.planning.service;

import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.planning.domain.AffectationGroupe;
import fr.club.plongee.planning.domain.EspaceBassin;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.service.PlanningService.CaseVue;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.Utilisateur;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Place de chaque groupe un soir donné, et avertissements du planning. */
class PlanningServiceTest {

    private static final EspaceBassin LIGNE_3 = espace(3L, "Ligne 3", EspaceBassin.Type.LIGNE, null);
    private static final EspaceBassin FOSSE = espace(7L, "Fosse", EspaceBassin.Type.FOSSE, 15);
    private static final Map<Long, Integer> CAPACITES = Map.of(7L, 15);

    @Test
    @DisplayName("Sans consigne, un groupe est à sa ligne attitrée")
    void caseParDefaut_ligneAttitree() {
        GroupeEntrainement g = groupe(1L, "Prépa N2", null, LIGNE_3, 0);

        CaseVue c = PlanningService.caseVue(g, null);

        assertThat(c.type()).isEqualTo("ATTITREE");
        assertThat(c.libelle()).isEqualTo("Ligne 3");
    }

    @Test
    @DisplayName("Une consigne de fosse limitée s'affiche avec sa profondeur")
    void caseFosseLimitee() {
        GroupeEntrainement g = groupe(1L, "Débutants", "N1", LIGNE_3, 0);
        AffectationGroupe a = new AffectationGroupe();
        a.setType(AffectationGroupe.Type.ESPACE);
        a.setEspace(FOSSE);
        a.setProfondeurLimitee(6);

        assertThat(PlanningService.caseVue(g, a).libelle()).isEqualTo("Fosse (limitée à 6 m)");
    }

    @Test
    @DisplayName("Fosse au-delà de sa capacité : élèves et encadrants des groupes présents")
    void fosseTropPleine() {
        GroupeEntrainement a = groupe(1L, "Prépa N2", "N2", LIGNE_3, 8);
        GroupeEntrainement b = groupe(2L, "N2+", null, LIGNE_3, 7);
        List<CaseVue> cases = List.of(fosse(a, null), fosse(b, null));

        List<String> avertissements = PlanningService.avertissements(List.of(a, b), cases, CAPACITES);

        // 8 + 7 élèves, 1 encadrant chacun : 17 pour 15 places.
        assertThat(avertissements).anyMatch(s -> s.contains("17 plongeurs pour 15 places"));
    }

    @Test
    @DisplayName("Débutants en fosse sans limite : il faut limiter à 6 m ; limitée, rien à signaler")
    void debutantsEnFosse() {
        GroupeEntrainement d = groupe(1L, "Débutants", "N1", LIGNE_3, 4);

        assertThat(PlanningService.avertissements(List.of(d), List.of(fosse(d, null)), CAPACITES))
                .anyMatch(s -> s.contains("limiter à 6 m pour des débutants"));
        assertThat(PlanningService.avertissements(List.of(d), List.of(fosse(d, 6)), CAPACITES)).isEmpty();
    }

    @Test
    @DisplayName("Un groupe encadré par un E1 en fosse profonde est signalé")
    void encadrantE1EnFosse() {
        GroupeEntrainement g = groupe(1L, "Perfect N1", null, LIGNE_3, 3);
        g.getEncadrants().iterator().next().setNiveauEncadrement(NiveauEncadrement.E1);

        assertThat(PlanningService.avertissements(List.of(g), List.of(fosse(g, null)), CAPACITES))
                .anyMatch(s -> s.contains("encadré par un E1"));
    }

    @Test
    @DisplayName("Une même ligne donnée à deux groupes est signalée")
    void ligneEnDouble() {
        GroupeEntrainement a = groupe(1L, "Prépa N2", "N2", LIGNE_3, 2);
        GroupeEntrainement b = groupe(2L, "N2+", null, LIGNE_3, 2);
        List<CaseVue> cases = List.of(PlanningService.caseVue(a, null), PlanningService.caseVue(b, null));

        assertThat(PlanningService.avertissements(List.of(a, b), cases, CAPACITES))
                .containsExactly("Ligne 3 donnée à plusieurs groupes : Prépa N2, N2+.");
    }

    private static CaseVue fosse(GroupeEntrainement g, Integer limite) {
        AffectationGroupe a = new AffectationGroupe();
        a.setType(AffectationGroupe.Type.ESPACE);
        a.setEspace(FOSSE);
        a.setProfondeurLimitee(limite);
        return PlanningService.caseVue(g, a);
    }

    private static EspaceBassin espace(Long id, String nom, EspaceBassin.Type type, Integer capacite) {
        EspaceBassin e = new EspaceBassin();
        e.setId(id);
        e.setNom(nom);
        e.setType(type);
        e.setCapacite(capacite);
        return e;
    }

    /** Un groupe avec {@code nbEleves} élèves et un encadrant E2. */
    private static GroupeEntrainement groupe(Long id, String nom, String niveau, EspaceBassin attitre, int nbEleves) {
        GroupeEntrainement g = new GroupeEntrainement();
        g.setId(id);
        g.setNom(nom);
        g.setNiveauPrepare(niveau);
        g.setEspaceAttitre(attitre);
        for (long i = 0; i < nbEleves; i++) {
            Eleve e = new Eleve();
            e.setId(id * 100 + i);
            g.getEleves().add(e);
        }
        Utilisateur u = new Utilisateur();
        u.setId(id * 1000);
        u.setNiveauEncadrement(NiveauEncadrement.E2);
        g.getEncadrants().add(u);
        return g;
    }
}
