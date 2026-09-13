package fr.club.plongee.delivrance;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.evaluation.ValidationCompetence;
import fr.club.plongee.evaluation.ValidationCompetenceRepository;
import fr.club.plongee.formation.*;
import fr.club.plongee.referentiel.BlocCompetence;
import fr.club.plongee.referentiel.Niveau;
import fr.club.plongee.referentiel.Referentiel;
import fr.club.plongee.securite.NiveauEncadrement;
import fr.club.plongee.securite.Utilisateur;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.UtilisateurRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires des controles prealables a la delivrance d'un brevet.
 * Toutes les valeurs comparees viennent du referentiel, jamais d'une
 * constante du code : ces tests verifient le comportement pour un jeu de
 * valeurs donne, pas la valeur elle-meme.
 */
@ExtendWith(MockitoExtension.class)
class RegleDelivranceServiceTest {

    @Mock CursusRepository cursusRepository;
    @Mock QualificationRepository qualifications;
    @Mock ValidationCompetenceRepository validations;
    @Mock ParticipationRepository participations;
    @Mock DelivranceRepository delivrances;
    @Mock UtilisateurRepository utilisateurs;

    RegleDelivranceService service;

    @BeforeEach
    void avantChaqueTest() {
        service = new RegleDelivranceService(cursusRepository, qualifications, validations,
                participations, delivrances, utilisateurs);
    }

    private static Eleve eleveMajeur() {
        Eleve e = new Eleve();
        e.setId(1L);
        e.setNom("Plongeur");
        e.setPrenom("Un");
        e.setDateNaissance(LocalDate.now().minusYears(30));
        e.setCertificatValideJusquAu(LocalDate.now().plusMonths(6));
        e.setAutorisationLegale(true);
        return e;
    }

    private static Referentiel referentielN1() {
        Referentiel r = new Referentiel();
        r.setId(1L);
        r.setNiveau(Niveau.N1);
        r.setAgeMinimum(14);
        r.setNiveauEncadrantDelivrance(NiveauEncadrement.E3);
        r.setBlocs(List.of());
        return r;
    }

    private static Cursus cursusPour(Eleve eleve, Referentiel referentiel) {
        Cursus c = new Cursus();
        c.setId(100L);
        c.setEleve(eleve);
        c.setReferentiel(referentiel);
        c.setStatut(Cursus.Statut.EN_COURS);
        return c;
    }

    // ---------------------------------------------------------------
    //  eligibilite()
    // ---------------------------------------------------------------

    @Test
    @DisplayName("Un eleve trop jeune n'est pas eligible")
    void eligibilite_ageInsuffisant() {
        Eleve e = eleveMajeur();
        e.setDateNaissance(LocalDate.now().minusYears(10));
        Referentiel ref = referentielN1();
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isFalse();
        assertThat(bilan.controles()).anySatisfy(ctrl ->
                assertThat(ctrl.code()).isEqualTo("AGE_MINIMUM"));
        assertThat(bilan.controles().stream()
                .filter(ctrl -> ctrl.code().equals("AGE_MINIMUM")).findFirst().orElseThrow().satisfait())
                .isFalse();
    }

    @Test
    @DisplayName("Un mineur sans autorisation legale recueillie n'est pas eligible")
    void eligibilite_mineurSansAutorisation() {
        Eleve e = eleveMajeur();
        e.setDateNaissance(LocalDate.now().minusYears(15));
        e.setAutorisationLegale(false);
        Referentiel ref = referentielN1();
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isFalse();
        assertThat(bilan.controles().stream()
                .anyMatch(ctrl -> ctrl.code().equals("AUTORISATION_LEGALE") && !ctrl.satisfait()))
                .isTrue();
    }

    @Test
    @DisplayName("Un certificat medical expire rend l'eleve inelligible")
    void eligibilite_certificatExpire() {
        Eleve e = eleveMajeur();
        e.setCertificatValideJusquAu(LocalDate.now().minusDays(1));
        Referentiel ref = referentielN1();
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isFalse();
        assertThat(bilan.controles().stream()
                .anyMatch(ctrl -> ctrl.code().equals("CERTIFICAT_MEDICAL") && !ctrl.satisfait()))
                .isTrue();
    }

    @Test
    @DisplayName("Un brevet prerequis non detenu rend l'eleve inelligible")
    void eligibilite_niveauPrerequisManquant() {
        Eleve e = eleveMajeur();
        Referentiel ref = referentielN1();
        ref.setNiveauPrerequis(Niveau.N1);
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(qualifications.findByEleveIdAndTypeIgnoreCase(1L, "N1")).thenReturn(Optional.empty());

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isFalse();
        assertThat(bilan.controles().stream()
                .anyMatch(ctrl -> ctrl.code().equals("NIVEAU_PREREQUIS") && !ctrl.satisfait()))
                .isTrue();
    }

    @Test
    @DisplayName("Le RIFAP expire du N3 rend l'eleve inelligible")
    void eligibilite_qualificationRequiseExpiree() {
        Eleve e = eleveMajeur();
        Referentiel ref = referentielN1();
        ref.setQualificationRequise("RIFAP");
        Qualification rifap = new Qualification();
        rifap.setDateObtention(LocalDate.now().minusYears(3));
        rifap.setExpireLe(LocalDate.now().minusDays(1));
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(qualifications.findByEleveIdAndTypeIgnoreCase(1L, "RIFAP")).thenReturn(Optional.of(rifap));

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isFalse();
        assertThat(bilan.controles().stream()
                .anyMatch(ctrl -> ctrl.code().equals("QUALIFICATION_REQUISE") && !ctrl.satisfait()))
                .isTrue();
    }

