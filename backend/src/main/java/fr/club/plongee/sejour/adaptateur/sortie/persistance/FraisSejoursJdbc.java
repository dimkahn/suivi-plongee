package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.sejour.domaine.FraisSejour;
import fr.club.plongee.sejour.domaine.FraisSejour.CategorieDepense;
import fr.club.plongee.sejour.domaine.FraisSejour.Depense;
import fr.club.plongee.sejour.domaine.FraisSejour.Part;
import fr.club.plongee.sejour.domaine.FraisSejour.Versement;
import fr.club.plongee.sejour.domaine.port.FraisSejours;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.*;

/** Tables {@code sejour_depense}, {@code sejour_depense_part}, {@code sejour_versement}, {@code sejour_depense_photo}. */
@Repository
class FraisSejoursJdbc implements FraisSejours {

    private final NamedParameterJdbcTemplate jdbc;

    FraisSejoursJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Long> participants(Long sortieId) {
        return jdbc.queryForList(
                "SELECT id FROM sejour_participant WHERE sortie_id = :id ORDER BY LOWER(nom), LOWER(prenom)",
                new MapSqlParameterSource("id", sortieId), Long.class);
    }

    @Override
    public List<Depense> depenses(Long sortieId) {
        var id = new MapSqlParameterSource("id", sortieId);
        Map<Long, List<Part>> parts = new HashMap<>();
        jdbc.query("""
                SELECT dp.depense_id, dp.participant_id, dp.parts FROM sejour_depense_part dp
                  JOIN sejour_depense d ON d.id = dp.depense_id
                  JOIN sejour_participant p ON p.id = dp.participant_id
                 WHERE d.sortie_id = :id ORDER BY p.nom, p.prenom""", id,
                rs -> { parts.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                        .add(new Part(rs.getLong(2), rs.getInt(3))); });
        Map<Long, List<Long>> photos = new HashMap<>();
        jdbc.query("""
                SELECT ph.depense_id, ph.id FROM sejour_depense_photo ph
                  JOIN sejour_depense d ON d.id = ph.depense_id
                 WHERE d.sortie_id = :id ORDER BY ph.id""", id,
                rs -> { photos.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        return jdbc.query("SELECT * FROM sejour_depense WHERE sortie_id = :id ORDER BY jour, id", id,
                (rs, i) -> new Depense(rs.getLong("id"), rs.getString("libelle"),
                        CategorieDepense.valueOf(rs.getString("categorie")),
                        rs.getLong("montant_centimes"), rs.getLong("payeur_id"),
                        rs.getObject("jour", LocalDate.class), parts.getOrDefault(rs.getLong("id"), List.of()),
                        photos.getOrDefault(rs.getLong("id"), List.of()),
                        rs.getObject("saisie_par_utilisateur_id", Long.class),
                        rs.getObject("saisie_par_participant_id", Long.class)));
    }

    @Override
    public List<Versement> versements(Long sortieId) {
        return jdbc.query("SELECT * FROM sejour_versement WHERE sortie_id = :id ORDER BY jour, id",
                new MapSqlParameterSource("id", sortieId),
                (rs, i) -> new FraisSejour.Versement(rs.getLong("id"), rs.getLong("de_id"), rs.getLong("a_id"),
                        rs.getLong("montant_centimes"), rs.getObject("jour", LocalDate.class),
                        rs.getObject("saisie_par_utilisateur_id", Long.class),
                        rs.getObject("saisie_par_participant_id", Long.class)));
    }

    @Override
    public Optional<Saisie> saisieDepense(Long sortieId, Long depenseId) {
        return saisie("sejour_depense", sortieId, depenseId);
    }

    @Override
    public Optional<Saisie> saisieVersement(Long sortieId, Long versementId) {
        return saisie("sejour_versement", sortieId, versementId);
    }

    private Optional<Saisie> saisie(String table, Long sortieId, Long id) {
        return jdbc.query("""
                SELECT saisie_par_utilisateur_id, saisie_par_participant_id
                  FROM %s WHERE id = :id AND sortie_id = :sortie""".formatted(table),
                new MapSqlParameterSource("id", id).addValue("sortie", sortieId),
                (rs, i) -> new Saisie(rs.getObject(1, Long.class), rs.getObject(2, Long.class))).stream().findFirst();
    }

    @Override
    public long creerDepense(Long sortieId, String libelle, CategorieDepense categorie, long montantCentimes,
                             Long payeurId, LocalDate jour, List<Part> parts, Saisie saisie) {
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour,
                       saisie_par_utilisateur_id, saisie_par_participant_id)
                VALUES (:sortie, :libelle, :categorie, :montant, :payeur, :jour, :parUtilisateur, :parParticipant)""",
                parametres(libelle, categorie, montantCentimes, payeurId, jour).addValue("sortie", sortieId)
                        .addValue("parUtilisateur", saisie.parUtilisateurId())
                        .addValue("parParticipant", saisie.parParticipantId()), cle, new String[]{"id"});
        long id = cle.getKey().longValue();
        ecrireParts(id, parts);
        return id;
    }

    @Override
    public void modifierDepense(Long depenseId, String libelle, CategorieDepense categorie, long montantCentimes,
                                Long payeurId, LocalDate jour, List<Part> parts) {
        jdbc.update("""
                UPDATE sejour_depense SET libelle = :libelle, categorie = :categorie, montant_centimes = :montant,
                       payeur_id = :payeur, jour = :jour WHERE id = :depense""",
                parametres(libelle, categorie, montantCentimes, payeurId, jour).addValue("depense", depenseId));
        jdbc.update("DELETE FROM sejour_depense_part WHERE depense_id = :d", new MapSqlParameterSource("d", depenseId));
        ecrireParts(depenseId, parts);
    }

    @Override
    public void supprimerDepense(Long depenseId) {
        jdbc.update("DELETE FROM sejour_depense WHERE id = :d", new MapSqlParameterSource("d", depenseId));
    }

    private static MapSqlParameterSource parametres(String libelle, CategorieDepense categorie, long montant,
                                                    Long payeurId, LocalDate jour) {
        return new MapSqlParameterSource("libelle", libelle.trim())
                .addValue("categorie", categorie.name()).addValue("montant", montant)
                .addValue("payeur", payeurId).addValue("jour", jour);
    }

    private void ecrireParts(Long depenseId, List<Part> parts) {
        for (Part p : parts) {
            jdbc.update("INSERT INTO sejour_depense_part (depense_id, participant_id, parts) VALUES (:d, :p, :n)",
                    new MapSqlParameterSource("d", depenseId).addValue("p", p.participantId()).addValue("n", p.parts()));
        }
    }

    @Override
    public void creerVersement(Long sortieId, Long deId, Long aId, long montantCentimes, LocalDate jour, Saisie saisie) {
        jdbc.update("""
                INSERT INTO sejour_versement (sortie_id, de_id, a_id, montant_centimes, jour,
                       saisie_par_utilisateur_id, saisie_par_participant_id)
                VALUES (:sortie, :de, :a, :montant, :jour, :parUtilisateur, :parParticipant)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("de", deId).addValue("a", aId)
                        .addValue("montant", montantCentimes).addValue("jour", jour)
                        .addValue("parUtilisateur", saisie.parUtilisateurId())
                        .addValue("parParticipant", saisie.parParticipantId()));
    }

