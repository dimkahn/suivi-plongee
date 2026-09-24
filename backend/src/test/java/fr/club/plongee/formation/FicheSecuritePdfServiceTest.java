package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.MembrePalanquee;
import fr.club.plongee.formation.domain.Palanquee;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.service.FicheSecuritePdfService;
import fr.club.plongee.formation.service.LogoClub;
import fr.club.plongee.securite.domain.Utilisateur;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La fiche de sécurité doit tenir sur une seule page A4 paysage, comme le
 * modèle papier : 15 lignes de plongeurs et 7 palanquées au minimum, même
 * quand chaque plongeur porte un niveau et une qualification préparée
 * (deux lignes dans la colonne Niveau) et que les conditions sont remplies.
 */
class FicheSecuritePdfServiceTest {

    private final FicheSecuritePdfService service =
            new FicheSecuritePdfService("Club de plongée", new LogoClub());

    @Test
    void une_fiche_pleine_tient_sur_une_page() throws IOException {
        FicheSecurite fiche = fiche(15, 7);

        byte[] pdf = service.generer(fiche).contenu();

        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
        }
    }

    @Test
    void une_fiche_presque_vide_tient_sur_une_page() throws IOException {
        byte[] pdf = service.generer(fiche(1, 1)).contenu();

        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
        }
    }

    private FicheSecurite fiche(int nbPlongeurs, int nbPalanquees) {
        Seance seance = new Seance();
        seance.setDateSeance(LocalDate.of(2026, 9, 20));
        seance.setLieu("Carrière de Beaumont-sur-Oise");
        seance.setOrdre(1);

        Utilisateur dp = new Utilisateur();
        dp.setPrenom("Claire");
        dp.setNom("Ferrand");

        FicheSecurite fiche = new FicheSecurite();
        fiche.setSeance(seance);
        fiche.setDp(dp);
        fiche.setMeteo("Ensoleillé, vent faible");
        fiche.setEtatMer("Plan d'eau calme");
        fiche.setVisibilite("8 m");
        fiche.setCourant("Nul");

        for (int n = 1; n <= nbPalanquees; n++) {
            Palanquee p = new Palanquee();
            p.setNumero(n);
            p.setFicheSecurite(fiche);
            p.setProfondeurPrevue(20);
            p.setDureePrevue(40);
            p.setHeureImmersion(LocalTime.of(10, 0));
            p.setHeureSortie(LocalTime.of(10, 42));
            p.setProfondeurRealisee(19);
            p.setDureeRealisee(41);
            fiche.getPalanquees().add(p);
        }
        for (int i = 0; i < nbPlongeurs; i++) {
            MembrePalanquee m = new MembrePalanquee();
            m.setNom("Plongeur" + i);
            m.setPrenom("Prénom" + i);
            m.setAptitude(i % 5 == 0 ? "E3" : "N1");
            m.setQualificationPreparee(i % 5 == 0 ? null : "PA20");
            m.setAptitudeDonneeParDp("PE20");
            m.setObservations(i % 3 == 0 ? "Première plongée en milieu naturel après délivrance du N1." : null);
            Palanquee p = fiche.getPalanquees().get(i % nbPalanquees);
            m.setPalanquee(p);
            p.getMembres().add(m);
        }
        return fiche;
    }
}