    @Test
    @DisplayName("Des competences non toutes validees rendent l'eleve inelligible")
    void eligibilite_competencesNonTouteValidees() {
        Eleve e = eleveMajeur();
        Referentiel ref = referentielN1();
        ref.setBlocs(List.of(new BlocCompetence(), new BlocCompetence()));
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(validations.findByCursusId(100L)).thenReturn(List.of(new ValidationCompetence()));

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isFalse();
        assertThat(bilan.controles().stream()
                .anyMatch(ctrl -> ctrl.code().equals("COMPETENCES") && !ctrl.satisfait()))
                .isTrue();
    }

    @Test
    @DisplayName("Toutes les conditions reunies rendent l'eleve eligible")
    void eligibilite_casNominal() {
        Eleve e = eleveMajeur();
        Referentiel ref = referentielN1();
        ref.setBlocs(List.of(new BlocCompetence()));
        Cursus c = cursusPour(e, ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(validations.findByCursusId(100L)).thenReturn(List.of(new ValidationCompetence()));

        var bilan = service.eligibilite(100L);

        assertThat(bilan.eligible()).isTrue();
        assertThat(bilan.controles()).allSatisfy(ctrl -> assertThat(ctrl.satisfait()).isTrue());
    }

    // ---------------------------------------------------------------
    //  delivrer()
    // ---------------------------------------------------------------

    private UtilisateurPrincipal principal(NiveauEncadrement niveau) {
        return new UtilisateurPrincipal(50L, "e3@club.fr", "x", true, niveau, List.of());
    }

    @Test
    @DisplayName("La delivrance est reservee au niveau d'encadrement exige par le referentiel")
    void delivrer_habilitationInsuffisante() {
        Cursus c = cursusPour(eleveMajeur(), referentielN1());
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.delivrer(100L, "BR-1", principal(NiveauEncadrement.E1)))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("reservee aux encadrants");
    }

    @Test
    @DisplayName("Un brevet deja delivre ne peut pas etre redelivre")
    void delivrer_dejaDelivre() {
        Cursus c = cursusPour(eleveMajeur(), referentielN1());
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(delivrances.findByCursusId(100L)).thenReturn(Optional.of(new Delivrance()));

        assertThatThrownBy(() -> service.delivrer(100L, "BR-1", principal(NiveauEncadrement.E3)))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("deja ete delivre");
    }

    @Test
    @DisplayName("Les conditions d'eligibilite doivent toutes etre remplies avant delivrance")
    void delivrer_conditionsNonRemplies() {
        Eleve mineurSansAutorisation = eleveMajeur();
        mineurSansAutorisation.setDateNaissance(LocalDate.now().minusYears(15));
        mineurSansAutorisation.setAutorisationLegale(false);
        Cursus c = cursusPour(mineurSansAutorisation, referentielN1());
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(delivrances.findByCursusId(100L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delivrer(100L, "BR-1", principal(NiveauEncadrement.E3)))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("Conditions non remplies");
    }

    @Test
    @DisplayName("Un N1 certifie sans avoir plonge en milieu naturel doit 4 plongees sous 12 mois")
    void delivrer_n1SansPlongeeMilieuNaturel_fixeEcheance() {
        Referentiel ref = referentielN1();
        Cursus c = cursusPour(eleveMajeur(), ref);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(delivrances.findByCursusId(100L)).thenReturn(Optional.empty());
        when(participations.findByCursusId(100L)).thenReturn(List.of());
        when(utilisateurs.findById(50L)).thenReturn(Optional.of(new Utilisateur()));
        when(delivrances.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Delivrance d = service.delivrer(100L, "BR-1", principal(NiveauEncadrement.E3));

        assertThat(d.getPlongeesMilieuNaturelAFaire()).isEqualTo(4);
        assertThat(d.getEcheancePlongees()).isEqualTo(LocalDate.now().plusMonths(12));
        assertThat(c.getStatut()).isEqualTo(Cursus.Statut.DELIVRE);
        verify(qualifications).save(argThat(q -> q.getType().equals("N1")));
    }

    @Test
    @DisplayName("Un N1 ayant deja plonge en milieu naturel ne doit aucune plongee complementaire")
    void delivrer_n1AvecPlongeeMilieuNaturel_pasEcheance() {
        Referentiel ref = referentielN1();
        Cursus c = cursusPour(eleveMajeur(), ref);

        Seance seanceNaturelle = new Seance();
        seanceNaturelle.setMilieu(Milieu.NATUREL);
        Participation presenteEnNaturel = new Participation();
        presenteEnNaturel.setStatut(Participation.Statut.PRESENT);
        presenteEnNaturel.setSeance(seanceNaturelle);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(delivrances.findByCursusId(100L)).thenReturn(Optional.empty());
        when(participations.findByCursusId(100L)).thenReturn(List.of(presenteEnNaturel));
        when(utilisateurs.findById(50L)).thenReturn(Optional.of(new Utilisateur()));
        when(delivrances.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Delivrance d = service.delivrer(100L, "BR-1", principal(NiveauEncadrement.E3));

        assertThat(d.getPlongeesMilieuNaturelAFaire()).isZero();
        assertThat(d.getEcheancePlongees()).isNull();
    }
}
