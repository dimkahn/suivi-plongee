package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.service.PlongeurConnuService.PlongeurConnuVue;
import fr.club.plongee.referentiel.domain.Niveau;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** Niveau, niveau en préparation et niveau d'encadrement des plongeurs proposés dans les listes de choix. */
@ExtendWith(MockitoExtension.class)
class PlongeurConnuServiceTest {

    @Mock EleveRepository eleves;
    @Mock CursusRepository cursus;
    @Mock UtilisateurRepository utilisateurs;

    @Test
    @DisplayName("Un élève encadrant apparaît une seule fois ; un encadrant porte son niveau de plongeur (E1 mais N2)")
    void eleveEncadrant_uneSeuleLigneAvecLesTroisNiveaux() {
        Utilisateur compte = moniteur(5L, "Dulac", "Anis", NiveauEncadrement.E1);
        Eleve anis = new Eleve();
        anis.setId(1L);
        anis.setNom("Dulac");
        anis.setPrenom("Anis");
        anis.setUtilisateur(compte);
        Utilisateur tiago = moniteur(6L, "Nogueira", "Tiago", NiveauEncadrement.E1);
        tiago.setNiveauPlongeur("N2");

        when(eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc()).thenReturn(List.of(anis));
        when(cursus.parEleve(1L)).thenReturn(List.of(
                cursus(anis, Niveau.N3, Cursus.Statut.EN_COURS, 2026),
                cursus(anis, Niveau.N2, Cursus.Statut.DELIVRE, 2025)));
        when(utilisateurs.parRole(RoleNom.MONITEUR)).thenReturn(List.of(compte, tiago));

        List<PlongeurConnuVue> liste = new PlongeurConnuService(eleves, cursus, utilisateurs).lister();

        assertThat(liste).hasSize(2);
        PlongeurConnuVue ligneAnis = liste.get(0);
        assertThat(ligneAnis.eleveId()).isEqualTo(1L);
        assertThat(ligneAnis.niveau()).isEqualTo("N2");
        assertThat(ligneAnis.niveauPreparation()).isEqualTo("N3");
        assertThat(ligneAnis.niveauEncadrement()).isEqualTo("E1");
        PlongeurConnuVue ligneTiago = liste.get(1);
        assertThat(ligneTiago.utilisateurId()).isEqualTo(6L);
        assertThat(ligneTiago.niveau()).isEqualTo("N2");
        assertThat(ligneTiago.niveauEncadrement()).isEqualTo("E1");
    }

    private static Utilisateur moniteur(Long id, String nom, String prenom, NiveauEncadrement niveau) {
        Utilisateur u = new Utilisateur();
        u.setId(id);
        u.setNom(nom);
        u.setPrenom(prenom);
        u.setActif(true);
        u.setNiveauEncadrement(niveau);
        u.setRoles(EnumSet.of(RoleNom.MONITEUR));
        return u;
    }

    private static Cursus cursus(Eleve e, Niveau niveau, Cursus.Statut statut, int annee) {
        Referentiel r = new Referentiel();
        r.setNiveau(niveau);
        Saison s = new Saison();
        s.setDateDebut(LocalDate.of(annee, 9, 1));
        Cursus c = new Cursus();
        c.setEleve(e);
        c.setReferentiel(r);
        c.setSaison(s);
        c.setStatut(statut);
        return c;
    }
}
