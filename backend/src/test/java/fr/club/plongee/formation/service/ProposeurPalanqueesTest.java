package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.formation.service.ProposeurPalanquees.Candidat;
import fr.club.plongee.formation.service.ProposeurPalanquees.Criteres;
import fr.club.plongee.formation.service.ProposeurPalanquees.Palanquee;
import fr.club.plongee.formation.service.ProposeurPalanquees.Proposition;
import fr.club.plongee.formation.service.ProposeurPalanquees.TypePlongee;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Proposition automatique des palanquées : calcul pur, sans base. */
class ProposeurPalanqueesTest {

    private static Candidat plongeur(String prenom, String aptitude) {
        return plongeur(prenom, aptitude, null);
    }

    private static Candidat plongeur(String prenom, String aptitude, String formation) {
        return new Candidat(null, null, "Test", prenom, aptitude, formation,
                AptitudePlongeur.lire(aptitude), false, null);
    }

    private static Candidat encadrant(String prenom, String aptitude) {
        return new Candidat(null, null, "Test", prenom, aptitude, null, AptitudePlongeur.lire(aptitude), true, null);
    }

    /** Un E2 qui prépare le E3 : son aptitude compte le E3, comme le fait PropositionPalanqueesService. */
    private static Candidat stagiaireE3(String prenom) {
        return new Candidat(null, null, "Test", prenom, "E2", null,
                AptitudePlongeur.lire("E2").avec(AptitudePlongeur.lire("E3")), true, NiveauEncadrement.E3);
    }

