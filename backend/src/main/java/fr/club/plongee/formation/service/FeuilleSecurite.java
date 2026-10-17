package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.formation.domain.MembrePalanquee;
import fr.club.plongee.formation.domain.Palanquee;
import fr.club.plongee.formation.domain.Seance;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * La feuille de sécurité imprimée du club (modèle « Martinique 2026 ») :
 * deux plongées du même jour au même lieu sur une seule page. Les plongeurs
 * en lignes ; une colonne par encadrant (guide de palanquée, sinon
 * encadrant de la palanquée), sur les deux tours, puis des colonnes
 * « Autonomes » pour les palanquées sans encadrant. La case d'un plongeur
 * dit à quel tour il plonge dans cette colonne (« 1 », « 2 », « 1-2 ») ; les
 * profondeurs, durées et heures se lisent par tour, colonne par colonne.
 * <p>
 * Calcul pur, partagé par le PDF et l'Excel.
 */
public final class FeuilleSecurite {

    /** Colonnes et lignes vides gardées pour compléter à la main, comme sur le modèle papier. */
    static final int NB_ENCADRANTS_MIN = 5;
    static final int NB_AUTONOMES_MIN = 3;
    static final int NB_LIGNES_MIN = 10;
    public static final int NB_TOURS = 2;

    /**
     * Un encadrant (nom et niveau) ou une palanquée d'autonomes ;
     * {@code parTour} : sa palanquée à chaque tour (null s'il n'y plonge pas),
     * toujours {@link #NB_TOURS} éléments.
     */
    public record Colonne(String nom, String niveau, boolean autonomes, List<Palanquee> parTour) {}

    /** {@code cases} : une par colonne, dans l'ordre des colonnes. */
    public record Ligne(MembrePalanquee membre, String niveau, String aptitudeDp, String observations,
                        List<String> cases) {}

    private final List<FicheSecurite> tours;
    private final List<Colonne> colonnes;
    private final List<Ligne> lignes;
    private final int nbEncadrants;

    private FeuilleSecurite(List<FicheSecurite> tours, List<Colonne> colonnes, List<Ligne> lignes, int nbEncadrants) {
        this.tours = tours;
        this.colonnes = colonnes;
        this.lignes = lignes;
        this.nbEncadrants = nbEncadrants;
    }

    /** Une feuille pour une ou deux fiches (1er et 2e tour, dans cet ordre). */
    public static FeuilleSecurite depuis(List<FicheSecurite> tours) {
        if (tours.isEmpty() || tours.size() > NB_TOURS) {
            throw new IllegalArgumentException("Une feuille porte une ou deux plongées");
        }
        Map<String, Palanquee[]> encadrants = new LinkedHashMap<>();
        Map<String, MembrePalanquee> chefs = new LinkedHashMap<>();
        List<Palanquee[]> autonomes = new ArrayList<>();
        for (int t = 0; t < tours.size(); t++) {
            int rangAutonome = 0;
            for (Palanquee p : tours.get(t).getPalanquees()) {
                MembrePalanquee chef = chef(p);
                if (chef == null) {
                    if (rangAutonome == autonomes.size()) autonomes.add(new Palanquee[NB_TOURS]);
                    autonomes.get(rangAutonome++)[t] = p;
                } else {
                    chefs.putIfAbsent(cle(chef), chef);
                    encadrants.computeIfAbsent(cle(chef), k -> new Palanquee[NB_TOURS])[t] = p;
                }
            }
        }

        List<Colonne> colonnes = new ArrayList<>();
        chefs.forEach((cle, chef) -> colonnes.add(new Colonne(nomComplet(chef), texte(chef.getAptitude()), false,
                Arrays.asList(encadrants.get(cle)))));
        for (int i = chefs.size(); i < NB_ENCADRANTS_MIN; i++) {
            colonnes.add(new Colonne("", "", false, Arrays.asList(new Palanquee[NB_TOURS])));
        }
        for (Palanquee[] parTour : autonomes) {
            colonnes.add(new Colonne("Autonomes", "", true, Arrays.asList(parTour)));
        }
        for (int i = autonomes.size(); i < NB_AUTONOMES_MIN; i++) {
            colonnes.add(new Colonne("Autonomes", "", true, Arrays.asList(new Palanquee[NB_TOURS])));
        }

        // Les plongeurs, dans l'ordre où ils apparaissent ; un encadrant n'est une ligne que s'il plonge sous un autre.
        Map<String, MembrePalanquee> plongeurs = new LinkedHashMap<>();
        for (FicheSecurite f : tours) {
            for (Palanquee p : f.getPalanquees()) {
                MembrePalanquee chef = chef(p);
                for (MembrePalanquee m : p.getMembres()) {
                    if (m != chef) plongeurs.putIfAbsent(cle(m), m);
                }
            }
        }
        List<Ligne> lignes = new ArrayList<>();
        for (Map.Entry<String, MembrePalanquee> e : plongeurs.entrySet()) {
            List<String> cases = new ArrayList<>();
            for (Colonne c : colonnes) cases.add(toursDe(e.getKey(), c));
            MembrePalanquee m = e.getValue();
            lignes.add(new Ligne(m, texte(m.getAptitude()), premier(e.getKey(), tours, MembrePalanquee::getAptitudeDonneeParDp),
                    observations(e.getKey(), tours), cases));
        }
        return new FeuilleSecurite(List.copyOf(tours), colonnes, lignes, chefs.size());
    }

