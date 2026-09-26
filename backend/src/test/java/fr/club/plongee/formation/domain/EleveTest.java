package fr.club.plongee.formation.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Dernier niveau connu d'un élève après la délivrance d'un brevet dans l'application. */
class EleveTest {

    @Test
    @DisplayName("Le brevet délivré devient le dernier niveau, qu'il soit vide ou inférieur")
    void enregistrerBrevet_remplaceUnNiveauInferieurOuAbsent() {
        Eleve e = new Eleve();
        e.enregistrerBrevet("N1");
        assertThat(e.getDernierNiveau()).isEqualTo("N1");
        e.enregistrerBrevet("N2");
        assertThat(e.getDernierNiveau()).isEqualTo("N2");
    }

    @Test
    @DisplayName("Un niveau déjà plus élevé sur la fiche est conservé")
    void enregistrerBrevet_neRetrogradePas() {
        Eleve e = new Eleve();
        e.setDernierNiveau("N3");
        e.enregistrerBrevet("N2");
        assertThat(e.getDernierNiveau()).isEqualTo("N3");
    }

    @Test
    @DisplayName("Un niveau déclaré hors de l'échelle N1-N5 est remplacé")
    void enregistrerBrevet_remplaceUnNiveauHorsEchelle() {
        Eleve e = new Eleve();
        e.setDernierNiveau("CMAS 2*");
        e.enregistrerBrevet("N2");
        assertThat(e.getDernierNiveau()).isEqualTo("N2");
    }
}
