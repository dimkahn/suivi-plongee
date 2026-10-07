package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.securite.domain.NiveauEncadrement;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Compose une proposition de palanquées pour une plongée en milieu naturel, à
 * partir d'une liste de plongeurs et de critères (voir {@link Criteres}).
 * Calcul pur, sans base ni état : {@code PropositionPalanqueesService} lui
 * fournit les plongeurs avec leur aptitude déjà résolue.
 *
 * <p>Une proposition n'est qu'un brouillon : elle pré-remplit le formulaire
 * de la fiche, que le directeur de plongée relit, corrige et enregistre. Rien
 * n'est écrit ici. Elle ne place jamais un plongeur au-delà de son aptitude :
 * celui qu'elle ne sait pas placer est rendu dans {@code nonPlaces}, avec la
 * raison, plutôt que forcé dans une palanquée.
 *
 * <p>Règles retenues (Code du sport, annexes III-16 et III-17, lecture du
 * club à confirmer par le DP ; le serveur ne les oppose pas à
 * l'enregistrement de la fiche) :
 * <ul>
 *   <li>palanquée encadrée : au plus {@link #MAX_PLONGEURS_ENCADRES} plongeurs
 *       plus l'encadrant ;</li>
 *   <li>palanquée autonome : 2 ou 3 plongeurs autonomes à la profondeur visée,
 *       sans encadrant ;</li>
 *   <li>enseignement : l'encadrant doit avoir le niveau exigé par la
 *       profondeur (E1 jusqu'à 6 m, E2 jusqu'à 20 m, E3 jusqu'à 40 m, E4
 *       au-delà) et par la formation préparée (E1 pour le N1, E2 pour le N2,
 *       E3 pour le N3, comme pour la notation) ;</li>
 *   <li>exploration : guide de palanquée (N4, ou E2 et plus) jusqu'à 40 m,
 *       E1 accepté jusqu'à 6 m ; au-delà de 40 m, un E4 (choix prudent).</li>
 * </ul>
 */
public final class ProposeurPalanquees {

    public static final int MAX_PLONGEURS_ENCADRES = 4;
    public static final int MAX_AUTONOMES = 3;
    public static final int PROFONDEUR_MAX = 60;

    public enum TypePlongee { EXPLORATION, ENSEIGNEMENT }

    /**
     * Un plongeur proposé : {@code aptitude} est déjà résolue (texte et
     * dossier) ; {@code encadrantDisponible} = coché comme encadrant pour
     * cette plongée (critère 6), sans effet s'il n'a aucune prérogative
     * d'encadrement.
     */
    public record Candidat(Long eleveId, Long utilisateurId, String nom, String prenom,
                           String aptitudeTexte, String qualificationPreparee,
                           AptitudePlongeur aptitude, boolean encadrantDisponible) {

        String nomComplet() {
            return ((prenom == null ? "" : prenom) + " " + (nom == null ? "" : nom)).trim();
        }
    }

    /**
     * Les critères : profondeur visée, type de plongée, nombre maximum de
     * plongeurs par palanquée encadrée, autonomes regroupés entre eux,
     * regroupement par niveau, et les paires de plongeurs (indices dans la
     * liste des candidats) à garder ensemble ou à séparer.
     */
    public record Criteres(int profondeur, TypePlongee type, int maxPlongeurs, boolean autonomesEnsemble,
                           boolean regrouperParNiveau, List<int[]> ensemble, List<int[]> separes) {}

    public record Membre(Candidat candidat, FonctionPalanquee fonction) {}

    public record Palanquee(int numero, boolean autonome, List<Membre> membres) {}

    public record NonPlace(Candidat candidat, String raison) {}

    public record Proposition(List<Palanquee> palanquees, List<NonPlace> nonPlaces,
                              List<Candidat> encadrantsLibres, List<String> avertissements) {}

    private final List<Candidat> candidats;
    private final Criteres criteres;
    /** Indices des paires à séparer, dans les deux sens. */
    private final Map<Integer, Set<Integer>> separes = new LinkedHashMap<>();
    private final Map<Integer, Set<Integer>> liensEncadrant = new LinkedHashMap<>();
    private final List<NonPlace> nonPlaces = new ArrayList<>();
    private final List<String> avertissements = new ArrayList<>();

    private ProposeurPalanquees(List<Candidat> candidats, Criteres criteres) {
        this.candidats = candidats;
        this.criteres = criteres;
    }

    public static Proposition proposer(List<Candidat> candidats, Criteres criteres) {
        verifier(candidats, criteres);
        return new ProposeurPalanquees(candidats, criteres).calculer();
    }

    private static void verifier(List<Candidat> candidats, Criteres c) {
        if (c.profondeur() < 1 || c.profondeur() > PROFONDEUR_MAX) {
            throw new RegleMetierException(
                    "La profondeur visée doit être comprise entre 1 et " + PROFONDEUR_MAX + " m.");
        }
        if (c.maxPlongeurs() < 1 || c.maxPlongeurs() > MAX_PLONGEURS_ENCADRES) {
            throw new RegleMetierException("Une palanquée encadrée compte de 1 à " + MAX_PLONGEURS_ENCADRES
                    + " plongeurs, plus l'encadrant.");
        }
        if (candidats.isEmpty()) {
            throw new RegleMetierException("Aucun plongeur à répartir.");
        }
        for (List<int[]> paires : List.of(c.ensemble(), c.separes())) {
            for (int[] p : paires) {
                if (p.length != 2 || p[0] < 0 || p[1] < 0 || p[0] >= candidats.size()
                        || p[1] >= candidats.size() || p[0] == p[1]) {
                    throw new RegleMetierException("Une paire de plongeurs choisie n'est pas valable.");
                }
            }
        }
    }

    // --- Calcul ---------------------------------------------------------------------------------

    /** Un groupe de plongeurs indissociables (critère « garder ensemble »). */
    private record Unite(List<Integer> membres) {
        int taille() { return membres.size(); }
    }

    /** Une palanquée en construction. */
    private final class Lot {
        final List<Unite> unites = new ArrayList<>();
        final String cle;
        Integer encadrant;

        Lot(String cle) { this.cle = cle; }

        int taille() { return unites.stream().mapToInt(Unite::taille).sum(); }

        List<Integer> membres() { return unites.stream().flatMap(u -> u.membres().stream()).toList(); }

        boolean accepte(Unite u, int capacite) {
            return taille() + u.taille() <= capacite && sansConflit(membres(), u.membres())
                    && (encadrant == null || sansConflit(List.of(encadrant), u.membres()));
        }
    }

    private Proposition calculer() {
        for (int[] p : criteres.separes()) {
            separes.computeIfAbsent(p[0], k -> new HashSet<>()).add(p[1]);
            separes.computeIfAbsent(p[1], k -> new HashSet<>()).add(p[0]);
        }

        // Encadrants retenus (critère 6) : cochés et ayant une prérogative d'encadrement.
        List<Integer> encadrants = new ArrayList<>();
        List<Integer> plongeurs = new ArrayList<>();
        for (int i = 0; i < candidats.size(); i++) {
            Candidat c = candidats.get(i);
            if (c.encadrantDisponible() && c.aptitude().encadre()) {
                encadrants.add(i);
            } else {
                if (c.encadrantDisponible()) {
                    avertissements.add(c.nomComplet() + " est coché comme encadrant, mais aucun niveau"
                            + " d'encadrement n'est connu : il est placé comme plongeur.");
                }
                plongeurs.add(i);
            }
        }

        // Plongeurs qui ne peuvent pas descendre à la profondeur visée.
        List<Integer> placables = new ArrayList<>();
        for (int i : plongeurs) {
            String raison = raisonHorsProfondeur(i);
            if (raison == null) placables.add(i);
            else nonPlaces.add(new NonPlace(candidats.get(i), raison));
        }

        List<Unite> unites = unites(placables, new HashSet<>(encadrants));

        // Autonomes (critère 4) d'un côté, encadrés de l'autre.
        List<Unite> autonomes = new ArrayList<>();
        List<Unite> encadres = new ArrayList<>();
        for (Unite u : unites) {
            boolean autonome = criteres.autonomesEnsemble() && u.taille() <= MAX_AUTONOMES
                    && u.membres().stream().allMatch(this::peutEtreAutonome)
                    && u.membres().stream().noneMatch(liensEncadrant::containsKey);
            (autonome ? autonomes : encadres).add(u);
        }

        List<Lot> lotsAutonomes = composerAutonomes(autonomes, encadres);
        List<Lot> lotsEncadres = new ArrayList<>();
        for (Unite u : encadres) {
            Integer bloquant = u.membres().stream().filter(i -> !peutEtreEncadre(i)).findFirst().orElse(null);
            if (bloquant != null) {
                for (int i : u.membres()) {
                    nonPlaces.add(new NonPlace(candidats.get(i), i == bloquant
                            ? "Ne peut descendre à " + criteres.profondeur() + " m qu'en autonomie,"
                              + " et n'a pas de palanquée autonome."
                            : "Gardé avec " + candidats.get(bloquant).nomComplet() + ", qui n'a pas pu être placé."));
                }
            }
        }
        encadres.removeIf(u -> u.membres().stream().anyMatch(i -> !peutEtreEncadre(i)));

        Map<String, List<Unite>> parNiveau = new LinkedHashMap<>();
        encadres.stream()
                .sorted(Comparator.comparing((Unite u) -> cle(u.membres().getFirst())))
                .forEach(u -> parNiveau.computeIfAbsent(cle(u.membres().getFirst()), k -> new ArrayList<>()).add(u));
        for (var e : parNiveau.entrySet()) {
            lotsEncadres.addAll(repartir(e.getValue(), criteres.maxPlongeurs(), e.getKey()));
        }

        List<Integer> libres = attribuerEncadrants(lotsEncadres, encadrants);
        libres = utiliserEncadrantsLibres(lotsEncadres, libres);
        regrouperLotsSansEncadrant(lotsEncadres);

        List<Palanquee> palanquees = new ArrayList<>();
        for (Lot lot : lotsEncadres) {
            List<Membre> membres = new ArrayList<>();
            membres.add(new Membre(candidats.get(lot.encadrant), criteres.type() == TypePlongee.ENSEIGNEMENT
                    ? FonctionPalanquee.ENCADRANT : FonctionPalanquee.GUIDE_PALANQUEE));
            lot.membres().forEach(i -> membres.add(new Membre(candidats.get(i), FonctionPalanquee.PLONGEUR)));
            palanquees.add(new Palanquee(palanquees.size() + 1, false, membres));
        }
        for (Lot lot : lotsAutonomes) {
            palanquees.add(new Palanquee(palanquees.size() + 1, true, lot.membres().stream()
                    .map(i -> new Membre(candidats.get(i), FonctionPalanquee.PLONGEUR)).toList()));
        }
        return new Proposition(palanquees, nonPlaces,
                libres.stream().map(candidats::get).toList(), avertissements);
    }

    /** Null si le plongeur peut aller à la profondeur visée (encadré ou autonome), sinon la raison. */
    private String raisonHorsProfondeur(int i) {
        Candidat c = candidats.get(i);
        Integer max = maxNonNul(c.aptitude().profondeurMax(), profondeurFormation(i));
        if (max == null) {
            return "Aptitude inconnue" + (c.aptitudeTexte() == null || c.aptitudeTexte().isBlank()
                    ? "." : " (« " + c.aptitudeTexte() + " »).");
        }
        if (max < criteres.profondeur()) {
            return "Aptitude limitée à " + max + " m, plongée prévue à " + criteres.profondeur() + " m.";
        }
        return null;
    }

    private boolean enFormation(int i) {
        return criteres.type() == TypePlongee.ENSEIGNEMENT
                && niveauFormation(candidats.get(i).qualificationPreparee()) != null;
    }

    /** En enseignement, la formation préparée permet de descendre à sa profondeur (N1 20 m, N2 40 m, N3 60 m). */
    private Integer profondeurFormation(int i) {
        if (!enFormation(i)) return null;
        return AptitudePlongeur.lire(candidats.get(i).qualificationPreparee()).profondeurEncadree();
    }

    private boolean peutEtreEncadre(int i) {
        Integer max = maxNonNul(candidats.get(i).aptitude().profondeurEncadree(), profondeurFormation(i));
        return max != null && max >= criteres.profondeur();
    }

    /** Un élève en formation est toujours encadré ; les autres le sont selon leur aptitude. */
    private boolean peutEtreAutonome(int i) {
        Integer max = candidats.get(i).aptitude().profondeurAutonome();
        return !enFormation(i) && max != null && max >= criteres.profondeur();
    }

    /**
     * Les unités indissociables : les paires « ensemble » entre plongeurs
     * fusionnées (de proche en proche) ; une paire avec un encadrant est
     * gardée à part, comme une préférence au moment de choisir l'encadrant
     * d'une palanquée.
     */
    private List<Unite> unites(List<Integer> placables, Set<Integer> encadrants) {
        Map<Integer, Integer> parent = new LinkedHashMap<>();
        placables.forEach(i -> parent.put(i, i));
        for (int[] p : criteres.ensemble()) {
            boolean e0 = encadrants.contains(p[0]), e1 = encadrants.contains(p[1]);
            if (e0 && e1) {
                avertissements.add(candidats.get(p[0]).nomComplet() + " et " + candidats.get(p[1]).nomComplet()
                        + " encadrent tous les deux : chacun guide sa propre palanquée.");
            } else if (e0 || e1) {
                int encadrant = e0 ? p[0] : p[1], plongeur = e0 ? p[1] : p[0];
                if (parent.containsKey(plongeur)) {
                    liensEncadrant.computeIfAbsent(plongeur, k -> new HashSet<>()).add(encadrant);
                }
            } else if (parent.containsKey(p[0]) && parent.containsKey(p[1])) {
                parent.put(racine(parent, p[0]), racine(parent, p[1]));
            }
        }
        Map<Integer, List<Integer>> groupes = new LinkedHashMap<>();
        for (int i : placables) groupes.computeIfAbsent(racine(parent, i), k -> new ArrayList<>()).add(i);

        List<Unite> resultat = new ArrayList<>();
        for (List<Integer> g : groupes.values()) {
            for (int a : g) {
                for (int b : g) {
                    if (a < b && separes.getOrDefault(a, Set.of()).contains(b)) {
                        throw new RegleMetierException(candidats.get(a).nomComplet() + " et "
                                + candidats.get(b).nomComplet() + " sont à la fois à garder ensemble et à séparer.");
                    }
                }
            }
            if (g.size() > criteres.maxPlongeurs()) {
                throw new RegleMetierException("Trop de plongeurs à garder ensemble ("
                        + g.stream().map(i -> candidats.get(i).nomComplet()).reduce((x, y) -> x + ", " + y).orElse("")
                        + ") : au plus " + criteres.maxPlongeurs() + " par palanquée.");
            }
            resultat.add(new Unite(g));
        }
        return resultat;
    }

    private static int racine(Map<Integer, Integer> parent, int i) {
        while (parent.get(i) != i) i = parent.get(i);
        return i;
    }

    /**
     * Palanquées autonomes de 2 ou 3. Un autonome resté seul rejoint les
     * encadrés s'il peut l'être à cette profondeur ; sinon il n'est pas placé.
     */
    private List<Lot> composerAutonomes(List<Unite> autonomes, List<Unite> encadres) {
        List<Lot> lots = repartir(autonomes, MAX_AUTONOMES, "");
        for (Lot seul : lots.stream().filter(l -> l.taille() == 1).toList()) {
            // Prendre un plongeur à une palanquée de trois : deux palanquées de deux.
            boolean complete = false;
            for (Lot plein : lots) {
                if (plein.taille() != MAX_AUTONOMES) continue;
                for (Unite u : plein.unites) {
                    if (u.taille() == 1 && sansConflit(seul.membres(), u.membres())) {
                        plein.unites.remove(u);
                        seul.unites.add(u);
                        complete = true;
                        break;
                    }
                }
                if (complete) break;
            }
            if (!complete) {
                lots.remove(seul);
                int i = seul.membres().getFirst();
                if (peutEtreEncadre(i)) {
                    encadres.addAll(seul.unites);
                } else {
                    nonPlaces.add(new NonPlace(candidats.get(i), "Aucun autre plongeur autonome à "
                            + criteres.profondeur() + " m pour former un binôme."));
                }
            }
        }
        return lots;
    }

    /**
     * Répartit des unités en un nombre minimal de lots de taille {@code capacite},
     * en remplissant à chaque fois le lot le moins chargé qui les accepte :
     * des lots équilibrés, qui respectent les paires à séparer.
     */
    private List<Lot> repartir(List<Unite> unites, int capacite, String cle) {
        int total = unites.stream().mapToInt(Unite::taille).sum();
        List<Lot> lots = new ArrayList<>();
        for (int k = 0; k < (total + capacite - 1) / capacite; k++) lots.add(new Lot(cle));
        unites.stream().sorted(Comparator.comparingInt(Unite::taille).reversed()).forEach(u -> {
            Lot lot = lots.stream().filter(l -> l.accepte(u, capacite))
                    .min(Comparator.comparingInt(Lot::taille)).orElse(null);
            if (lot == null) {
                lot = new Lot(cle);
                lots.add(lot);
            }
            lot.unites.add(u);
        });
        lots.removeIf(l -> l.taille() == 0);
        return lots;
    }

    /** Clé de regroupement (critère 5) : le niveau préparé, sinon l'aptitude ; une seule clé sinon. */
    private String cle(int i) {
        if (!criteres.regrouperParNiveau()) return "";
        Candidat c = candidats.get(i);
        String formation = enFormation(i) ? niveauFormation(c.qualificationPreparee()) : null;
        if (formation != null) return "1 formation " + formation;
        String aptitude = c.aptitudeTexte() == null ? "" : c.aptitudeTexte().trim().toUpperCase(Locale.ROOT);
        return "2 " + aptitude;
    }

    // --- Encadrants -----------------------------------------------------------------------------

    /**
     * L'encadrant convient à tous les plongeurs du lot : niveau exigé par la
     * profondeur et la formation pour un élève en enseignement, guide de
     * palanquée à la profondeur visée pour les autres ; et pas à séparer d'eux.
     */
    private boolean peutEncadrer(int encadrant, Lot lot) {
        AptitudePlongeur a = candidats.get(encadrant).aptitude();
        if (!sansConflit(List.of(encadrant), lot.membres())) return false;
        for (int i : lot.membres()) {
            if (enFormation(i)) {
                NiveauEncadrement requis = plusExigeant(parProfondeurEnseignement(criteres.profondeur()),
                        parFormation(niveauFormation(candidats.get(i).qualificationPreparee())));
                if (a.encadrement() == null || !a.encadrement().auMoins(requis)) return false;
            } else if (!peutGuider(a)) {
                return false;
            }
        }
        return true;
    }

    private boolean peutGuider(AptitudePlongeur a) {
        int p = criteres.profondeur();
        if (p <= 6) return a.encadre();
        if (p <= 40) return a.guidePalanquee() || (a.encadrement() != null && a.encadrement().auMoins(NiveauEncadrement.E2));
        return a.encadrement() != null && a.encadrement().auMoins(NiveauEncadrement.E4);
    }

    private static NiveauEncadrement parProfondeurEnseignement(int profondeur) {
        if (profondeur <= 6) return NiveauEncadrement.E1;
        if (profondeur <= 20) return NiveauEncadrement.E2;
        if (profondeur <= 40) return NiveauEncadrement.E3;
        return NiveauEncadrement.E4;
    }

    private static NiveauEncadrement parFormation(String niveau) {
        return switch (niveau) {
            case "N1" -> NiveauEncadrement.E1;
            case "N2" -> NiveauEncadrement.E2;
            default -> NiveauEncadrement.E3;
        };
    }

    /** « N2 », « PN2 », « Niveau 2 » → « N2 » ; null si aucun N1 à N3 n'est reconnu. */
    private static String niveauFormation(String texte) {
        if (texte == null) return null;
        var m = java.util.regex.Pattern.compile("N(?:IVEAU ?)?([1-3])").matcher(texte.toUpperCase(Locale.ROOT));
        return m.find() ? "N" + m.group(1) : null;
    }

    private static NiveauEncadrement plusExigeant(NiveauEncadrement a, NiveauEncadrement b) {
        return a.auMoins(b) ? a : b;
    }

    /** Rang d'un encadrant : on donne à chaque palanquée le moins qualifié qui convient. */
    private int rang(int encadrant) {
        AptitudePlongeur a = candidats.get(encadrant).aptitude();
        if (a.encadrement() == null) return 2;
        return switch (a.encadrement()) {
            case E1 -> 1;
            case E2 -> 3;
            case E3 -> 4;
            case E4 -> 5;
        };
    }

    /**
     * Donne un encadrant à chaque lot : d'abord celui qu'un de ses plongeurs
     * doit garder (critère 7), puis aux lots les plus difficiles à pourvoir le
     * moins qualifié qui convient. Renvoie les encadrants restés libres.
     */
    private List<Integer> attribuerEncadrants(List<Lot> lots, List<Integer> encadrants) {
        List<Integer> libres = new ArrayList<>(encadrants);
        for (Lot lot : lots) {
            for (int i : lot.membres()) {
                for (int e : liensEncadrant.getOrDefault(i, Set.of())) {
                    if (lot.encadrant == null && libres.contains(e) && peutEncadrer(e, lot)) {
                        lot.encadrant = e;
                        libres.remove(Integer.valueOf(e));
                    }
                }
            }
        }
        List<Lot> aPourvoir = new ArrayList<>(lots.stream().filter(l -> l.encadrant == null).toList());
        while (!aPourvoir.isEmpty()) {
            Lot lot = aPourvoir.stream()
                    .min(Comparator.comparingLong((Lot l) -> libres.stream().filter(e -> peutEncadrer(e, l)).count())
                            .thenComparing(Comparator.comparingInt(Lot::taille).reversed()))
                    .orElseThrow();
            aPourvoir.remove(lot);
            libres.stream().filter(e -> peutEncadrer(e, lot)).min(Comparator.comparingInt(this::rang))
                    .ifPresent(e -> {
                        lot.encadrant = e;
                        libres.remove(e);
                    });
        }
        return libres;
    }

    /**
     * Encadrants en surplus : la palanquée la plus chargée (3 plongeurs ou
     * plus) est coupée en deux, la moitié détachée prenant un encadrant libre
     * qui lui convient. Des palanquées plus petites, mieux suivies.
     */
    private List<Integer> utiliserEncadrantsLibres(List<Lot> lots, List<Integer> libres) {
        boolean progres = true;
        while (progres && !libres.isEmpty()) {
            progres = false;
            List<Lot> candidatesACouper = lots.stream().filter(l -> l.encadrant != null && l.taille() >= 3
                            && l.unites.size() >= 2)
                    .sorted(Comparator.comparingInt(Lot::taille).reversed()).toList();
            for (Lot lot : candidatesACouper) {
                Lot moitie = new Lot(lot.cle);
                List<Unite> unites = new ArrayList<>(lot.unites);
                unites.sort(Comparator.comparingInt(Unite::taille));
                for (Unite u : unites) {
                    if (moitie.taille() + u.taille() > lot.taille() / 2) continue;
                    moitie.unites.add(u);
                }
                if (moitie.taille() == 0) continue;
                Integer encadrant = libres.stream().filter(e -> peutEncadrer(e, moitie))
                        .min(Comparator.comparingInt(this::rang)).orElse(null);
                if (encadrant == null) continue;
                lot.unites.removeAll(moitie.unites);
                moitie.encadrant = encadrant;
                libres.remove(encadrant);
                lots.add(lots.indexOf(lot) + 1, moitie);
                progres = true;
                break;
            }
        }
        return libres;
    }

    /**
     * Un lot resté sans encadrant : ses plongeurs rejoignent si possible une
     * palanquée encadrée de même niveau qui a de la place et dont l'encadrant
     * leur convient ; sinon ils sont rendus non placés.
     */
    private void regrouperLotsSansEncadrant(List<Lot> lots) {
        for (Lot orphelin : lots.stream().filter(l -> l.encadrant == null).toList()) {
            lots.remove(orphelin);
            for (Unite u : orphelin.unites) {
                Lot accueil = lots.stream()
                        .filter(l -> l.encadrant != null && l.cle.equals(orphelin.cle)
                                && l.accepte(u, criteres.maxPlongeurs()))
                        .filter(l -> {
                            l.unites.add(u);
                            boolean ok = peutEncadrer(l.encadrant, l);
                            l.unites.remove(u);
                            return ok;
                        })
                        .min(Comparator.comparingInt(Lot::taille)).orElse(null);
                if (accueil != null) {
                    accueil.unites.add(u);
                } else {
                    for (int i : u.membres()) {
                        nonPlaces.add(new NonPlace(candidats.get(i), "Aucun encadrant disponible n'a le niveau"
                                + " requis pour l'encadrer à " + criteres.profondeur() + " m" + exigence(i) + "."));
                    }
                }
            }
        }
    }

    private String exigence(int i) {
        if (enFormation(i)) {
            return " (" + plusExigeant(parProfondeurEnseignement(criteres.profondeur()),
                    parFormation(niveauFormation(candidats.get(i).qualificationPreparee()))) + " minimum)";
        }
        int p = criteres.profondeur();
        return p <= 6 ? "" : p <= 40 ? " (guide de palanquée ou E2 minimum)" : " (E4 minimum)";
    }

    private boolean sansConflit(List<Integer> a, List<Integer> b) {
        for (int x : a) {
            Set<Integer> s = separes.getOrDefault(x, Set.of());
            for (int y : b) if (s.contains(y)) return false;
        }
        return true;
    }

    private static Integer maxNonNul(Integer a, Integer b) {
        if (a == null) return b;
        if (b == null) return a;
        return Math.max(a, b);
    }
}
