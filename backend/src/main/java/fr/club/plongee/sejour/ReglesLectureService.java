package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Les règles apprises des corrections faites après la lecture d'une note
 * (V88) : tel commerçant → telle catégorie, tel libellé de ligne → le total.
 * Communes à tout le club ; la valeur la plus souvent apprise l'emporte.
 * Les droits (qui peut saisir une dépense) sont vérifiés par
 * {@link FraisService} avant d'arriver ici.
 */
@Service
public class ReglesLectureService {

    /** Majuscules sans accents, chiffres, espaces, &, apostrophe et tiret, comme l'écran les envoie. */
    private static final Pattern ENSEIGNE = Pattern.compile("[A-Z0-9 &'-]{3,60}");
    private static final Pattern LIBELLE = Pattern.compile("[A-Z ]{3,40}");

    /** {@code categorie} et {@code libelleTotal} : ce qui a été appris (l'un ou l'autre au moins). */
    public record Lecon(String enseigne, FraisSejour.CategorieDepense categorie, String libelleTotal) {}

    /** Pour un commerçant, la catégorie et le libellé du total les plus souvent appris (null si aucun). */
    public record RegleApprise(String enseigne, FraisSejour.CategorieDepense categorie, String libelleTotal) {}

    private final NamedParameterJdbcTemplate jdbc;

    public ReglesLectureService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<RegleApprise> regles() {
        Map<String, String[]> parEnseigne = new TreeMap<>();
        jdbc.query("SELECT enseigne, sorte, valeur FROM regle_lecture_note ORDER BY nombre, maj_le, id",
                rs -> {
                    // Tri croissant : la dernière vue, la plus apprise (puis la plus récente), l'emporte.
                    String[] r = parEnseigne.computeIfAbsent(rs.getString(1), k -> new String[2]);
                    r["CATEGORIE".equals(rs.getString(2)) ? 0 : 1] = rs.getString(3);
                });
        return parEnseigne.entrySet().stream()
                .map(e -> new RegleApprise(e.getKey(),
                        e.getValue()[0] == null ? null : FraisSejour.CategorieDepense.valueOf(e.getValue()[0]),
                        e.getValue()[1]))
                .toList();
    }

    /** Sans transaction : en PostgreSQL, un INSERT refusé (doublon) rendrait la suite impossible. */
    public void apprendre(Lecon l) {
        String enseigne = l.enseigne() == null ? "" : l.enseigne().trim().replaceAll(" +", " ");
        if (!ENSEIGNE.matcher(enseigne).matches() || enseigne.replaceAll("[^A-Z]", "").length() < 3) {
            throw new RegleMetierException("Le nom du commerçant n'a pas pu être lu sur la note.");
        }
        String libelle = l.libelleTotal() == null ? null : l.libelleTotal().trim().replaceAll(" +", " ");
        if (libelle != null && !LIBELLE.matcher(libelle).matches()) {
            throw new RegleMetierException("Le libellé du total doit être fait de lettres.");
        }
        if (l.categorie() == null && libelle == null) {
            throw new RegleMetierException("Rien à apprendre de cette note.");
        }
        if (l.categorie() != null) ajouter(enseigne, "CATEGORIE", l.categorie().name());
        if (libelle != null) ajouter(enseigne, "LIBELLE_TOTAL", libelle);
    }

    private void ajouter(String enseigne, String sorte, String valeur) {
        var p = new MapSqlParameterSource("enseigne", enseigne).addValue("sorte", sorte).addValue("valeur", valeur);
        String plusUn = """
                UPDATE regle_lecture_note SET nombre = nombre + 1, maj_le = CURRENT_TIMESTAMP
                 WHERE enseigne = :enseigne AND sorte = :sorte AND valeur = :valeur""";
        if (jdbc.update(plusUn, p) > 0) return;
        try {
            jdbc.update("INSERT INTO regle_lecture_note (enseigne, sorte, valeur) VALUES (:enseigne, :sorte, :valeur)", p);
        } catch (DuplicateKeyException e) {
            // Apprise au même instant par quelqu'un d'autre : on compte une fois de plus.
            jdbc.update(plusUn, p);
        }
    }
}