    @Override
    public void supprimerVersement(Long versementId) {
        jdbc.update("DELETE FROM sejour_versement WHERE id = :v", new MapSqlParameterSource("v", versementId));
    }

    @Override
    public int photos(Long depenseId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sejour_depense_photo WHERE depense_id = :d",
                new MapSqlParameterSource("d", depenseId), Integer.class);
    }

    @Override
    public void ajouterPhoto(Long depenseId, byte[] contenu, String type) {
        jdbc.update("INSERT INTO sejour_depense_photo (depense_id, contenu, type_contenu) VALUES (:d, :contenu, :type)",
                new MapSqlParameterSource("d", depenseId).addValue("contenu", contenu).addValue("type", type));
    }

    @Override
    public boolean supprimerPhoto(Long depenseId, Long photoId) {
        return jdbc.update("DELETE FROM sejour_depense_photo WHERE id = :p AND depense_id = :d",
                new MapSqlParameterSource("p", photoId).addValue("d", depenseId)) > 0;
    }

    @Override
    public Optional<ContenuPhoto> photo(Long sortieId, Long depenseId, Long photoId) {
        return jdbc.query("""
                SELECT ph.contenu, ph.type_contenu FROM sejour_depense_photo ph
                  JOIN sejour_depense d ON d.id = ph.depense_id
                 WHERE ph.id = :p AND d.id = :d AND d.sortie_id = :sortie""",
                new MapSqlParameterSource("p", photoId).addValue("d", depenseId).addValue("sortie", sortieId),
                (rs, i) -> new ContenuPhoto(rs.getBytes(1), rs.getString(2))).stream().findFirst();
    }
}