    @Test
    @DisplayName("Un stagiaire E3 encadre un élève N3 comme un E3, avec un rappel de la présence du tuteur")
    void stagiaireE3() {
        List<Candidat> c = List.of(stagiaireE3("Stag"), plongeur("Eleve", "N2", "N3"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(30, TypePlongee.ENSEIGNEMENT, 4, true, false, List.of(), List.of()));

        assertThat(prenoms(r.palanquees().getFirst())).containsExactly("Stag", "Eleve");
        assertThat(r.avertissements()).singleElement().satisfies(a ->
                assertThat(a).contains("stagiaire E3").contains("tuteur"));
    }

    private static Criteres exploration(int profondeur) {
        return new Criteres(profondeur, TypePlongee.EXPLORATION, 4, true, false, List.of(), List.of());
    }

    private static List<String> prenoms(Palanquee p) {
        return p.membres().stream().map(m -> m.candidat().prenom()).toList();
    }

    private static Palanquee palanqueeDe(Proposition r, String prenom) {
        return r.palanquees().stream().filter(p -> prenoms(p).contains(prenom)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("Lecture des aptitudes : codes reconnus dans le texte libre, la prérogative la plus étendue retenue")
    void lectureDesAptitudes() {
        assertThat(AptitudePlongeur.lire("N1")).isEqualTo(new AptitudePlongeur(20, null, null, false));
        assertThat(AptitudePlongeur.lire("Niveau 2")).isEqualTo(new AptitudePlongeur(40, 20, null, false));
        assertThat(AptitudePlongeur.lire("N2 PA40")).isEqualTo(new AptitudePlongeur(40, 40, null, false));
        // « PE40 » ne doit pas être lu comme un E4.
        assertThat(AptitudePlongeur.lire("PE40").encadrement()).isNull();
        assertThat(AptitudePlongeur.lire("MF1").encadrement()).isEqualTo(NiveauEncadrement.E3);
        assertThat(AptitudePlongeur.lire("N4").guidePalanquee()).isTrue();
        assertThat(AptitudePlongeur.lire("débutant")).isEqualTo(AptitudePlongeur.INCONNUE);
    }

    @Test
    @DisplayName("Exploration à 20 m : 4 plongeurs encadrés au plus par guide, palanquées équilibrées")
    void explorationEquilibree() {
        List<Candidat> c = List.of(
                encadrant("Guide1", "E2"), encadrant("Guide2", "N4"),
                plongeur("A", "N1"), plongeur("B", "N1"), plongeur("C", "N1"),
                plongeur("D", "N1"), plongeur("E", "N1"));

        Proposition r = ProposeurPalanquees.proposer(c, exploration(20));

        assertThat(r.palanquees()).hasSize(2);
        assertThat(r.palanquees()).allSatisfy(p -> {
            assertThat(p.membres().getFirst().fonction()).isEqualTo(FonctionPalanquee.GUIDE_PALANQUEE);
            assertThat(p.membres().size() - 1).isBetween(2, 3);
        });
        assertThat(r.nonPlaces()).isEmpty();
    }

    @Test
    @DisplayName("Profondeur visée : un N1 n'est jamais proposé à 40 m, la raison est donnée")
    void horsProfondeur() {
        List<Candidat> c = List.of(encadrant("Guide", "E3"), plongeur("Lea", "N1"), plongeur("Max", "PE40"));

        Proposition r = ProposeurPalanquees.proposer(c, exploration(40));

        assertThat(r.nonPlaces()).singleElement().satisfies(n -> {
            assertThat(n.candidat().prenom()).isEqualTo("Lea");
            assertThat(n.raison()).contains("limitée à 20 m");
        });
        assertThat(prenoms(r.palanquees().getFirst())).containsExactly("Guide", "Max");
    }

    @Test
    @DisplayName("Autonomes : regroupés par 2 ou 3 sans guide, jamais seuls")
    void autonomesParDeuxOuTrois() {
        List<Candidat> c = List.of(plongeur("A", "N3"), plongeur("B", "N3"), plongeur("C", "N3"), plongeur("D", "N3"));

        Proposition r = ProposeurPalanquees.proposer(c, exploration(40));

        assertThat(r.palanquees()).hasSize(2).allSatisfy(p -> {
            assertThat(p.autonome()).isTrue();
            assertThat(p.membres()).hasSize(2);
        });
    }

    @Test
    @DisplayName("Un autonome seul rejoint une palanquée encadrée si son aptitude le permet")
    void autonomeSeulEncadre() {
        List<Candidat> c = List.of(encadrant("Guide", "E2"), plongeur("Seul", "N2"), plongeur("Lea", "N1"));

        Proposition r = ProposeurPalanquees.proposer(c, exploration(20));

        assertThat(r.palanquees()).singleElement().satisfies(p ->
                assertThat(prenoms(p)).containsExactlyInAnyOrder("Guide", "Seul", "Lea"));
    }

    @Test
    @DisplayName("Sans le critère « autonomes ensemble », tout le monde est encadré")
    void autonomesEncadresSiCritereDecoche() {
        List<Candidat> c = List.of(encadrant("Guide", "E2"), plongeur("A", "N2"), plongeur("B", "N2"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(20, TypePlongee.EXPLORATION, 4, false, false, List.of(), List.of()));

        assertThat(r.palanquees()).singleElement().satisfies(p -> assertThat(p.autonome()).isFalse());
    }

    @Test
    @DisplayName("Enseignement : un élève N2 à 20 m demande un E2, l'E1 reste libre")
    void enseignementNiveauEncadrant() {
        List<Candidat> c = List.of(encadrant("Init", "E1"), encadrant("Moni", "E2"),
                plongeur("Eleve", "N1", "N2"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(20, TypePlongee.ENSEIGNEMENT, 4, true, false, List.of(), List.of()));

        Palanquee p = r.palanquees().getFirst();
        assertThat(p.membres().getFirst().candidat().prenom()).isEqualTo("Moni");
        assertThat(p.membres().getFirst().fonction()).isEqualTo(FonctionPalanquee.ENCADRANT);
        assertThat(r.encadrantsLibres()).extracting(Candidat::prenom).containsExactly("Init");
    }

    @Test
    @DisplayName("Enseignement : sans encadrant du niveau requis, l'élève n'est pas placé et on dit pourquoi")
    void enseignementSansEncadrantRequis() {
        List<Candidat> c = List.of(encadrant("Moni", "E2"), plongeur("Eleve", "N2", "N3"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(30, TypePlongee.ENSEIGNEMENT, 4, true, false, List.of(), List.of()));

        assertThat(r.palanquees()).isEmpty();
        assertThat(r.nonPlaces()).singleElement().satisfies(n -> assertThat(n.raison()).contains("E3 minimum"));
    }

    @Test
    @DisplayName("Le nombre maximum de plongeurs par palanquée est respecté, et borné à 4")
    void maximumParPalanquee() {
        List<Candidat> c = new ArrayList<>(List.of(encadrant("G1", "E2"), encadrant("G2", "E2"), encadrant("G3", "E2")));
        for (int i = 0; i < 6; i++) c.add(plongeur("P" + i, "N1"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(20, TypePlongee.EXPLORATION, 2, true, false, List.of(), List.of()));

        assertThat(r.palanquees()).hasSize(3).allSatisfy(p -> assertThat(p.membres()).hasSize(3));
        assertThatThrownBy(() -> ProposeurPalanquees.proposer(c,
                new Criteres(20, TypePlongee.EXPLORATION, 5, true, false, List.of(), List.of())))
                .isInstanceOf(RegleMetierException.class);
    }

    @Test
    @DisplayName("Encadrants en surplus : les palanquées chargées sont coupées en deux")
    void encadrantsEnSurplus() {
        List<Candidat> c = List.of(encadrant("G1", "E2"), encadrant("G2", "E2"),
                plongeur("A", "N1"), plongeur("B", "N1"), plongeur("C", "N1"), plongeur("D", "N1"));

        Proposition r = ProposeurPalanquees.proposer(c, exploration(20));

        assertThat(r.palanquees()).hasSize(2).allSatisfy(p -> assertThat(p.membres()).hasSize(3));
        assertThat(r.encadrantsLibres()).isEmpty();
    }

    @Test
    @DisplayName("Regroupement par niveau : les N1 et les N2 ne sont pas mélangés")
    void regroupementParNiveau() {
        List<Candidat> c = List.of(encadrant("G1", "E2"), encadrant("G2", "E2"),
                plongeur("N1a", "N1"), plongeur("N2a", "PE40"), plongeur("N1b", "N1"), plongeur("N2b", "PE40"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(20, TypePlongee.EXPLORATION, 4, false, true, List.of(), List.of()));

        assertThat(prenoms(palanqueeDe(r, "N1a"))).contains("N1b").doesNotContain("N2a", "N2b");
        assertThat(prenoms(palanqueeDe(r, "N2a"))).contains("N2b");
    }

    @Test
    @DisplayName("Binômes : gardés ensemble ou séparés, encadrant choisi par un plongeur respecté")
    void binomes() {
        List<Candidat> c = List.of(encadrant("G1", "E2"), encadrant("G2", "E2"),
                plongeur("A", "N1"), plongeur("B", "N1"), plongeur("C", "N1"), plongeur("D", "N1"));
        // A avec C, B séparé de D, et D avec G2.
        Criteres criteres = new Criteres(20, TypePlongee.EXPLORATION, 4, true, false,
                List.of(new int[]{2, 4}, new int[]{5, 1}), List.of(new int[]{3, 5}));

        Proposition r = ProposeurPalanquees.proposer(c, criteres);

        assertThat(prenoms(palanqueeDe(r, "A"))).contains("C");
        assertThat(prenoms(palanqueeDe(r, "B"))).doesNotContain("D");
        assertThat(prenoms(palanqueeDe(r, "D"))).contains("G2");
        assertThat(r.nonPlaces()).isEmpty();
    }

    @Test
    @DisplayName("Deux plongeurs à la fois ensemble et séparés : refus explicite")
    void binomesContradictoires() {
        List<Candidat> c = List.of(encadrant("G", "E2"), plongeur("A", "N1"), plongeur("B", "N1"));

        assertThatThrownBy(() -> ProposeurPalanquees.proposer(c, new Criteres(20, TypePlongee.EXPLORATION, 4,
                true, false, List.<int[]>of(new int[]{1, 2}), List.<int[]>of(new int[]{2, 1}))))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("à la fois");
    }

    @Test
    @DisplayName("Un encadrant décoché plonge comme les autres, selon son niveau")
    void encadrantDecoche() {
        Candidat e2 = new Candidat(null, null, "Test", "Libre", "E2", null, AptitudePlongeur.lire("E2"), false, null);
        List<Candidat> c = List.of(e2, plongeur("A", "N3"));

        Proposition r = ProposeurPalanquees.proposer(c, exploration(40));

        assertThat(r.palanquees()).singleElement().satisfies(p -> {
            assertThat(p.autonome()).isTrue();
            assertThat(prenoms(p)).containsExactlyInAnyOrder("Libre", "A");
        });
    }

    @Test
    @DisplayName("Au-delà de 40 m en exploration, un guide N4 ne suffit pas")
    void explorationAuDelaDe40() {
        List<Candidat> c = List.of(encadrant("GP", "N4"), plongeur("A", "PE60"));

        Proposition r = ProposeurPalanquees.proposer(c,
                new Criteres(50, TypePlongee.EXPLORATION, 4, false, false, List.of(), List.of()));

        assertThat(r.palanquees()).isEmpty();
        assertThat(r.nonPlaces()).singleElement().satisfies(n -> assertThat(n.raison()).contains("E4"));
    }
}
