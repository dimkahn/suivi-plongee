package fr.club.plongee.planning;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.domain.AdhesionSaison;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.repository.AdhesionSaisonRepository;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.repository.EspaceBassinRepository;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.planning.service.GroupeEntrainementService;
import fr.club.plongee.planning.service.GroupeEntrainementService.DemandeGroupe;
import fr.club.plongee.planning.service.GroupeEntrainementService.EleveSaisonVue;
import fr.club.plongee.referentiel.domain.Niveau;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** Composition des groupes d'entraînement et rangement des élèves d'une saison. */
@ExtendWith(MockitoExtension.class)
class GroupeEntrainementServiceTest {

    @Mock GroupeEntrainementRepository groupes;
    @Mock EspaceBassinRepository espaces;
    @Mock SaisonRepository saisons;
    @Mock UtilisateurRepository utilisateurs;
    @Mock EleveRepository eleves;
    @Mock CursusRepository cursus;
    @Mock AdhesionSaisonRepository adhesions;

    GroupeEntrainementService service;
    Saison saison;
    GroupeEntrainement debutants;
    GroupeEntrainement prepaN2;
    Eleve anis;

    @BeforeEach
    void avantChaqueTest() {
        service = new GroupeEntrainementService(groupes, espaces, saisons, utilisateurs, eleves, cursus, adhesions);
        saison = new Saison();
        saison.setId(9L);
        saison.setLibelle("2026-2027");
        saison.setDateDebut(LocalDate.of(2026, 9, 1));
        debutants = groupe(1L, "Débutants", 1, "N1");
        prepaN2 = groupe(2L, "Prépa N2", 2, "N2");
        anis = eleve(7L, "Dulac", "Anis");
        lenient().when(saisons.findById(9L)).thenReturn(Optional.of(saison));
        lenient().when(groupes.parSaison(9L)).thenReturn(List.of(debutants, prepaN2));
    }

    @Test
    @DisplayName("Le groupe suggéré est celui qui prépare le niveau du cursus en cours")
    void suggestionDApresLeCursusEnCours() {
        when(cursus.parSaison(9L)).thenReturn(List.of(cursus(anis, Niveau.N2, Cursus.Statut.EN_COURS)));
        when(adhesions.parSaison(9L)).thenReturn(List.of());

        EleveSaisonVue v = service.elevesDeLaSaison(9L).getFirst();

        assertThat(v.niveauxEnCours()).containsExactly("N2");
        assertThat(v.groupeId()).isNull();
        assertThat(v.groupeSuggereId()).isEqualTo(2L);
        assertThat(v.adhesionSeule()).isFalse();
    }

    @Test
    @DisplayName("Un adhérent sans formation apparaît, sans suggestion")
    void adherentSansFormation() {
        AdhesionSaison a = new AdhesionSaison();
        a.setEleve(anis);
        a.setSaison(saison);
        when(cursus.parSaison(9L)).thenReturn(List.of());
        when(adhesions.parSaison(9L)).thenReturn(List.of(a));

        EleveSaisonVue v = service.elevesDeLaSaison(9L).getFirst();

        assertThat(v.adhesionSeule()).isTrue();
        assertThat(v.groupeSuggereId()).isNull();
    }

    @Test
    @DisplayName("Ranger un élève le retire de son ancien groupe de la saison")
    void rangerDeplaceLEleve() {
        debutants.getEleves().add(anis);
        when(eleves.findById(7L)).thenReturn(Optional.of(anis));
        when(cursus.existsByEleveIdAndSaisonId(7L, 9L)).thenReturn(true);
        when(cursus.parSaison(9L)).thenReturn(List.of(cursus(anis, Niveau.N2, Cursus.Statut.EN_COURS)));
        when(adhesions.parSaison(9L)).thenReturn(List.of());

        EleveSaisonVue v = service.ranger(9L, 7L, 2L);

        assertThat(debutants.getEleves()).isEmpty();
        assertThat(prepaN2.getEleves()).containsExactly(anis);
        assertThat(v.groupeId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("Un élève sans cursus ni adhésion sur la saison ne peut pas être rangé")
    void rangerRefuseUnEleveHorsSaison() {
        when(eleves.findById(7L)).thenReturn(Optional.of(anis));
        when(cursus.existsByEleveIdAndSaisonId(7L, 9L)).thenReturn(false);
        when(adhesions.existsByEleveIdAndSaisonId(7L, 9L)).thenReturn(false);

        assertThatThrownBy(() -> service.ranger(9L, 7L, 1L))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("inscrivez-le d'abord");
        assertThat(debutants.getEleves()).isEmpty();
    }

    @Test
    @DisplayName("Appliquer les suggestions ne touche pas aux élèves déjà rangés")
    void appliquerSuggestionsLaisseLesElevesDejaRanges() {
        Eleve sonia = eleve(8L, "Perrot", "Sonia");
        debutants.getEleves().add(sonia);
        when(cursus.parSaison(9L)).thenReturn(List.of(
                cursus(anis, Niveau.N2, Cursus.Statut.EN_COURS),
                cursus(sonia, Niveau.N2, Cursus.Statut.EN_COURS)));
        when(adhesions.parSaison(9L)).thenReturn(List.of());
        when(eleves.getReferenceById(7L)).thenReturn(anis);

        service.appliquerSuggestions(9L);

        assertThat(prepaN2.getEleves()).containsExactly(anis);
        assertThat(debutants.getEleves()).containsExactly(sonia);
    }

    @Test
    @DisplayName("Un encadrant inactif ne peut pas être attitré à un groupe")
    void encadrantInactifRefuse() {
        Utilisateur u = new Utilisateur();
        u.setId(3L);
        u.setNom("Vasseur");
        u.setPrenom("Flora");
        u.setNiveauEncadrement(NiveauEncadrement.E2);
        u.setRoles(EnumSet.of(RoleNom.MONITEUR));
        u.setActif(false);
        when(utilisateurs.findById(3L)).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> service.creer(new DemandeGroupe(9L, "N2+", null, null, List.of(3L))))
                .isInstanceOf(RegleMetierException.class)
                .hasMessageContaining("pas un encadrant actif");
    }

    @Test
    @DisplayName("Le nouvel ordre doit reprendre exactement les groupes de la saison")
    void ordonner() {
        service.ordonner(9L, List.of(2L, 1L));
        assertThat(prepaN2.getOrdre()).isEqualTo(1);
        assertThat(debutants.getOrdre()).isEqualTo(2);

        assertThatThrownBy(() -> service.ordonner(9L, List.of(2L)))
                .isInstanceOf(RegleMetierException.class);
    }

    private GroupeEntrainement groupe(Long id, String nom, int ordre, String niveau) {
        GroupeEntrainement g = new GroupeEntrainement();
        g.setId(id);
        g.setSaison(saison);
        g.setNom(nom);
        g.setOrdre(ordre);
        g.setNiveauPrepare(niveau);
        return g;
    }

    private static Eleve eleve(Long id, String nom, String prenom) {
        Eleve e = new Eleve();
        e.setId(id);
        e.setNom(nom);
        e.setPrenom(prenom);
        return e;
    }

    private Cursus cursus(Eleve e, Niveau niveau, Cursus.Statut statut) {
        Referentiel r = new Referentiel();
        r.setNiveau(niveau);
        Cursus c = new Cursus();
        c.setEleve(e);
        c.setSaison(saison);
        c.setReferentiel(r);
        c.setStatut(statut);
        return c;
    }
}
