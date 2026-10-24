package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.formation.service.SortieService.SortieVue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Les repas du séjour pris au restaurant, pour la liste de courses (demande
 * du club, 2026) : l'organisateur les choisit, les encadrants les lisent. La
 * liste de courses elle-même est calculée par l'écran, avec les présents et
 * les régimes de chaque repas : rien n'en est stocké.
 */
@Service
public class RepasSejourService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record RepasVue(@NotNull LocalDate jour, @NotNull RepasSejour repas) {}

    public record RepasSejourVue(List<RepasVue> auRestaurant) {}

    public record DemandeRepas(@NotNull List<@Valid @NotNull RepasVue> auRestaurant) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;

    public RepasSejourService(NamedParameterJdbcTemplate jdbc, SortieService sorties) {
        this.jdbc = jdbc;
        this.sorties = sorties;
    }

    @Transactional(readOnly = true)
    public RepasSejourVue lire(Long sortieId) {
        sorties.lire(sortieId);
        return new RepasSejourVue(jdbc.query("""
                SELECT jour, repas FROM sejour_repas_au_restaurant WHERE sortie_id = :id""",
                new MapSqlParameterSource("id", sortieId),
                (rs, i) -> new RepasVue(rs.getObject("jour", LocalDate.class), RepasSejour.valueOf(rs.getString("repas"))))
                .stream()
                .sorted(Comparator.comparing(RepasVue::jour).thenComparing(RepasVue::repas))
                .toList());
    }

    /** Remplace la liste d'un bloc ; un jour hors de la sortie est refusé. */
    @Transactional
    public RepasSejourVue definir(Long sortieId, List<RepasVue> auRestaurant) {
        SortieVue sortie = sorties.lire(sortieId);
        for (RepasVue r : auRestaurant) {
            if (r.jour().isBefore(sortie.dateDebut()) || r.jour().isAfter(sortie.dateFin())) {
                throw new RegleMetierException("Le " + DATE.format(r.jour()) + " n'est pas un jour du séjour (du "
                        + DATE.format(sortie.dateDebut()) + " au " + DATE.format(sortie.dateFin()) + ").");
            }
        }
        var id = new MapSqlParameterSource("id", sortieId);
        jdbc.update("DELETE FROM sejour_repas_au_restaurant WHERE sortie_id = :id", id);
        for (RepasVue r : new LinkedHashSet<>(auRestaurant)) {
            jdbc.update("INSERT INTO sejour_repas_au_restaurant (sortie_id, jour, repas) VALUES (:id, :jour, :repas)",
                    new MapSqlParameterSource("id", sortieId).addValue("jour", r.jour()).addValue("repas", r.repas().name()));
        }
        return lire(sortieId);
    }
}