    /**
     * Les fiches (déjà dans l'ordre des plongées) par feuilles : celles d'un
     * même jour et d'un même lieu vont par deux, dans leur ordre ; une
     * plongée seule a sa feuille.
     */
    public static List<List<FicheSecurite>> regrouper(List<FicheSecurite> fiches) {
        Map<String, List<FicheSecurite>> parJourEtLieu = new LinkedHashMap<>();
        for (FicheSecurite f : fiches) {
            Seance s = f.getSeance();
            String lieu = s.getLieu() == null ? "" : s.getLieu().trim().toLowerCase();
            parJourEtLieu.computeIfAbsent(s.getDateSeance() + "|" + lieu, k -> new ArrayList<>()).add(f);
        }
        List<List<FicheSecurite>> feuilles = new ArrayList<>();
        for (List<FicheSecurite> groupe : parJourEtLieu.values()) {
            for (int i = 0; i < groupe.size(); i += NB_TOURS) {
                feuilles.add(List.copyOf(groupe.subList(i, Math.min(i + NB_TOURS, groupe.size()))));
            }
        }
        feuilles.sort((a, b) -> Integer.compare(fiches.indexOf(a.get(0)), fiches.indexOf(b.get(0))));
        return feuilles;
    }

    public List<FicheSecurite> tours() {
        return tours;
    }

    public List<Colonne> colonnes() {
        return colonnes;
    }

    public List<Ligne> lignes() {
        return lignes;
    }

    /** Le nombre d'encadrants qui ont une palanquée sur la feuille (en rouge sur le modèle). */
    public int nbEncadrants() {
        return nbEncadrants;
    }

    public int nbLignesAffichees() {
        return Math.max(NB_LIGNES_MIN, lignes.size());
    }

    /** Les directeurs de plongée des tours, sans doublon : « Nom Prénom » ou « A (1er tour), B (2e tour) ». */
    public String directeursDePlongee() {
        List<String> noms = tours.stream().map(f -> f.getDp() == null ? "" : f.getDp().getNom() + " " + f.getDp().getPrenom())
                .toList();
        if (noms.stream().distinct().count() <= 1) return noms.get(0);
        return noms.get(0) + " (1er tour), " + noms.get(1) + " (2e tour)";
    }

    /** Le guide de palanquée, sinon l'encadrant ; null pour une palanquée d'autonomes. */
    private static MembrePalanquee chef(Palanquee p) {
        for (FonctionPalanquee fonction : List.of(FonctionPalanquee.GUIDE_PALANQUEE, FonctionPalanquee.ENCADRANT)) {
            for (MembrePalanquee m : p.getMembres()) {
                if (m.getFonction() == fonction) return m;
            }
        }
        return null;
    }

    private static String toursDe(String cle, Colonne c) {
        List<String> numeros = new ArrayList<>();
        for (int t = 0; t < NB_TOURS; t++) {
            Palanquee p = c.parTour().get(t);
            if (p != null && p.getMembres().stream().anyMatch(m -> m != chef(p) && cle(m).equals(cle))) {
                numeros.add(String.valueOf(t + 1));
            }
        }
        return String.join("-", numeros);
    }

    /** Le niveau préparé (« PN3 »), sinon « explo » ; puis les observations saisies pour le plongeur. */
    private static String observations(String cle, List<FicheSecurite> tours) {
        String prepare = premier(cle, tours, MembrePalanquee::getQualificationPreparee);
        String saisies = premier(cle, tours, MembrePalanquee::getObservations);
        String base = prepare.isEmpty() ? "explo" : "P" + prepare;
        return saisies.isEmpty() ? base : base + " · " + saisies;
    }

    private static String premier(String cle, List<FicheSecurite> tours,
                                  java.util.function.Function<MembrePalanquee, String> valeur) {
        return tours.stream().flatMap(f -> f.getPalanquees().stream()).flatMap(p -> p.getMembres().stream())
                .filter(m -> cle(m).equals(cle)).map(valeur).filter(Objects::nonNull).map(String::trim)
                .filter(v -> !v.isEmpty()).findFirst().orElse("");
    }

    private static String nomComplet(MembrePalanquee m) {
        return (texte(m.getNom()) + " " + texte(m.getPrenom())).trim();
    }

    private static String texte(String s) {
        return s == null ? "" : s.trim();
    }

    /** Même personne d'un tour à l'autre : son dossier élève, son compte, sinon nom et prénom. */
    private static String cle(MembrePalanquee m) {
        if (m.getEleve() != null) return "E" + m.getEleve().getId();
        if (m.getUtilisateur() != null) return "U" + m.getUtilisateur().getId();
        return "N" + texte(m.getNom()).toLowerCase() + "|" + texte(m.getPrenom()).toLowerCase();
    }
}
