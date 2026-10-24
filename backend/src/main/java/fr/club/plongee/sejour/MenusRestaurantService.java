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

    public record ChoixParticipant(long participantId, String nom, String prenom, List<Long> platIds, int totalCentimes) {}

    public record SansChoix(long participantId, String nom, String prenom) {}

    /** La commande complète, pour les organisateurs ; les plats sans prix comptent pour 0. */
    public record CommandeVue(List<LignePlat> plats, List<ChoixParticipant> participants, List<SansChoix> sansChoix,
                              int totalCentimes) {}

    /** {@code commande} : null pour qui n'organise pas le séjour. */
    public record MenuVue(long id, LocalDate jour, RepasSejour repas, String restaurant, List<PlatVue> plats,
                          List<Long> monChoix, CommandeVue commande) {}

    /** {@code participantId} : le participant de celui qui lit, null s'il n'est pas inscrit. */
    public record MenusVue(List<MenuVue> menus, Long participantId, boolean gere) {}

    public record DemandeChoix(@NotNull List<@NotNull Long> platIds) {}

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
        List<MenuVue> menus = jdbc.query("""
                SELECT id, jour, repas, restaurant FROM sejour_menu WHERE sortie_id = :sortie ORDER BY jour, id""", sortie,
                (rs, i) -> {
                    long id = rs.getLong("id");
                    List<PlatVue> plats = platsParMenu.getOrDefault(id, List.of());
                    List<Choix> duMenu = choix.stream().filter(c -> c.menuId() == id).toList();
                    List<Long> mien = participantId == null ? List.of()
                            : duMenu.stream().filter(c -> c.participantId() == participantId).map(Choix::platId).toList();
                    return new MenuVue(id, rs.getObject("jour", LocalDate.class), RepasSejour.valueOf(rs.getString("repas")),
                            rs.getString("restaurant"), plats, mien, gere ? commande(plats, duMenu, inscrits) : null);
                });
        menus = menus.stream()
                .sorted((a, b) -> a.jour().equals(b.jour()) ? a.repas().compareTo(b.repas()) : a.jour().compareTo(b.jour()))
                .toList();
        return new MenusVue(menus, participantId, gere);
    }

    private static CommandeVue commande(List<PlatVue> plats, List<Choix> choix, List<Inscrit> inscrits) {
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
            participants.add(new ChoixParticipant(i.id(), i.nom(), i.prenom(), siens, sien));
        }
        return new CommandeVue(lignes, participants, sansChoix, total);
    }
}
