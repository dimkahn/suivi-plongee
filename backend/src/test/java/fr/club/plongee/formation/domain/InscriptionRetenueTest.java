package fr.club.plongee.formation.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Un élève inscrit deux fois dans la saison (brevet délivré en cours d'année,
 * puis niveau suivant) n'est montré qu'une fois dans les listes de personnes.
 */
class InscriptionRetenueTest {

    private static Eleve eleve(long id) {
        Eleve e = new Eleve();
        e.setId(id);
        return e;
    }

    private static Cursus cursus(long id, Eleve e, Cursus.Statut statut) {
        Cursus c = new Cursus();
        c.setId(id);
        c.setEleve(e);
        c.setStatut(statut);
        return c;
    }

    @Test
    @DisplayName("L'inscription en cours est retenue plutôt que le brevet délivré dans la saison")
    void enCoursPlutotQueDelivre() {
        Eleve e = eleve(1);
        Cursus n1 = cursus(10, e, Cursus.Statut.DELIVRE);
        Cursus n2 = cursus(11, e, Cursus.Statut.EN_COURS);
        assertThat(InscriptionRetenue.uneParEleve(List.of(n2, n1))).containsExactly(n2);
    }

    @Test
    @DisplayName("Sans inscription en cours, la plus récente est retenue ; un élève seul garde la sienne")
    void plusRecenteSinon() {
        Eleve a = eleve(1);
        Eleve b = eleve(2);
        Cursus ancien = cursus(10, a, Cursus.Statut.DELIVRE);
        Cursus recent = cursus(12, a, Cursus.Statut.VALIDE);
        Cursus seul = cursus(11, b, Cursus.Statut.ABANDON);
        assertThat(InscriptionRetenue.uneParEleve(List.of(ancien, seul, recent))).containsExactly(recent, seul);
    }

    @Test
    @DisplayName("Un abandon ne l'emporte pas sur un brevet délivré dans la saison")
    void abandonApresDelivre() {
        Eleve e = eleve(1);
        Cursus delivre = cursus(10, e, Cursus.Statut.DELIVRE);
        Cursus abandon = cursus(11, e, Cursus.Statut.ABANDON);
        assertThat(InscriptionRetenue.uneParEleve(List.of(delivre, abandon))).containsExactly(delivre);
    }
}
