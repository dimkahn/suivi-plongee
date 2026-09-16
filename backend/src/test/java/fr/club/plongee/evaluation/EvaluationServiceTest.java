package fr.club.plongee.evaluation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.*;
import fr.club.plongee.referentiel.BlocCompetence;
import fr.club.plongee.referentiel.Critere;
import fr.club.plongee.referentiel.CritereRepository;
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
 * Tests unitaires des regles du MFT portees par EvaluationService : coherence
 * du referentiel, contraintes de seance (milieu, profondeur, saison) et
 * conditions de validation d'un bloc de competences.
 */
@ExtendWith(MockitoExtension.class)
class EvaluationServiceTest {

    @Mock EvaluationRepository evaluations;
    @Mock ValidationCompetenceRepository validations;
    @Mock CursusRepository cursusRepository;
    @Mock SeanceRepository seances;
    @Mock CritereRepository criteres;
    @Mock UtilisateurRepository utilisateurs;
    @Mock HabilitationService habilitation;

    EvaluationService service;

    UtilisateurPrincipal moniteurPrincipal;
    Utilisateur moniteur;

    @BeforeEach
    void avantChaqueTest() {
        service = new EvaluationService(evaluations, validations, cursusRepository, seances,
                criteres, utilisateurs, habilitation);
        moniteurPrincipal = new UtilisateurPrincipal(10L, "e2@club.fr", "x", true,
                NiveauEncadrement.E2, List.of());
        moniteur = new Utilisateur();
        moniteur.setId(10L);
        moniteur.setNom("Moniteur");
        moniteur.setPrenom("Un");
    }

    // ---------------------------------------------------------------
    //  Fabriques de donnees
    // ---------------------------------------------------------------

    private static Referentiel referentiel(boolean milieuNaturelExclusif, int profondeurMaxFormation) {
        Referentiel r = new Referentiel();
        r.setId(1L);
        r.setNiveau(Niveau.N2);
        r.setMilieuNaturelExclusif(milieuNaturelExclusif);
        r.setProfondeurMaxFormation(profondeurMaxFormation);
        return r;
    }

    private static BlocCompetence bloc(Referentiel referentiel, boolean transverse, boolean validerEnDernier) {
        BlocCompetence b = new BlocCompetence();
        b.setId(1L);
        b.setIntitule("Bloc de test");
        b.setReferentiel(referentiel);
        b.setEvaluationTransverse(transverse);
        b.setValiderEnDernier(validerEnDernier);
        return b;
    }

    private static Critere critere(BlocCompetence bloc) {
        Critere c = new Critere();
        c.setId(5L);
        c.setBloc(bloc);
        return c;
    }

    private static Saison saison(Long id) {
        Saison s = new Saison();
        s.setId(id);
        s.setOuverte(true);
        return s;
    }

    private static Cursus cursus(Referentiel referentiel, Saison saison, Cursus.Statut statut) {
        Cursus c = new Cursus();
        c.setId(100L);
        c.setReferentiel(referentiel);
        c.setSaison(saison);
        c.setStatut(statut);
        return c;
    }

    private static Seance seance(Saison saison, Milieu milieu, Integer profondeurMax) {
        Seance s = new Seance();
        s.setId(7L);
        s.setSaison(saison);
        s.setMilieu(milieu);
        s.setProfondeurMax(profondeurMax);
        s.setDateSeance(LocalDate.of(2026, 6, 1));
        return s;
    }

    // ---------------------------------------------------------------
    //  noter()
    // ---------------------------------------------------------------

    @Test
    @DisplayName("Rejouer une saisie deja enregistree renvoie l'evaluation existante sans en creer une seconde")
    void noter_rejeuIdempotent() {
        Evaluation existante = new Evaluation();
        existante.setId(42L);
        when(evaluations.findByReferenceClient("ref-1")).thenReturn(Optional.of(existante));

        var notation = new EvaluationService.Notation(5L, 7L, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), "ref-1");
        Evaluation resultat = service.noter(100L, notation, moniteurPrincipal);

