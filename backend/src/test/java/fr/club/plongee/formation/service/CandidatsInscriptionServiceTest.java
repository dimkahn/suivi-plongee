package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.AdhesionSaison;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.service.CandidatsInscriptionService.CandidatVue;
import fr.club.plongee.referentiel.domain.Niveau;
import fr.club.plongee.referentiel.domain.Referentiel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Niveau actuel, ancienneté et niveau proposé d'un élève à l'inscription. */
class CandidatsInscriptionServiceTest {

    private final Saison s2024 = saison(1L, "2024-2025", 2024);
    private final Saison s2025 = saison(2L, "2025-2026", 2025);
    private final Saison s2026 = saison(3L, "2026-2027", 2026);

    @Test
    @DisplayName("Sans cursus ni niveau déclaré : première saison, N1 proposé")
    void debutant() {
        CandidatVue v = CandidatsInscriptionService.candidat(eleve(null), s2026, List.of(), List.of());

        assertThat(v.niveauActuel()).isNull();
        assertThat(v.saisonsPrecedentes()).isZero();
        assertThat(v.derniereSaison()).isNull();
        assertThat(v.niveauPropose()).isEqualTo("N1");
    }

    @Test
    @DisplayName("N1 délivré la saison précédente : niveau actuel N1, N2 proposé")
    void n1Delivre() {
        Eleve e = eleve(null);
        CandidatVue v = CandidatsInscriptionService.candidat(e, s2026,
                List.of(cursus(e, s2025, Niveau.N1, Cursus.Statut.DELIVRE)), List.of());

        assertThat(v.niveauActuel()).isEqualTo("N1");
        assertThat(v.niveauDeclare()).isFalse();
        assertThat(v.saisonsPrecedentes()).isEqualTo(1);
        assertThat(v.derniereSaison()).isEqualTo("2025-2026");
        assertThat(v.niveauPropose()).isEqualTo("N2");
    }

    @Test
    @DisplayName("N2 resté en cours l'an dernier : on propose de le poursuivre, pas le N3")
    void poursuiteDUneFormationNonTerminee() {
        Eleve e = eleve(null);
        CandidatVue v = CandidatsInscriptionService.candidat(e, s2026, List.of(
                cursus(e, s2024, Niveau.N1, Cursus.Statut.DELIVRE),
                cursus(e, s2025, Niveau.N2, Cursus.Statut.EN_COURS)), List.of());

        assertThat(v.niveauActuel()).isEqualTo("N1");
        assertThat(v.saisonsPrecedentes()).isEqualTo(2);
        assertThat(v.niveauPropose()).isEqualTo("N2");
        assertThat(v.motifProposition()).contains("Poursuite");
    }

    @Test
    @DisplayName("Débutant dont le N1 est resté en cours : poursuite du N1")
    void debutantAvecN1EnCours() {
        Eleve e = eleve(null);
        CandidatVue v = CandidatsInscriptionService.candidat(e, s2026,
                List.of(cursus(e, s2025, Niveau.N1, Cursus.Statut.SUSPENDU)), List.of());

        assertThat(v.niveauActuel()).isNull();
        assertThat(v.niveauPropose()).isEqualTo("N1");
        assertThat(v.motifProposition()).contains("Poursuite");
    }

    @Test
    @DisplayName("Déjà inscrit sur la saison choisie : pas de proposition")
    void dejaInscritCetteSaison() {
        Eleve e = eleve(null);
        CandidatVue v = CandidatsInscriptionService.candidat(e, s2026,
                List.of(cursus(e, s2026, Niveau.N2, Cursus.Statut.EN_COURS)), List.of());

        assertThat(v.inscriptionsSaison()).containsExactly("N2");
        assertThat(v.niveauPropose()).isNull();
    }

    @Test
    @DisplayName("Niveau déclaré sur la fiche : repris comme niveau actuel, marqué déclaratif")
    void niveauDeclare() {
        CandidatVue v = CandidatsInscriptionService.candidat(eleve("N2"), s2026, List.of(), List.of());

        assertThat(v.niveauActuel()).isEqualTo("N2");
        assertThat(v.niveauDeclare()).isTrue();
        assertThat(v.niveauPropose()).isEqualTo("N3");
    }

    @Test
    @DisplayName("Niveau déclaré hors N1-N3 : pas de proposition")
    void niveauDeclareInconnu() {
        CandidatVue v = CandidatsInscriptionService.candidat(eleve("CMAS 2*"), s2026, List.of(), List.of());

        assertThat(v.niveauActuel()).isEqualTo("CMAS 2*");
        assertThat(v.niveauPropose()).isNull();
    }

    @Test
    @DisplayName("Une adhésion seule compte comme saison au club ; les inscriptions de la saison choisie sont signalées")
    void adhesionEtInscriptionDeLaSaison() {
        Eleve e = eleve("N3");
        AdhesionSaison a = new AdhesionSaison();
        a.setEleve(e);
        a.setSaison(s2025);
        CandidatVue v = CandidatsInscriptionService.candidat(e, s2026,
                List.of(cursus(e, s2026, Niveau.N3, Cursus.Statut.EN_COURS)), List.of(a));

        assertThat(v.saisonsPrecedentes()).isEqualTo(1);
        assertThat(v.inscriptionsSaison()).containsExactly("N3");
        assertThat(v.niveauPropose()).isNull();
    }

    private static Saison saison(Long id, String libelle, int annee) {
        Saison s = new Saison();
        s.setId(id);
        s.setLibelle(libelle);
        s.setDateDebut(LocalDate.of(annee, 9, 1));
        s.setDateFin(LocalDate.of(annee + 1, 6, 30));
        return s;
    }

    private static Eleve eleve(String dernierNiveau) {
        Eleve e = new Eleve();
        e.setId(7L);
        e.setNom("Plongeur");
        e.setPrenom("Un");
        e.setDernierNiveau(dernierNiveau);
        return e;
    }

    private static Cursus cursus(Eleve e, Saison s, Niveau niveau, Cursus.Statut statut) {
        Referentiel r = new Referentiel();
        r.setNiveau(niveau);
        Cursus c = new Cursus();
        c.setEleve(e);
        c.setSaison(s);
        c.setReferentiel(r);
        c.setStatut(statut);
        return c;
    }
}
