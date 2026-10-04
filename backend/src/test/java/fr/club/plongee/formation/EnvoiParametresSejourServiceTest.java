package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.service.EnvoiParametresSejourService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Contenu du courriel de fin de séjour : seulement les plongées du plongeur, avec sa palanquée. */
class EnvoiParametresSejourServiceTest {

    private final EnvoiParametresSejourService service =
            new EnvoiParametresSejourService(null, null, null, null, "Club de test");

    private static MembrePalanquee plongeur(String prenom, String nom, String aptitude, FonctionPalanquee fonction) {
        MembrePalanquee m = new MembrePalanquee();
        m.setPrenom(prenom);
        m.setNom(nom);
        m.setAptitude(aptitude);
        m.setFonction(fonction);
        return m;
    }

    private static Palanquee palanquee(int numero, MembrePalanquee... membres) {
        Palanquee p = new Palanquee();
        p.setNumero(numero);
        p.getMembres().addAll(List.of(membres));
        return p;
    }

    private static FicheSecurite fiche(LocalDate date, int ordre, String site, Palanquee... palanquees) {
        Seance s = new Seance();
        s.setDateSeance(date);
        s.setOrdre(ordre);
        s.setLieu("Hyères");
        s.setSite(site);
        FicheSecurite f = new FicheSecurite();
        f.setSeance(s);
        f.getPalanquees().addAll(List.of(palanquees));
        return f;
    }

    @Test
    @DisplayName("Le courriel ne reprend que les plongées du plongeur, avec site, paramètres et coéquipiers")
    void seulementSesPlongees() {
        Palanquee p1 = palanquee(1, plongeur("Anis", "Dulac", "N3", FonctionPalanquee.GUIDE_PALANQUEE),
                plongeur("Sonia", "Perrot", "N1", FonctionPalanquee.PLONGEUR));
        p1.setProfondeurRealisee(19);
        p1.setDureeRealisee(38);
        p1.setHeureImmersion(LocalTime.of(9, 12));
        p1.setHeureSortie(LocalTime.of(9, 50));
        p1.setPaliers("3 min à 3 m");
        Palanquee p2 = palanquee(2, plongeur("Marc", "Leroy", "N2", FonctionPalanquee.PLONGEUR));
        p2.setProfondeurRealisee(40);
        FicheSecurite matin = fiche(LocalDate.of(2026, 10, 10), 1, "Le Donator", p1, p2);

        Palanquee p3 = palanquee(1, plongeur("Marc", "Leroy", "N2", FonctionPalanquee.PLONGEUR));
        p3.setProfondeurPrevue(25);
        p3.setDureePrevue(45);
        FicheSecurite apresMidi = fiche(LocalDate.of(2026, 10, 10), 2, "La Gabinière", p3);

        Sortie sortie = new Sortie();
        sortie.setNom("Séjour Port-Cros");

        // Saisi « sonia perrot » sans accent ni majuscule dans le groupe : retrouvée quand même.
        MembreGroupePlongeurs sonia = new MembreGroupePlongeurs();
        sonia.setPrenom("sonia");
        sonia.setNom("PERROT");
        sonia.setEmail("sonia@exemple.fr");

        var courriel = service.composer(sonia, sortie, List.of(matin, apresMidi)).orElseThrow();
        assertThat(courriel.adresse()).isEqualTo("sonia@exemple.fr");
        assertThat(courriel.sujet()).contains("Séjour Port-Cros");
        assertThat(courriel.corps())
                .contains("Samedi 10/10/2026, plongée n° 1", "Hyères — Le Donator", "Profondeur : 19 m",
                        "Durée : 38 min", "09:12", "09:50", "3 min à 3 m",
                        "Palanquée n° 1 : avec Anis Dulac (N3, guide de palanquée)")
                .doesNotContain("Leroy", "La Gabinière", "40 m");

        MembreGroupePlongeurs marc = new MembreGroupePlongeurs();
        marc.setPrenom("Marc");
        marc.setNom("Leroy");
        String corpsMarc = service.composer(marc, sortie, List.of(matin, apresMidi)).orElseThrow().corps();
        assertThat(corpsMarc).contains("Le Donator", "La Gabinière", "Profondeur : 25 m (prévue)", "seul(e) inscrit(e)")
                .doesNotContain("Perrot", "Dulac");

        MembreGroupePlongeurs absent = new MembreGroupePlongeurs();
        absent.setPrenom("Zoé");
        absent.setNom("Martin");
        assertThat(service.composer(absent, sortie, List.of(matin, apresMidi))).isEmpty();
    }
}
