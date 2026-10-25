package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.formation.service.SortieService.SortieVue;
import fr.club.plongee.securite.UtilisateurPrincipal;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Les menus des restaurants du séjour (demande du club, 2026) : le créateur
 * et les organisateurs importent le classeur Excel du menu d'un repas
 * ({@link LecteurMenu}), chaque participant choisit ses plats (dans l'appli
 * ou par le lien), un organisateur peut choisir pour un participant sans
 * compte. Seuls les organisateurs lisent la commande complète : chacun ne
 * voit que son propre choix.
 */
@Service
public class MenusRestaurantService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record PlatVue(long id, String categorie, String nom, String description, Integer prixCentimes) {}

    /** Combien de fois ce plat est commandé. */
    public record LignePlat(long platId, int nombre) {}

    /** {@code payeDeSonCote} : l'addition est payée et il n'y a pas été mis (il règle lui-même sa part au restaurant). */
    public record ChoixParticipant(long participantId, String nom, String prenom, List<Long> platIds, int totalCentimes,
                                   boolean payeDeSonCote) {}

    public record SansChoix(long participantId, String nom, String prenom) {}

    /** La commande complète, pour les organisateurs ; les plats sans prix comptent pour 0. */
    public record CommandeVue(List<LignePlat> plats, List<ChoixParticipant> participants, List<SansChoix> sansChoix,
                              int totalCentimes) {}

    /** L'addition payée : {@code payeurId} null (et nom, prénom) quand c'est le club qui l'a avancée. */
    public record ReglementVue(Long payeurId, String nom, String prenom) {}

    /** {@code commande} : null pour qui n'organise pas le séjour ; {@code reglement} : null tant que l'addition n'est pas payée. */
    public record MenuVue(long id, LocalDate jour, RepasSejour repas, String restaurant, List<PlatVue> plats,
                          List<Long> monChoix, CommandeVue commande, ReglementVue reglement) {}

    /** {@code participantId} : le participant de celui qui lit, null s'il n'est pas inscrit. */
    public record MenusVue(List<MenuVue> menus, Long participantId, boolean gere) {}

    public record DemandeChoix(@NotNull List<@NotNull Long> platIds) {}

    /** Un plat du menu modifié : {@code id} null pour un plat ajouté. */
    public record PlatModifie(Long id, String categorie, String nom, String description, Integer prixCentimes) {}

    /** Le menu tel qu'il doit être, dans l'ordre : un plat absent est retiré, avec ses choix. */
    public record DemandeMenu(String restaurant, List<PlatModifie> plats) {}

    /**
     * {@code payeurId} : le participant qui paie l'addition, null pour le club ;
     * {@code deLeurCote} : ceux qui paient eux-mêmes leur part, sans dépense dans les frais.
     */
    public record DemandeReglement(Long payeurId, List<Long> deLeurCote) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;
    private final DroitsSejour droits;
    private final FraisService frais;

    public MenusRestaurantService(NamedParameterJdbcTemplate jdbc, SortieService sorties, DroitsSejour droits,
                                  FraisService frais) {
        this.jdbc = jdbc;
        this.sorties = sorties;
        this.droits = droits;
        this.frais = frais;
    }

    // ------------------------------------------------------------------
    //  Qui lit
    // ------------------------------------------------------------------

    /** Un compte de l'appli : les encadrants et les participants du séjour. */
    @Transactional(readOnly = true)
    public MenusVue lire(Long sortieId, UtilisateurPrincipal moi) {
        Long participant = frais.acteur(sortieId, moi).participantId();
        boolean encadrant = SejourService.encadrant(moi);
        if (!encadrant && participant == null) {
            throw new AccessDeniedException("Les menus du séjour ne sont ouverts qu'à ses participants et aux encadrants.");
        }
        return vue(sortieId, participant, encadrant && droits.organise(sortieId, moi.id()));
    }

    /** Un participant entré par le lien. */
    @Transactional(readOnly = true)
    public MenusVue lireParticipant(Long sortieId, Long participantId) {
        return vue(sortieId, participantId, false);
    }

    // ------------------------------------------------------------------
    //  Import et suppression (organisateurs)
    // ------------------------------------------------------------------

    /**
     * Le menu du repas, lu dans le classeur ; remplace celui du même repas
     * (et donc ses choix). Le repas compte désormais comme pris au restaurant.
     */
    @Transactional
    public MenusVue importer(Long sortieId, LocalDate jour, RepasSejour repas, String restaurant, byte[] fichier,
                             UtilisateurPrincipal moi) {
        SortieVue sortie = sorties.lire(sortieId);
        if (jour.isBefore(sortie.dateDebut()) || jour.isAfter(sortie.dateFin())) {
            throw new RegleMetierException("Le " + DATE.format(jour) + " n'est pas un jour du séjour (du "
                    + DATE.format(sortie.dateDebut()) + " au " + DATE.format(sortie.dateFin()) + ").");
        }
        List<LecteurMenu.PlatLu> plats = LecteurMenu.lire(fichier);
        var repasDuJour = new MapSqlParameterSource("sortie", sortieId).addValue("jour", jour).addValue("repas", repas.name());
        jdbc.update("DELETE FROM sejour_menu WHERE sortie_id = :sortie AND jour = :jour AND repas = :repas", repasDuJour);
        String nom = restaurant == null || restaurant.isBlank() ? null : restaurant.strip();
        var cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO sejour_menu (sortie_id, jour, repas, restaurant) VALUES (:sortie, :jour, :repas, :restaurant)""",
                repasDuJour.addValue("restaurant", nom != null && nom.length() > 200 ? nom.substring(0, 200) : nom),
                cle, new String[]{"id"});
        long menuId = Objects.requireNonNull(cle.getKey()).longValue();
        for (int i = 0; i < plats.size(); i++) {
            LecteurMenu.PlatLu p = plats.get(i);
            jdbc.update("""
                    INSERT INTO sejour_menu_plat (menu_id, rang, categorie, nom, description, prix_centimes)
                    VALUES (:menu, :rang, :categorie, :nom, :description, :prix)""",
                    new MapSqlParameterSource("menu", menuId).addValue("rang", i).addValue("categorie", p.categorie())
                            .addValue("nom", p.nom()).addValue("description", p.description())
                            .addValue("prix", p.prixCentimes()));
        }
        Integer dejaAuRestaurant = jdbc.queryForObject("""
                SELECT COUNT(*) FROM sejour_repas_au_restaurant WHERE sortie_id = :sortie AND jour = :jour AND repas = :repas""",
                repasDuJour, Integer.class);
        if (dejaAuRestaurant == null || dejaAuRestaurant == 0) {
            jdbc.update("INSERT INTO sejour_repas_au_restaurant (sortie_id, jour, repas) VALUES (:sortie, :jour, :repas)",
                    repasDuJour);
        }
        return lire(sortieId, moi);
    }

    /**
     * Le menu corrigé à la main (une erreur de l'IA, un plat du jour) : nom du
     * restaurant et plats, dans l'ordre donné. Un plat gardé garde ses choix
     * (au nouveau prix) ; un plat retiré emporte les siens. Plus rien ne
     * change une fois l'addition payée : les frais suivent les prix.
     */
    @Transactional
    public MenusVue modifier(Long sortieId, Long menuId, DemandeMenu d, UtilisateurPrincipal moi) {
        verifierMenu(sortieId, menuId);
        if (paye(menuId)) throw new RegleMetierException("L'addition de ce repas est payée : le menu ne change plus.");
        List<PlatModifie> plats = d.plats() == null ? List.of() : d.plats().stream().filter(Objects::nonNull).toList();
        if (plats.isEmpty()) throw new RegleMetierException("Le menu doit garder au moins un plat.");
        if (plats.size() > LecteurMenu.PLATS_MAX) {
            throw new RegleMetierException("Pas plus de " + LecteurMenu.PLATS_MAX + " plats dans un menu.");
        }
        var menu = new MapSqlParameterSource("menu", menuId);
        List<Long> duMenu = jdbc.queryForList("SELECT id FROM sejour_menu_plat WHERE menu_id = :menu", menu, Long.class);
        for (PlatModifie p : plats) {
            if (p.nom() == null || p.nom().isBlank()) throw new RegleMetierException("Chaque plat doit avoir un nom.");
            if (p.id() != null && !duMenu.contains(p.id())) throw new RegleMetierException("Ce plat n'est pas dans ce menu.");
            if (p.prixCentimes() != null && p.prixCentimes() < 0) {
                throw new RegleMetierException("Le prix de « " + p.nom().strip() + " » ne peut pas être négatif.");
            }
            if (p.prixCentimes() != null && p.prixCentimes() > FraisService.MONTANT_MAX_CENTIMES) {
                throw new RegleMetierException("Le prix de « " + p.nom().strip() + " » est trop élevé : vérifiez la saisie.");
            }
        }
        List<Long> gardes = plats.stream().map(PlatModifie::id).filter(Objects::nonNull).toList();
        for (Long retire : duMenu) {
            if (!gardes.contains(retire)) {
                jdbc.update("DELETE FROM sejour_menu_plat WHERE id = :p", new MapSqlParameterSource("p", retire));
            }
        }
        jdbc.update("UPDATE sejour_menu SET restaurant = :restaurant WHERE id = :menu",
                menu.addValue("restaurant", texte(d.restaurant(), 200)));
        for (int i = 0; i < plats.size(); i++) {
            PlatModifie p = plats.get(i);
            var valeurs = new MapSqlParameterSource("menu", menuId).addValue("rang", i).addValue("id", p.id())
                    .addValue("categorie", texte(p.categorie(), 100)).addValue("nom", texte(p.nom(), 300))
                    .addValue("description", texte(p.description(), 1000)).addValue("prix", p.prixCentimes());
            jdbc.update(p.id() == null ? """
                    INSERT INTO sejour_menu_plat (menu_id, rang, categorie, nom, description, prix_centimes)
                    VALUES (:menu, :rang, :categorie, :nom, :description, :prix)""" : """
                    UPDATE sejour_menu_plat SET rang = :rang, categorie = :categorie, nom = :nom,
                           description = :description, prix_centimes = :prix WHERE id = :id AND menu_id = :menu""",
                    valeurs);
        }
        return lire(sortieId, moi);
    }

    /** Sans espaces autour, null si vide, coupé à la taille de la colonne (comme {@link LecteurMenu}). */
    private static String texte(String t, int longueurMax) {
        if (t == null || t.isBlank()) return null;
        String s = t.strip();
        return s.length() > longueurMax ? s.substring(0, longueurMax) : s;
    }

    @Transactional
    public MenusVue supprimer(Long sortieId, Long menuId, UtilisateurPrincipal moi) {
        verifierMenu(sortieId, menuId);
        jdbc.update("DELETE FROM sejour_menu WHERE id = :menu", new MapSqlParameterSource("menu", menuId));
        return lire(sortieId, moi);
    }

    // ------------------------------------------------------------------
    //  Choix
    // ------------------------------------------------------------------

    /** Le participant pour lui-même, un organisateur pour tout participant. */
    @Transactional
    public MenusVue choisir(Long sortieId, Long menuId, Long participantId, List<Long> platIds, UtilisateurPrincipal moi) {
        boolean organise = SejourService.encadrant(moi) && droits.organise(sortieId, moi.id());
        if (!organise && !participantId.equals(frais.acteur(sortieId, moi).participantId())) {
            throw new AccessDeniedException("Seuls le participant et les organisateurs du séjour font son choix.");
        }
        enregistrerChoix(sortieId, menuId, participantId, platIds);
        return lire(sortieId, moi);
    }

    /** Un participant entré par le lien, pour lui-même. */
    @Transactional
    public MenusVue choisirParticipant(Long sortieId, Long menuId, Long participantId, List<Long> platIds) {
        enregistrerChoix(sortieId, menuId, participantId, platIds);
        return lireParticipant(sortieId, participantId);
    }

    private void enregistrerChoix(Long sortieId, Long menuId, Long participantId, List<Long> platIds) {
        verifierMenu(sortieId, menuId);
        if (paye(menuId)) throw new RegleMetierException("L'addition de ce repas est payée : les choix ne changent plus.");
        Integer inscrit = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE id = :p AND sortie_id = :sortie",
                new MapSqlParameterSource("p", participantId).addValue("sortie", sortieId), Integer.class);
        if (inscrit == null || inscrit == 0) throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        var menu = new MapSqlParameterSource("menu", menuId).addValue("p", participantId);
        List<Long> duMenu = jdbc.queryForList("SELECT id FROM sejour_menu_plat WHERE menu_id = :menu", menu, Long.class);
        if (!duMenu.containsAll(platIds)) throw new RegleMetierException("Ce plat n'est pas dans ce menu.");
        jdbc.update("""
                DELETE FROM sejour_menu_choix WHERE participant_id = :p
                   AND plat_id IN (SELECT id FROM sejour_menu_plat WHERE menu_id = :menu)""", menu);
        for (Long plat : new LinkedHashSet<>(platIds)) {
            jdbc.update("INSERT INTO sejour_menu_choix (plat_id, participant_id) VALUES (:plat, :p)",
                    new MapSqlParameterSource("plat", plat).addValue("p", participantId));
        }
    }

    // ------------------------------------------------------------------
    //  Addition (organisateurs)
    // ------------------------------------------------------------------

    /**
     * L'addition payée, une fois que tout le monde a choisi : une dépense par
     * personne dans les frais du séjour, à son montant, payée par
     * {@code payeurId} (le club si null). Les plats sans prix comptent pour 0 ;
     * qui n'a rien à payer, ou paie de son côté ({@code deLeurCote}), n'a pas
     * de dépense. Ces dépenses se corrigent ensuite dans l'onglet « Frais »,
     * comme les autres.
     */
    @Transactional
    public MenusVue regler(Long sortieId, Long menuId, Long payeurId, List<Long> deLeurCote, UtilisateurPrincipal moi) {
        var aPart = deLeurCote == null ? java.util.Set.<Long>of() : java.util.Set.copyOf(deLeurCote);
        verifierMenu(sortieId, menuId);
        if (paye(menuId)) {
            throw new RegleMetierException("L'addition de ce repas est déjà payée : ses frais sont dans l'onglet « Frais ».");
        }
        MenuVue menu = vue(sortieId, null, true).menus().stream().filter(m -> m.id() == menuId).findFirst().orElseThrow();
        CommandeVue c = menu.commande();
        if (!c.sansChoix().isEmpty()) {
            throw new RegleMetierException("Tout le monde n'a pas encore choisi : " + String.join(", ",
                    c.sansChoix().stream().map(s -> court(s.prenom(), s.nom())).toList()));
        }
        if (c.totalCentimes() == 0) {
            throw new RegleMetierException("Aucun plat choisi n'a de prix : saisissez l'addition dans l'onglet « Frais ».");
        }
        List<ChoixParticipant> dansLesFrais = c.participants().stream()
                .filter(p -> p.totalCentimes() > 0 && !aPart.contains(p.participantId())).toList();
        if (dansLesFrais.isEmpty()) {
            throw new RegleMetierException("Tout le monde paie de son côté : il n'y a rien à mettre dans les frais.");
        }
        String libelle = (menu.restaurant() == null ? "Restaurant" : "Restaurant " + menu.restaurant()) + ", "
                + nomDuRepas(menu.repas()) + " du " + DateTimeFormatter.ofPattern("dd/MM").format(menu.jour()) + " : ";
        var acteur = frais.acteur(sortieId, moi);
        for (ChoixParticipant p : dansLesFrais) {
            String qui = court(p.prenom(), p.nom());
            String ligne = libelle.length() + qui.length() > 160 ? libelle.substring(0, 160 - qui.length()) + qui : libelle + qui;
            long depense = frais.creerDepense(sortieId, new FraisService.DemandeDepense(ligne, FraisSejour.CategorieDepense.REPAS,
                    (long) p.totalCentimes(), payeurId, menu.jour(), List.of(new FraisSejour.Part(p.participantId(), 1))), acteur);
            jdbc.update("UPDATE sejour_depense SET menu_id = :menu WHERE id = :d",
                    new MapSqlParameterSource("menu", menuId).addValue("d", depense));
        }
        return lire(sortieId, moi);
    }

    private boolean paye(Long menuId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM sejour_depense WHERE menu_id = :menu",
                new MapSqlParameterSource("menu", menuId), Integer.class);
        return n != null && n > 0;
    }

    /** « Léo D. » : prénom et initiale du nom, comme la commande copiée pour le restaurant. */
    private static String court(String prenom, String nom) {
        return nom == null || nom.isBlank() ? prenom : prenom + " " + Character.toUpperCase(nom.strip().charAt(0)) + ".";
    }

    private static String nomDuRepas(RepasSejour repas) {
        return switch (repas) {
            case PETIT_DEJEUNER -> "petit-déjeuner";
            case DEJEUNER -> "déjeuner";
            case DINER -> "dîner";
        };
    }

    private void verifierMenu(Long sortieId, Long menuId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM sejour_menu WHERE id = :menu AND sortie_id = :sortie",
                new MapSqlParameterSource("menu", menuId).addValue("sortie", sortieId), Integer.class);
        if (n == null || n == 0) throw new RessourceIntrouvableException("Menu introuvable dans ce séjour");
    }

    // ------------------------------------------------------------------
    //  Vue
    // ------------------------------------------------------------------

    private record Choix(long menuId, long platId, long participantId) {}

    private record Inscrit(long id, String nom, String prenom) {}

    private MenusVue vue(Long sortieId, Long participantId, boolean gere) {
        var sortie = new MapSqlParameterSource("sortie", sortieId);
        Map<Long, List<PlatVue>> platsParMenu = new LinkedHashMap<>();
        jdbc.query("""
                SELECT p.id, p.menu_id, p.categorie, p.nom, p.description, p.prix_centimes
                  FROM sejour_menu_plat p JOIN sejour_menu m ON m.id = p.menu_id
                 WHERE m.sortie_id = :sortie ORDER BY p.menu_id, p.rang""", sortie, rs -> {
            platsParMenu.computeIfAbsent(rs.getLong("menu_id"), k -> new ArrayList<>()).add(new PlatVue(
                    rs.getLong("id"), rs.getString("categorie"), rs.getString("nom"), rs.getString("description"),
                    (Integer) rs.getObject("prix_centimes", Integer.class)));
        });
        List<Choix> choix = jdbc.query("""
                SELECT p.menu_id, c.plat_id, c.participant_id
                  FROM sejour_menu_choix c JOIN sejour_menu_plat p ON p.id = c.plat_id
                  JOIN sejour_menu m ON m.id = p.menu_id
                 WHERE m.sortie_id = :sortie ORDER BY p.rang""", sortie,
                (rs, i) -> new Choix(rs.getLong("menu_id"), rs.getLong("plat_id"), rs.getLong("participant_id")));
        List<Inscrit> inscrits = gere ? jdbc.query("""
                SELECT id, nom, prenom FROM sejour_participant WHERE sortie_id = :sortie
                 ORDER BY LOWER(nom), LOWER(prenom), id""", sortie,
                (rs, i) -> new Inscrit(rs.getLong("id"), rs.getString("nom"), rs.getString("prenom"))) : List.of();
        Map<Long, ReglementVue> reglements = new LinkedHashMap<>();
        jdbc.query("""
                SELECT d.menu_id, d.payeur_id, p.nom, p.prenom FROM sejour_depense d
                  LEFT JOIN sejour_participant p ON p.id = d.payeur_id
                 WHERE d.sortie_id = :sortie AND d.menu_id IS NOT NULL ORDER BY d.id""", sortie, rs -> {
            reglements.putIfAbsent(rs.getLong("menu_id"), new ReglementVue(rs.getObject("payeur_id", Long.class),
                    rs.getString("nom"), rs.getString("prenom")));
        });
        // Qui a sa part de l'addition dans les frais, menu par menu.
        Map<Long, List<Long>> dansLesFrais = new LinkedHashMap<>();
        if (gere) jdbc.query("""
                SELECT d.menu_id, dp.participant_id FROM sejour_depense d JOIN sejour_depense_part dp ON dp.depense_id = d.id
                 WHERE d.sortie_id = :sortie AND d.menu_id IS NOT NULL""", sortie, rs -> {
            dansLesFrais.computeIfAbsent(rs.getLong("menu_id"), k -> new ArrayList<>()).add(rs.getLong("participant_id"));
        });
        List<MenuVue> menus = jdbc.query("""
                SELECT id, jour, repas, restaurant FROM sejour_menu WHERE sortie_id = :sortie ORDER BY jour, id""", sortie,
                (rs, i) -> {
                    long id = rs.getLong("id");
                    List<PlatVue> plats = platsParMenu.getOrDefault(id, List.of());
                    List<Choix> duMenu = choix.stream().filter(c -> c.menuId() == id).toList();
                    List<Long> mien = participantId == null ? List.of()
                            : duMenu.stream().filter(c -> c.participantId() == participantId).map(Choix::platId).toList();
                    return new MenuVue(id, rs.getObject("jour", LocalDate.class), RepasSejour.valueOf(rs.getString("repas")),
                            rs.getString("restaurant"), plats, mien, gere ? commande(plats, duMenu, inscrits, reglements.containsKey(id) ? dansLesFrais.getOrDefault(id, List.of()) : null)
                                    : null,
                            reglements.get(id));
                });
        menus = menus.stream()
                .sorted((a, b) -> a.jour().equals(b.jour()) ? a.repas().compareTo(b.repas()) : a.jour().compareTo(b.jour()))
                .toList();
        return new MenusVue(menus, participantId, gere);
    }

    /** {@code dansLesFrais} : ceux qui ont leur part de l'addition dans les frais ; null tant qu'elle n'est pas payée. */
    private static CommandeVue commande(List<PlatVue> plats, List<Choix> choix, List<Inscrit> inscrits,
                                        List<Long> dansLesFrais) {
        Map<Long, Integer> prix = new LinkedHashMap<>();
        plats.forEach(p -> prix.put(p.id(), p.prixCentimes() == null ? 0 : p.prixCentimes()));
        List<LignePlat> lignes = plats.stream()
                .map(p -> new LignePlat(p.id(), (int) choix.stream().filter(c -> c.platId() == p.id()).count()))
                .filter(l -> l.nombre() > 0)
                .toList();
        List<ChoixParticipant> participants = new ArrayList<>();
        List<SansChoix> sansChoix = new ArrayList<>();
        int total = 0;
        for (Inscrit i : inscrits) {
            List<Long> siens = choix.stream().filter(c -> c.participantId() == i.id()).map(Choix::platId).toList();
            if (siens.isEmpty()) {
                sansChoix.add(new SansChoix(i.id(), i.nom(), i.prenom()));
                continue;
            }
            int sien = siens.stream().mapToInt(prix::get).sum();
            total += sien;
            participants.add(new ChoixParticipant(i.id(), i.nom(), i.prenom(), siens, sien,
                    dansLesFrais != null && sien > 0 && !dansLesFrais.contains(i.id())));
        }
        return new CommandeVue(lignes, participants, sansChoix, total);
    }
}
