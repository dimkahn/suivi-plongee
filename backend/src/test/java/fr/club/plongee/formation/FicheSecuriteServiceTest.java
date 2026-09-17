package fr.club.plongee.formation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.formation.service.*;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de l'assemblage et de la réconciliation des palanquées.
 * L'entité {@link FicheSecurite} porte des relations chargées à la demande
 * (dp, seance, palanquees, membres) : ce service est le seul endroit où on a
 * le droit de les parcourir, d'où l'assemblage des *Vue ici plutôt que dans
 * le contrôleur (voir FicheSecuriteControllerTest côté intégration, qui
 * vérifie que ça ne casse plus hors transaction).
 */
@ExtendWith(MockitoExtension.class)
class FicheSecuriteServiceTest {

    @Mock FicheSecuriteRepository fiches;
    @Mock SeanceRepository seances;
    @Mock UtilisateurRepository utilisateurs;
    @Mock EleveRepository eleves;
    @Mock FicheSecuritePdfService pdfService;

    FicheSecuriteService service;

    @BeforeEach
    void avantChaqueTest() {
        service = new FicheSecuriteService(fiches, seances, utilisateurs, eleves, pdfService);
    }

    private Utilisateur moniteur(long id, String prenom, String nom) {
        Utilisateur u = new Utilisateur();
        u.setId(id);
        u.setPrenom(prenom);
        u.setNom(nom);
        u.setNiveauEncadrement(NiveauEncadrement.E2);
        u.setRoles(EnumSet.of(RoleNom.MONITEUR));
        return u;
    }

    private Seance seance(long id) {
        Seance s = new Seance();
        s.setId(id);
        s.setDateSeance(LocalDate.of(2026, 6, 1));
        s.setMilieu(Milieu.NATUREL);
        s.setLieu("Carriere de Blaisy");
        s.setProfondeurMax(20);
        return s;
    }

    private FicheSecuriteService.Plongeur plongeur(String prenom, String nom) {
        return new FicheSecuriteService.Plongeur(null, null, nom, prenom, "N2", null,
                FonctionPalanquee.PLONGEUR, "Air", "Table MN90", null);
    }

    private Eleve eleve(long id, String prenom, String nom) {
        Eleve e = new Eleve();
        e.setId(id);
        e.setPrenom(prenom);
        e.setNom(nom);
        return e;
    }

