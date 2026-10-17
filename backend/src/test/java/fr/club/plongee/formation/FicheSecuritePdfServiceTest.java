package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.MembrePalanquee;
import fr.club.plongee.formation.domain.Palanquee;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.service.FicheSecuritePdfService;
import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.securite.domain.Utilisateur;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La fiche de sécurité doit tenir sur une seule page A4 portrait, comme le
 * modèle papier du club : deux tours, 15 plongeurs et 8 encadrants, même
 * quand chaque plongeur porte une qualification préparée et des
 * observations.
 */
class FicheSecuritePdfServiceTest {

    /** Identité d'origine, sans base : nom par défaut et logo embarqué. */
    private final FicheSecuritePdfService service = new FicheSecuritePdfService(new fr.club.plongee.formation.service.FicheSecuriteExcelService(
            new IdentiteStructureService(null, "Club de plongée") {
                @Override
                public String nom() {
                    return "Club de plongée";
                }

                @Override
                public byte[] logoPng() {
                    return logoOrigine();
                }
            }));

    @Test
    void une_feuille_pleine_tient_sur_une_page() throws IOException {
        byte[] pdf = service.generer(java.util.List.of(fiche(23, 8), fiche(23, 8))).contenu();

        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
        }
    }

    @Test
    @org.junit.jupiter.api.DisplayName("La fiche de sécurité s'imprime sur une page A4 paysage")
    void laFicheEstEnPaysage() throws IOException {
        byte[] pdf = service.generer(java.util.List.of(fiche(23, 8), fiche(23, 8))).contenu();

        try (PDDocument document = Loader.loadPDF(pdf)) {
            var page = document.getPage(0).getMediaBox();
            assertThat(page.getWidth()).isCloseTo(842f, org.assertj.core.data.Offset.offset(2f));
            assertThat(page.getHeight()).isCloseTo(595f, org.assertj.core.data.Offset.offset(2f));
        }
    }

    @Test
    void une_fiche_presque_vide_tient_sur_une_page() throws IOException {
        byte[] pdf = service.generer(java.util.List.of(fiche(1, 1))).contenu();

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
            m.setAptitude(i < nbPalanquees ? "E3" : "N1");
            if (i < nbPalanquees) m.setFonction(fr.club.plongee.formation.domain.FonctionPalanquee.GUIDE_PALANQUEE);
            m.setQualificationPreparee(i < nbPalanquees ? null : "N2");
            m.setAptitudeDonneeParDp("PE20");
            m.setObservations(i % 3 == 0 ? "Première plongée en milieu naturel après délivrance du N1." : null);
            Palanquee p = fiche.getPalanquees().get(i % nbPalanquees);
            m.setPalanquee(p);
            p.getMembres().add(m);
        }
        return fiche;
    }
}
