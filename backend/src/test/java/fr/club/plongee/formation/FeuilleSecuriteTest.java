package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.formation.domain.MembrePalanquee;
import fr.club.plongee.formation.domain.Palanquee;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.service.FeuilleSecurite;
import fr.club.plongee.securite.domain.Utilisateur;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La feuille de sécurité imprimée du club (modèle « Martinique 2026 ») : deux
 * plongées du jour sur une page, une colonne par encadrant, la case d'un
 * plongeur dit à quel tour il plonge avec lui.
 */
class FeuilleSecuriteTest {

    private static final LocalDate JOUR = LocalDate.of(2026, 4, 12);

    @Test
    @DisplayName("Une colonne par encadrant sur les deux tours ; la case du plongeur dit le tour")
    void uneColonneParEncadrant() {
        FicheSecurite matin = fiche(1, "Sainte-Luce", "Rocher du Diamant");
        palanquee(matin, guide("Hubert", "Gérard", "E3"), plongeur("Seixas", "Justo", "N1", null),
                plongeur("Pigeau", "Marianne", "N2", "N3"));
        FicheSecurite apresMidi = fiche(2, "Sainte-Luce", "Anse Noire");
        palanquee(apresMidi, guide("Hubert", "Gérard", "E3"), plongeur("Seixas", "Justo", "N1", null));
        palanquee(apresMidi, guide("Kahn", "Dimitri", "E3"), plongeur("Pigeau", "Marianne", "N2", "N3"));

        FeuilleSecurite feuille = FeuilleSecurite.depuis(List.of(matin, apresMidi));

        assertThat(feuille.nbEncadrants()).isEqualTo(2);
        assertThat(feuille.colonnes().subList(0, 2)).extracting(FeuilleSecurite.Colonne::nom, FeuilleSecurite.Colonne::niveau)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Hubert Gérard", "E3"),
                        org.assertj.core.groups.Tuple.tuple("Kahn Dimitri", "E3"));
        // Les encadrants sont en colonnes, pas en lignes.
        assertThat(feuille.lignes()).extracting(l -> l.membre().getNom()).containsExactly("Seixas", "Pigeau");
        assertThat(feuille.lignes().get(0).cases().subList(0, 2)).containsExactly("1-2", "");
        assertThat(feuille.lignes().get(1).cases().subList(0, 2)).containsExactly("1", "2");
    }

    @Test
    @DisplayName("Une palanquée sans encadrant va dans une colonne « Autonomes »")
    void palanqueeAutonome() {
        FicheSecurite matin = fiche(1, "Sainte-Luce", null);
        palanquee(matin, guide("Hubert", "Gérard", "E3"), plongeur("Seixas", "Justo", "N1", null));
        palanquee(matin, plongeur("Moulin", "Olivier", "N3", null), plongeur("Desforges", "Julien", "N3", null));

        FeuilleSecurite feuille = FeuilleSecurite.depuis(List.of(matin));

        int autonomes = feuille.colonnes().indexOf(feuille.colonnes().stream()
                .filter(FeuilleSecurite.Colonne::autonomes).findFirst().orElseThrow());
        assertThat(feuille.nbEncadrants()).isEqualTo(1);
        assertThat(feuille.lignes()).extracting(l -> l.cases().get(autonomes)).containsExactly("", "1", "1");
        assertThat(feuille.colonnes().get(autonomes).parTour().get(0)).isSameAs(matin.getPalanquees().get(1));
    }

    @Test
    @DisplayName("Observations : le niveau préparé (PN3), sinon « explo »")
    void observations() {
        FicheSecurite matin = fiche(1, "Sainte-Luce", null);
        palanquee(matin, guide("Hubert", "Gérard", "E3"), plongeur("Seixas", "Justo", "N1", null),
                plongeur("Pigeau", "Marianne", "N2", "N3"));

        FeuilleSecurite feuille = FeuilleSecurite.depuis(List.of(matin));

        assertThat(feuille.lignes()).extracting(FeuilleSecurite.Ligne::observations).containsExactly("explo", "PN3");
    }

    @Test
    @DisplayName("Le modèle garde au moins 5 colonnes d'encadrants, 3 d'autonomes et 10 lignes à remplir à la main")
    void minimumsDuModele() {
        FicheSecurite matin = fiche(1, "Sainte-Luce", null);
        palanquee(matin, guide("Hubert", "Gérard", "E3"), plongeur("Seixas", "Justo", "N1", null));

        FeuilleSecurite feuille = FeuilleSecurite.depuis(List.of(matin));

        assertThat(feuille.colonnes()).filteredOn(c -> !c.autonomes()).hasSize(5);
        assertThat(feuille.colonnes()).filteredOn(FeuilleSecurite.Colonne::autonomes).hasSize(3);
        assertThat(feuille.nbLignesAffichees()).isEqualTo(10);
    }

    @Test
    @DisplayName("Les plongées d'un même jour et d'un même lieu vont par deux sur une feuille")
    void regroupementParDeux() {
        FicheSecurite p1 = fiche(1, "Sainte-Luce", null);
        FicheSecurite p2 = fiche(2, "Sainte-Luce", null);
        FicheSecurite p3 = fiche(3, "Sainte-Luce", null);
        FicheSecurite ailleurs = fiche(1, "Piscine", null);

        assertThat(FeuilleSecurite.regrouper(List.of(p1, ailleurs, p2, p3)))
                .containsExactly(List.of(p1, p2), List.of(ailleurs), List.of(p3));
    }

    private static FicheSecurite fiche(int ordre, String lieu, String site) {
        Seance s = new Seance();
        s.setDateSeance(JOUR);
        s.setOrdre(ordre);
        s.setLieu(lieu);
        s.setSite(site);
        Utilisateur dp = new Utilisateur();
        dp.setNom("Lacuès");
        dp.setPrenom("Sébastien");
        FicheSecurite f = new FicheSecurite();
        f.setSeance(s);
        f.setDp(dp);
        return f;
    }

    private static void palanquee(FicheSecurite f, MembrePalanquee... membres) {
        Palanquee p = new Palanquee();
        p.setNumero(f.getPalanquees().size() + 1);
        p.setFicheSecurite(f);
        for (MembrePalanquee m : membres) {
            m.setPalanquee(p);
            p.getMembres().add(m);
        }
        f.getPalanquees().add(p);
    }

    private static MembrePalanquee guide(String nom, String prenom, String niveau) {
        MembrePalanquee m = plongeur(nom, prenom, niveau, null);
        m.setFonction(FonctionPalanquee.GUIDE_PALANQUEE);
        return m;
    }

    private static MembrePalanquee plongeur(String nom, String prenom, String niveau, String prepare) {
        MembrePalanquee m = new MembrePalanquee();
        m.setNom(nom);
        m.setPrenom(prenom);
        m.setAptitude(niveau);
        m.setQualificationPreparee(prepare);
        return m;
    }
}