    @Test
    @DisplayName("L'établissement crée la fiche, la palanquée et ses plongeurs quand rien n'existe")
    void enregistrer_creeNouvelleFiche_quandAucune() {
        Utilisateur dp = moniteur(10L, "Flora", "Vasseur");
        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(dp));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());
        when(fiches.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L,
                "Beau", "Calme", "10 m", "Nul", "Étale", "18°C", "2 surveillants", "VHF canal 16", null,
                List.of(new FicheSecuriteService.GroupePlongeurs(1, 20, 40,
                        List.of(plongeur("Anis", "Dulac"), plongeur("Sonia", "Perrot")))));

        FicheSecuriteService.FicheSecuriteVue vue = service.enregistrer(1L, saisie);

        assertThat(vue.dp()).isEqualTo("Flora Vasseur");
        assertThat(vue.meteo()).isEqualTo("Beau");
        assertThat(vue.palanquees()).hasSize(1);
        FicheSecuriteService.PalanqueeVue palanquee = vue.palanquees().get(0);
        assertThat(palanquee.numero()).isEqualTo(1);
        assertThat(palanquee.profondeurPrevue()).isEqualTo(20);
        assertThat(palanquee.dureePrevue()).isEqualTo(40);
        assertThat(palanquee.membres()).extracting(FicheSecuriteService.PlongeurVue::prenom)
                .containsExactly("Anis", "Sonia");
        assertThat(palanquee.membres().get(0).fonction()).isEqualTo("PLONGEUR");
    }

    @Test
    @DisplayName("Une fonction absente est traitée comme PLONGEUR par défaut")
    void enregistrer_fonctionParDefaut() {
        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur(10L, "Flora", "Vasseur")));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());
        when(fiches.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FicheSecuriteService.Plongeur sansFonction = new FicheSecuriteService.Plongeur(
                null, null, "Dulac", "Anis", null, null, null, null, null, null);
        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L, null, null, null,
                null, null, null, null, null, null,
                List.of(new FicheSecuriteService.GroupePlongeurs(1, null, null, List.of(sansFonction))));

        FicheSecuriteService.FicheSecuriteVue vue = service.enregistrer(1L, saisie);

        assertThat(vue.palanquees().get(0).membres().get(0).fonction()).isEqualTo("PLONGEUR");
    }

    @Test
    @DisplayName("Un plongeur lié à un élève du club porte l'id de cet élève dans la vue")
    void enregistrer_lieAUnEleveDuClub() {
        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur(10L, "Flora", "Vasseur")));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());
        when(fiches.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(eleves.findById(7L)).thenReturn(Optional.of(eleve(7L, "Anis", "Dulac")));

        FicheSecuriteService.Plongeur lie = new FicheSecuriteService.Plongeur(7L, null,
                "Dulac", "Anis", "N1", "N2", FonctionPalanquee.PLONGEUR, "Air", null, null);
        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L, null, null, null,
                null, null, null, null, null, null,
                List.of(new FicheSecuriteService.GroupePlongeurs(1, null, null, List.of(lie))));

        FicheSecuriteService.FicheSecuriteVue vue = service.enregistrer(1L, saisie);

        FicheSecuriteService.PlongeurVue membre = vue.palanquees().get(0).membres().get(0);
        assertThat(membre.eleveId()).isEqualTo(7L);
        assertThat(membre.utilisateurId()).isNull();
        assertThat(membre.aptitude()).isEqualTo("N1");
        assertThat(membre.qualificationPreparee()).isEqualTo("N2");
    }

    @Test
    @DisplayName("Un plongeur lié à un élève introuvable est refusé")
    void enregistrer_eleveLieIntrouvable() {
        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur(10L, "Flora", "Vasseur")));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());
        when(eleves.findById(99L)).thenReturn(Optional.empty());

        FicheSecuriteService.Plongeur lie = new FicheSecuriteService.Plongeur(99L, null,
                "Inconnu", "Un", null, null, null, null, null, null);
        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L, null, null, null,
                null, null, null, null, null, null,
                List.of(new FicheSecuriteService.GroupePlongeurs(1, null, null, List.of(lie))));

        assertThatThrownBy(() -> service.enregistrer(1L, saisie))
                .isInstanceOf(RessourceIntrouvableException.class);
    }

    @Test
    @DisplayName("Un plongeur ne peut pas être à la fois lié à un élève et à un encadrant")
    void enregistrer_refuseLienDouble() {
        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur(10L, "Flora", "Vasseur")));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());

        FicheSecuriteService.Plongeur ambigu = new FicheSecuriteService.Plongeur(7L, 10L,
                "Dulac", "Anis", null, null, null, null, null, null);
        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L, null, null, null,
                null, null, null, null, null, null,
                List.of(new FicheSecuriteService.GroupePlongeurs(1, null, null, List.of(ambigu))));

        assertThatThrownBy(() -> service.enregistrer(1L, saisie))
                .isInstanceOf(RegleMetierException.class);
        verify(fiches, never()).save(any());
    }

    @Test
    @DisplayName("Le DP doit être un moniteur actif avec un niveau d'encadrement")
    void enregistrer_refuseDpNonMoniteur() {
        Utilisateur pasMoniteur = new Utilisateur();
        pasMoniteur.setId(20L);
        pasMoniteur.setRoles(EnumSet.of(RoleNom.ELEVE));

        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(20L)).thenReturn(Optional.of(pasMoniteur));

        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(20L, null, null, null,
                null, null, null, null, null, null, List.of());

        assertThatThrownBy(() -> service.enregistrer(1L, saisie))
                .isInstanceOf(RegleMetierException.class);
        verify(fiches, never()).save(any());
    }

    @Test
    @DisplayName("Séance introuvable : erreur avant toute écriture")
    void enregistrer_seanceIntrouvable() {
        when(seances.findById(1L)).thenReturn(Optional.empty());

        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L, null, null, null,
                null, null, null, null, null, null, List.of());

        assertThatThrownBy(() -> service.enregistrer(1L, saisie))
                .isInstanceOf(RessourceIntrouvableException.class);
        verifyNoInteractions(fiches);
    }

    @Test
    @DisplayName("Directeur de plongée introuvable")
    void enregistrer_dpIntrouvable() {
        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(99L)).thenReturn(Optional.empty());

        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(99L, null, null, null,
                null, null, null, null, null, null, List.of());

        assertThatThrownBy(() -> service.enregistrer(1L, saisie))
                .isInstanceOf(RessourceIntrouvableException.class);
    }

    @Test
    @DisplayName("Ré-établir la fiche préserve le profil déjà réalisé d'une palanquée inchangée")
    void enregistrer_reconciliePalanqueesParNumero_preserveProfilRealise() {
        FicheSecurite existante = new FicheSecurite();
        existante.setSeance(seance(1L));
        existante.setDp(moniteur(10L, "Flora", "Vasseur"));

        Palanquee p1 = new Palanquee();
        p1.setNumero(1);
        p1.setFicheSecurite(existante);
        p1.setProfondeurRealisee(18);
        p1.setDureeRealisee(35);
        p1.setHeureImmersion(LocalTime.of(9, 30));
        existante.getPalanquees().add(p1);

        Palanquee p2 = new Palanquee();
        p2.setNumero(2);
        p2.setFicheSecurite(existante);
        existante.getPalanquees().add(p2);

        when(seances.findById(1L)).thenReturn(Optional.of(seance(1L)));
        when(utilisateurs.findById(10L)).thenReturn(Optional.of(moniteur(10L, "Flora", "Vasseur")));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.of(existante));
        when(fiches.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // La palanquée 2 disparaît de la saisie, la 1 est retouchée (nouveau prévu).
        FicheSecuriteService.Saisie saisie = new FicheSecuriteService.Saisie(10L, null, null, null,
                null, null, null, null, null, null,
                List.of(new FicheSecuriteService.GroupePlongeurs(1, 25, 45,
                        List.of(plongeur("Anis", "Dulac")))));

        FicheSecuriteService.FicheSecuriteVue vue = service.enregistrer(1L, saisie);

        assertThat(vue.palanquees()).hasSize(1);
        FicheSecuriteService.PalanqueeVue palanquee = vue.palanquees().get(0);
        assertThat(palanquee.numero()).isEqualTo(1);
        assertThat(palanquee.profondeurPrevue()).isEqualTo(25);
        assertThat(palanquee.dureePrevue()).isEqualTo(45);
        // Le profil réalisé, saisi séparément, n'a pas été effacé par ce ré-établissement.
        assertThat(palanquee.profondeurRealisee()).isEqualTo(18);
        assertThat(palanquee.dureeRealisee()).isEqualTo(35);
        assertThat(palanquee.heureImmersion()).isEqualTo(LocalTime.of(9, 30));
    }

    @Test
    @DisplayName("Le complément réalisé met à jour uniquement le profil de la palanquée visée")
    void enregistrerRealise_metAJourProfilSeulement() {
        FicheSecurite existante = new FicheSecurite();
        existante.setSeance(seance(1L));
        existante.setDp(moniteur(10L, "Flora", "Vasseur"));

        Palanquee p1 = new Palanquee();
        p1.setNumero(1);
        p1.setFicheSecurite(existante);
        MembrePalanquee m = new MembrePalanquee();
        m.setPalanquee(p1);
        m.setNom("Dulac");
        m.setPrenom("Anis");
        m.setFonction(FonctionPalanquee.PLONGEUR);
        p1.getMembres().add(m);
        existante.getPalanquees().add(p1);

        when(fiches.findBySeanceId(1L)).thenReturn(Optional.of(existante));
        when(fiches.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FicheSecuriteService.ProfilRealise profil = new FicheSecuriteService.ProfilRealise(
                1, 19, 38, "3 min à 3 m", LocalTime.of(9, 15), LocalTime.of(9, 53));

        FicheSecuriteService.FicheSecuriteVue vue = service.enregistrerRealise(1L, List.of(profil));

        FicheSecuriteService.PalanqueeVue palanquee = vue.palanquees().get(0);
        assertThat(palanquee.profondeurRealisee()).isEqualTo(19);
        assertThat(palanquee.dureeRealisee()).isEqualTo(38);
        assertThat(palanquee.paliers()).isEqualTo("3 min à 3 m");
        assertThat(palanquee.heureImmersion()).isEqualTo(LocalTime.of(9, 15));
        assertThat(palanquee.heureSortie()).isEqualTo(LocalTime.of(9, 53));
        // La liste des plongeurs n'est pas repassée : elle reste celle de l'établissement.
        assertThat(palanquee.membres()).extracting(FicheSecuriteService.PlongeurVue::prenom)
                .containsExactly("Anis");
    }

    @Test
    @DisplayName("Le complément réalisé refuse un numéro de palanquée qui n'existe pas sur la fiche")
    void enregistrerRealise_erreurSiNumeroInconnu() {
        FicheSecurite existante = new FicheSecurite();
        existante.setSeance(seance(1L));
        existante.setDp(moniteur(10L, "Flora", "Vasseur"));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.of(existante));

        FicheSecuriteService.ProfilRealise profil = new FicheSecuriteService.ProfilRealise(
                9, null, null, null, null, null);

        assertThatThrownBy(() -> service.enregistrerRealise(1L, List.of(profil)))
                .isInstanceOf(RegleMetierException.class);
    }

    @Test
    @DisplayName("Le complément réalisé exige une fiche déjà établie")
    void enregistrerRealise_erreurSiFicheAbsente() {
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.enregistrerRealise(1L, List.of()))
                .isInstanceOf(RessourceIntrouvableException.class);
    }

    @Test
    @DisplayName("Consulter une séance sans fiche renvoie une vue vide plutôt qu'une erreur")
    void consulter_retourneVueVide_quandAucuneFiche() {
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());

        FicheSecuriteService.FicheSecuriteVue vue = service.consulter(1L);

        assertThat(vue.id()).isNull();
        assertThat(vue.dpId()).isNull();
        assertThat(vue.palanquees()).isEmpty();
    }

    @Test
    @DisplayName("Consulter trie les palanquées par numéro")
    void consulter_trieLesPalanqueesParNumero() {
        FicheSecurite fiche = new FicheSecurite();
        fiche.setId(5L);
        fiche.setSeance(seance(1L));
        fiche.setDp(moniteur(10L, "Flora", "Vasseur"));

        Palanquee deux = new Palanquee();
        deux.setNumero(2);
        deux.setFicheSecurite(fiche);
        Palanquee un = new Palanquee();
        un.setNumero(1);
        un.setFicheSecurite(fiche);
        fiche.getPalanquees().add(deux);
        fiche.getPalanquees().add(un);

        when(fiches.findBySeanceId(1L)).thenReturn(Optional.of(fiche));

        FicheSecuriteService.FicheSecuriteVue vue = service.consulter(1L);

        assertThat(vue.palanquees()).extracting(FicheSecuriteService.PalanqueeVue::numero)
                .containsExactly(1, 2);
    }

    @Test
    @DisplayName("Générer le PDF sans fiche établie est refusé")
    void genererPdf_erreurSiAbsente() {
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.genererPdf(1L))
                .isInstanceOf(RessourceIntrouvableException.class);
        verifyNoInteractions(pdfService);
    }

    @Test
    @DisplayName("Générer le PDF délègue au service de rendu, dans la même transaction")
    void genererPdf_delegueAuServiceDeRendu() {
        FicheSecurite fiche = new FicheSecurite();
        fiche.setSeance(seance(1L));
        fiche.setDp(moniteur(10L, "Flora", "Vasseur"));
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.of(fiche));
        FicheSecuritePdfService.FichePdf attendu = new FicheSecuritePdfService.FichePdf(new byte[]{1}, "fiche.pdf");
        when(pdfService.generer(fiche)).thenReturn(attendu);

        FicheSecuritePdfService.FichePdf pdf = service.genererPdf(1L);

        assertThat(pdf).isEqualTo(attendu);
    }

    @Test
    @DisplayName("Supprimer une fiche absente est refusé")
    void supprimer_erreurSiAbsente() {
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.supprimer(1L))
                .isInstanceOf(RessourceIntrouvableException.class);
    }

    @Test
    @DisplayName("Supprimer une fiche existante la retire du dépôt")
    void supprimer_supprimeQuandExiste() {
        FicheSecurite fiche = new FicheSecurite();
        when(fiches.findBySeanceId(1L)).thenReturn(Optional.of(fiche));

        service.supprimer(1L);

        ArgumentCaptor<FicheSecurite> captor = ArgumentCaptor.forClass(FicheSecurite.class);
        verify(fiches).delete(captor.capture());
        assertThat(captor.getValue()).isSameAs(fiche);
    }
}
