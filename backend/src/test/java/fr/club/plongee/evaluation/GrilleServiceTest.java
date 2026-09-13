package fr.club.plongee.evaluation;

import fr.club.plongee.formation.*;
import fr.club.plongee.referentiel.BlocCompetence;
import fr.club.plongee.referentiel.Critere;
import fr.club.plongee.referentiel.Niveau;
import fr.club.plongee.referentiel.Referentiel;
import fr.club.plongee.securite.NiveauEncadrement;
import fr.club.plongee.securite.Utilisateur;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** Tests unitaires de l'assemblage de la grille de suivi d'un eleve. */
@ExtendWith(MockitoExtension.class)
class GrilleServiceTest {

    @Mock CursusRepository cursusRepository;
    @Mock EvaluationService evaluationService;
    @Mock ValidationCompetenceRepository validations;
    @Mock ParticipationRepository participations;
    @Mock SeanceRepository seances;

    GrilleService service;

    @BeforeEach
    void avantChaqueTest() {
        service = new GrilleService(cursusRepository, evaluationService, validations, participations, seances);
    }

    @Test
    @DisplayName("La grille assemble le referentiel, l'etat courant des criteres et les blocs valides")
    void grille_assembleReferentielEtatEtValidations() {
        Referentiel ref = new Referentiel();
        ref.setId(1L);
        ref.setNiveau(Niveau.N2);
        ref.setVersionMft("2024");
        ref.setMilieuNaturelExclusif(true);
        ref.setNiveauEncadrantValidation(NiveauEncadrement.E2);
        ref.setPrerogativeProfondeur(20);

        Critere c1 = new Critere();
        c1.setId(11L);
        c1.setOrdre(1);
        c1.setSavoirFaire("Vider son masque");

        Critere c2 = new Critere();
        c2.setId(12L);
        c2.setOrdre(2);
        c2.setSavoirFaire("Remonter un equipier");

        BlocCompetence bloc = new BlocCompetence();
        bloc.setId(1L);
        bloc.setCode("C1");
        bloc.setIntitule("Competence 1");
        bloc.setCriteres(List.of(c1, c2));
        ref.setBlocs(List.of(bloc));

        Eleve eleve = new Eleve();
        eleve.setNom("Plongeur");
        eleve.setPrenom("Un");

        Saison saison = new Saison();
        saison.setLibelle("2025-2026");

        Cursus cursus = new Cursus();
        cursus.setId(100L);
        cursus.setEleve(eleve);
        cursus.setReferentiel(ref);
        cursus.setSaison(saison);
        cursus.setStatut(Cursus.Statut.EN_COURS);

        Utilisateur moniteur = new Utilisateur();
        moniteur.setNom("Moniteur");
        moniteur.setPrenom("E2");

        Evaluation evalAcquis = new Evaluation();
        evalAcquis.setCritere(c1);
        evalAcquis.setStatut(StatutAcquisition.ACQUIS);
        evalAcquis.setMoniteur(moniteur);

        ValidationCompetence validation = new ValidationCompetence();
        validation.setBloc(bloc);
        validation.setMoniteur(moniteur);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(cursus));
        when(evaluationService.etatCourant(100L)).thenReturn(Map.of(11L, evalAcquis));
        when(validations.findByCursusId(100L)).thenReturn(List.of(validation));
        when(participations.compterAtelier(100L, Participation.Atelier.NAGE)).thenReturn(3L);
        when(participations.compterAtelier(100L, Participation.Atelier.BLOC)).thenReturn(2L);
        when(participations.compterAtelier(100L, Participation.Atelier.PLONGEE)).thenReturn(1L);

        GrilleService.GrilleVue vue = service.grille(100L);

        assertThat(vue.eleve()).isEqualTo("Un Plongeur");
        assertThat(vue.niveau()).isEqualTo("N2");
        assertThat(vue.milieuNaturelExclusif()).isTrue();
        assertThat(vue.seancesNage()).isEqualTo(3);
        assertThat(vue.seancesBloc()).isEqualTo(2);
        assertThat(vue.seancesPlongee()).isEqualTo(1);
        assertThat(vue.criteresTotal()).isEqualTo(2);
        assertThat(vue.criteresAcquis()).isEqualTo(1);

        assertThat(vue.blocs()).hasSize(1);
        GrilleService.BlocVue blocVue = vue.blocs().get(0);
        assertThat(blocVue.acquis()).isEqualTo(1);
        assertThat(blocVue.total()).isEqualTo(2);
        assertThat(blocVue.valide()).isTrue();
        assertThat(blocVue.valideePar()).isEqualTo("E2 Moniteur");

        assertThat(blocVue.criteres()).extracting(GrilleService.CritereVue::statut)
                .containsExactly(StatutAcquisition.ACQUIS.name(), StatutAcquisition.NON_ABORDE.name());
    }
}