        assertThat(resultat).isSameAs(existante);
        verify(evaluations, never()).save(any());
        verifyNoInteractions(cursusRepository);
    }

    @Test
    @DisplayName("Un cursus qui n'est plus EN_COURS ne peut plus etre note")
    void noter_cursusNonModifiable() {
        Referentiel ref = referentiel(false, 40);
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.VALIDE);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));

        var notation = new EvaluationService.Notation(5L, 7L, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), null);

        assertThatThrownBy(() -> service.noter(100L, notation, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("n'est plus modifiable");
    }

    @Test
    @DisplayName("Un critere d'un autre referentiel que celui du cursus est refuse")
    void noter_critereHorsReferentiel() {
        Referentiel refCursus = referentiel(false, 40);
        Referentiel refAutre = referentiel(false, 40);
        refAutre.setId(2L);
        Cursus c = cursus(refCursus, saison(1L), Cursus.Statut.EN_COURS);
        Critere critere = critere(bloc(refAutre, true, false));

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(criteres.findById(5L)).thenReturn(Optional.of(critere));

        var notation = new EvaluationService.Notation(5L, null, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), null);

        assertThatThrownBy(() -> service.noter(100L, notation, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("n'appartient pas au referentiel");
    }

    @Test
    @DisplayName("Une seance est obligatoire pour une competence non transverse")
    void noter_seanceObligatoireSaufTransverse() {
        Referentiel ref = referentiel(false, 40);
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);
        Critere critere = critere(bloc(ref, false, false));

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(criteres.findById(5L)).thenReturn(Optional.of(critere));

        var notation = new EvaluationService.Notation(5L, null, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), null);

        assertThatThrownBy(() -> service.noter(100L, notation, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("Une seance doit etre indiquee");
    }

    @Test
    @DisplayName("Les competences N2/N3 exclusivement en milieu naturel refusent une seance en piscine")
    void noter_milieuNaturelExclusifRefuseArtificiel() {
        Referentiel ref = referentiel(true, 40);
        Saison s = saison(1L);
        Cursus c = cursus(ref, s, Cursus.Statut.EN_COURS);
        Critere critere = critere(bloc(ref, false, false));
        Seance seance = seance(s, Milieu.ARTIFICIEL, null);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(criteres.findById(5L)).thenReturn(Optional.of(critere));
        when(seances.findById(7L)).thenReturn(Optional.of(seance));

        var notation = new EvaluationService.Notation(5L, 7L, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), null);

        assertThatThrownBy(() -> service.noter(100L, notation, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("milieu naturel");
    }

    @Test
    @DisplayName("La profondeur de la seance ne peut pas depasser l'espace d'evolution du niveau en formation")
    void noter_profondeurMaxFormationDepassee() {
        Referentiel ref = referentiel(false, 20);
        Saison s = saison(1L);
        Cursus c = cursus(ref, s, Cursus.Statut.EN_COURS);
        Critere critere = critere(bloc(ref, false, false));
        Seance seance = seance(s, Milieu.NATUREL, 25);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(criteres.findById(5L)).thenReturn(Optional.of(critere));
        when(seances.findById(7L)).thenReturn(Optional.of(seance));

        var notation = new EvaluationService.Notation(5L, 7L, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), null);

        assertThatThrownBy(() -> service.noter(100L, notation, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("20 m");
    }

    @Test
    @DisplayName("Une seance d'une autre saison que celle du cursus est refusee")
    void noter_seanceHorsSaisonDuCursus() {
        Referentiel ref = referentiel(false, 40);
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);
        Critere critere = critere(bloc(ref, false, false));
        Seance seance = seance(saison(2L), Milieu.NATUREL, null);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(criteres.findById(5L)).thenReturn(Optional.of(critere));
        when(seances.findById(7L)).thenReturn(Optional.of(seance));

        var notation = new EvaluationService.Notation(5L, 7L, StatutAcquisition.ACQUIS, null,
                LocalDate.now(), null);

        assertThatThrownBy(() -> service.noter(100L, notation, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("n'appartient pas a la saison");
    }

    @Test
    @DisplayName("Une saisie valide est enregistree avec l'auteur issu du principal, jamais du corps de la requete")
    void noter_casNominal() {
        Referentiel ref = referentiel(false, 40);
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);
        Critere critere = critere(bloc(ref, true, false));

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(criteres.findById(5L)).thenReturn(Optional.of(critere));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur));
        when(evaluations.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LocalDate dateSaisie = LocalDate.of(2026, 3, 10);
        var notation = new EvaluationService.Notation(5L, null, StatutAcquisition.ACQUIS,
                "RAS", dateSaisie, null);

        Evaluation resultat = service.noter(100L, notation, moniteurPrincipal);

        assertThat(resultat.getMoniteur()).isSameAs(moniteur);
        assertThat(resultat.getStatut()).isEqualTo(StatutAcquisition.ACQUIS);
        assertThat(resultat.getDateEvaluation()).isEqualTo(dateSaisie);
        assertThat(resultat.getCommentaire()).isEqualTo("RAS");
        verify(evaluations).save(resultat);
    }

    // ---------------------------------------------------------------
    //  validerBloc()
    // ---------------------------------------------------------------

    @Test
    @DisplayName("Un bloc qui n'appartient pas au referentiel du cursus est introuvable")
    void validerBloc_blocHorsReferentiel() {
        Referentiel ref = referentiel(false, 40);
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);
        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.validerBloc(100L, 999L, null, moniteurPrincipal))
                .isInstanceOf(fr.club.plongee.commun.RessourceIntrouvableException.class);
    }

    @Test
    @DisplayName("La validation d'un bloc est refusee sans le niveau d'encadrement requis")
    void validerBloc_habilitationInsuffisante() {
        Referentiel ref = referentiel(false, 40);
        BlocCompetence b = bloc(ref, false, false);
        ref.setBlocs(List.of(b));
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(habilitation.peutValiderBloc(moniteurPrincipal, b)).thenReturn(false);

        assertThatThrownBy(() -> service.validerBloc(100L, 1L, null, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("reservee aux encadrants");
    }

    @Test
    @DisplayName("Un bloc deja valide ne peut pas etre revalide")
    void validerBloc_dejaValide() {
        Referentiel ref = referentiel(false, 40);
        BlocCompetence b = bloc(ref, false, false);
        ref.setBlocs(List.of(b));
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(habilitation.peutValiderBloc(moniteurPrincipal, b)).thenReturn(true);
        when(validations.existsByCursusIdAndBlocId(100L, 1L)).thenReturn(true);

        assertThatThrownBy(() -> service.validerBloc(100L, 1L, null, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("deja validee");
    }

    @Test
    @DisplayName("Un bloc dont tous les criteres ne sont pas acquis ne peut pas etre valide")
    void validerBloc_criteresNonTousAcquis() {
        Referentiel ref = referentiel(false, 40);
        BlocCompetence b = bloc(ref, false, false);
        ref.setBlocs(List.of(b));
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(habilitation.peutValiderBloc(moniteurPrincipal, b)).thenReturn(true);
        when(validations.existsByCursusIdAndBlocId(100L, 1L)).thenReturn(false);
        when(criteres.compterParBloc(1L)).thenReturn(5L);
        when(evaluations.compterAcquisDuBloc(100L, 1L)).thenReturn(3L);

        assertThatThrownBy(() -> service.validerBloc(100L, 1L, null, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("2 critere(s)");
    }

    @Test
    @DisplayName("C6 du N2 ne peut etre validee qu'apres tous les autres blocs")
    void validerBloc_validerEnDernierAvantLesAutres() {
        Referentiel ref = referentiel(false, 40);
        BlocCompetence c6 = bloc(ref, false, true);
        c6.setId(6L);
        BlocCompetence autre = bloc(ref, false, false);
        autre.setId(1L);
        ref.setBlocs(List.of(c6, autre));
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(habilitation.peutValiderBloc(moniteurPrincipal, c6)).thenReturn(true);
        when(validations.existsByCursusIdAndBlocId(100L, 6L)).thenReturn(false);
        when(criteres.compterParBloc(6L)).thenReturn(3L);
        when(evaluations.compterAcquisDuBloc(100L, 6L)).thenReturn(3L);
        when(validations.findByCursusId(100L)).thenReturn(List.of()); // "autre" pas encore validee

        assertThatThrownBy(() -> service.validerBloc(100L, 6L, null, moniteurPrincipal))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("fin de formation");
    }

    @Test
    @DisplayName("Un bloc entierement acquis et habilite est valide")
    void validerBloc_casNominal() {
        Referentiel ref = referentiel(false, 40);
        BlocCompetence b = bloc(ref, false, false);
        ref.setBlocs(List.of(b));
        Cursus c = cursus(ref, saison(1L), Cursus.Statut.EN_COURS);

        when(cursusRepository.chargerComplet(100L)).thenReturn(Optional.of(c));
        when(habilitation.peutValiderBloc(moniteurPrincipal, b)).thenReturn(true);
        when(validations.existsByCursusIdAndBlocId(100L, 1L)).thenReturn(false);
        when(criteres.compterParBloc(1L)).thenReturn(3L);
        when(evaluations.compterAcquisDuBloc(100L, 1L)).thenReturn(3L);
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur));
        when(validations.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ValidationCompetence resultat = service.validerBloc(100L, 1L, "Bien joue", moniteurPrincipal);

        assertThat(resultat.getMoniteur()).isSameAs(moniteur);
        assertThat(resultat.getCommentaire()).isEqualTo("Bien joue");
        assertThat(resultat.getCursus()).isSameAs(c);
        verify(validations).save(resultat);
    }
}
