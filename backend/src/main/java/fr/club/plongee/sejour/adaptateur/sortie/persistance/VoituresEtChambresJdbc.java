package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.sejour.domaine.Chambre;
import fr.club.plongee.sejour.domaine.FicheChambre;
import fr.club.plongee.sejour.domaine.FicheLogement;
import fr.club.plongee.sejour.domaine.FicheVoiture;
import fr.club.plongee.sejour.domaine.Logement;
import fr.club.plongee.sejour.domaine.Voiture;
import fr.club.plongee.sejour.domaine.port.VoituresEtChambres;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.util.*;

import static fr.club.plongee.sejour.domaine.Textes.nettoyer;

/** Tables {@code sejour_voiture}, {@code sejour_voiture_passager}, {@code sejour_logement}, {@code sejour_chambre}, {@code sejour_chambre_occupant}. */
@Repository
class VoituresEtChambresJdbc implements VoituresEtChambres {

    private final NamedParameterJdbcTemplate jdbc;

    VoituresEtChambresJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------
    //  Voitures
    // ------------------------------------------------------------------

    @Override
    public List<Voiture> voitures(Long sortieId) {
        var id = new MapSqlParameterSource("id", sortieId);
        Map<Long, List<Long>> passagers = new HashMap<>();
        jdbc.query("""
                SELECT vp.voiture_id, vp.participant_id
                  FROM sejour_voiture_passager vp
                  JOIN sejour_voiture v ON v.id = vp.voiture_id
                  JOIN sejour_participant p ON p.id = vp.participant_id
                 WHERE v.sortie_id = :id
                 ORDER BY p.nom, p.prenom""", id,
                rs -> { passagers.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        return jdbc.query("SELECT * FROM sejour_voiture WHERE sortie_id = :id ORDER BY id", id,
                (rs, i) -> new Voiture(rs.getLong("id"), rs.getString("nom"), rs.getInt("places"),
                        rs.getObject("conducteur_id", Long.class), rs.getString("trajet"),
                        rs.getString("remarques"), passagers.getOrDefault(rs.getLong("id"), List.of())));
    }

    @Override
    public boolean voitureDuSejour(Long sortieId, Long voitureId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sejour_voiture WHERE id = :x AND sortie_id = :sortie",
                new MapSqlParameterSource("x", voitureId).addValue("sortie", sortieId), Integer.class) > 0;
    }

    @Override
    public void creerVoiture(Long sortieId, FicheVoiture d, List<Long> passagers) {
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO sejour_voiture (sortie_id, nom, places, conducteur_id, trajet, remarques)
                VALUES (:sortie, :nom, :places, :conducteur, :trajet, :remarques)""",
                parametres(d).addValue("sortie", sortieId), cle, new String[]{"id"});
        ecrirePassagers(cle.getKey().longValue(), passagers);
    }

    @Override
    public void modifierVoiture(Long voitureId, FicheVoiture d, List<Long> passagers) {
        jdbc.update("""
                UPDATE sejour_voiture SET nom = :nom, places = :places, conducteur_id = :conducteur,
                       trajet = :trajet, remarques = :remarques WHERE id = :voiture""",
                parametres(d).addValue("voiture", voitureId));
        jdbc.update("DELETE FROM sejour_voiture_passager WHERE voiture_id = :v", new MapSqlParameterSource("v", voitureId));
        ecrirePassagers(voitureId, passagers);
    }

    @Override
    public void supprimerVoiture(Long voitureId) {
        jdbc.update("DELETE FROM sejour_voiture WHERE id = :v", new MapSqlParameterSource("v", voitureId));
    }

    @Override
    public List<PlaceEnVoiture> placesEnVoiture(Long sortieId, Long exclue, Collection<Long> participantIds) {
        if (participantIds.isEmpty()) return List.of();
        MapSqlParameterSource p = new MapSqlParameterSource("sortie", sortieId).addValue("ids", participantIds)
                .addValue("voiture", exclue == null ? -1L : exclue);
        return jdbc.query("""
                SELECT pa.prenom || ' ' || pa.nom AS qui, v.nom AS voiture, 'conducteur' AS role
                  FROM sejour_voiture v JOIN sejour_participant pa ON pa.id = v.conducteur_id
                 WHERE v.sortie_id = :sortie AND v.id <> :voiture AND v.conducteur_id IN (:ids)
                UNION ALL
                SELECT pa.prenom || ' ' || pa.nom, v.nom, 'passager'
                  FROM sejour_voiture_passager vp
                  JOIN sejour_voiture v ON v.id = vp.voiture_id
                  JOIN sejour_participant pa ON pa.id = vp.participant_id
                 WHERE v.sortie_id = :sortie AND v.id <> :voiture AND vp.participant_id IN (:ids)""",
                p, (rs, i) -> new PlaceEnVoiture(rs.getString(1), rs.getString(2), rs.getString(3)));
    }

    private static MapSqlParameterSource parametres(FicheVoiture d) {
        return new MapSqlParameterSource("nom", d.nom().trim())
                .addValue("places", d.places()).addValue("conducteur", d.conducteurId())
                .addValue("trajet", nettoyer(d.trajet())).addValue("remarques", nettoyer(d.remarques()));
    }

    private void ecrirePassagers(Long voitureId, List<Long> passagers) {
        for (Long p : passagers) {
            jdbc.update("INSERT INTO sejour_voiture_passager (voiture_id, participant_id) VALUES (:v, :p)",
                    new MapSqlParameterSource("v", voitureId).addValue("p", p));
        }
    }

    // ------------------------------------------------------------------
    //  Logements et chambres
    // ------------------------------------------------------------------

    @Override
    public List<Logement> logements(Long sortieId) {
        var id = new MapSqlParameterSource("id", sortieId);
        Map<Long, List<Long>> occupants = new HashMap<>();
        jdbc.query("""
                SELECT o.chambre_id, o.participant_id
                  FROM sejour_chambre_occupant o
                  JOIN sejour_chambre c ON c.id = o.chambre_id
                  JOIN sejour_logement l ON l.id = c.logement_id
                  JOIN sejour_participant p ON p.id = o.participant_id
                 WHERE l.sortie_id = :id
                 ORDER BY p.nom, p.prenom""", id,
                rs -> { occupants.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)); });
        Map<Long, List<Chambre>> chambres = new HashMap<>();
        jdbc.query("""
                SELECT c.* FROM sejour_chambre c JOIN sejour_logement l ON l.id = c.logement_id
                 WHERE l.sortie_id = :id ORDER BY c.ordre, c.id""", id,
                rs -> {
                    chambres.computeIfAbsent(rs.getLong("logement_id"), k -> new ArrayList<>())
                            .add(new Chambre(rs.getLong("id"), rs.getString("nom"), rs.getInt("couchages"),
                                    rs.getString("remarques"), occupants.getOrDefault(rs.getLong("id"), List.of())));
                });
        return jdbc.query("SELECT * FROM sejour_logement WHERE sortie_id = :id ORDER BY id", id,
                (rs, i) -> new Logement(rs.getLong("id"), rs.getString("nom"), rs.getString("adresse"),
                        rs.getString("remarques"), chambres.getOrDefault(rs.getLong("id"), List.of())));
    }

    @Override
    public boolean logementDuSejour(Long sortieId, Long logementId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sejour_logement WHERE id = :x AND sortie_id = :sortie",
                new MapSqlParameterSource("x", logementId).addValue("sortie", sortieId), Integer.class) > 0;
    }

    @Override
    public void creerLogement(Long sortieId, FicheLogement d) {
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("INSERT INTO sejour_logement (sortie_id, nom, adresse, remarques) VALUES (:sortie, :nom, :adresse, :remarques)",
                parametres(d).addValue("sortie", sortieId), cle, new String[]{"id"});
        ecrireChambres(cle.getKey().longValue(), d.chambres());
    }

    @Override
    public void modifierLogement(Long logementId, FicheLogement d) {
        jdbc.update("UPDATE sejour_logement SET nom = :nom, adresse = :adresse, remarques = :remarques WHERE id = :logement",
                parametres(d).addValue("logement", logementId));
        jdbc.update("DELETE FROM sejour_chambre WHERE logement_id = :l", new MapSqlParameterSource("l", logementId));
        ecrireChambres(logementId, d.chambres());
    }

    @Override
    public void supprimerLogement(Long logementId) {
        jdbc.update("DELETE FROM sejour_logement WHERE id = :l", new MapSqlParameterSource("l", logementId));
    }

    @Override
    public List<Couchage> couchages(Long sortieId, Long exclu, Collection<Long> participantIds) {
        if (participantIds.isEmpty()) return List.of();
        var p = new MapSqlParameterSource("sortie", sortieId).addValue("ids", participantIds)
                .addValue("logement", exclu == null ? -1L : exclu);
        return jdbc.query("""
                SELECT p.prenom, p.nom, c.nom AS chambre, l.nom AS logement FROM sejour_chambre_occupant o
                  JOIN sejour_participant p ON p.id = o.participant_id
                  JOIN sejour_chambre c ON c.id = o.chambre_id
                  JOIN sejour_logement l ON l.id = c.logement_id
                 WHERE l.sortie_id = :sortie AND l.id <> :logement AND o.participant_id IN (:ids)""", p,
                (rs, i) -> new Couchage(rs.getString("prenom"), rs.getString("nom"), rs.getString("chambre"),
                        rs.getString("logement")));
    }

    private static MapSqlParameterSource parametres(FicheLogement d) {
        return new MapSqlParameterSource("nom", d.nom().trim())
                .addValue("adresse", nettoyer(d.adresse())).addValue("remarques", nettoyer(d.remarques()));
    }

    private void ecrireChambres(Long logementId, List<FicheChambre> chambres) {
        if (chambres == null) return;
        int ordre = 0;
        for (FicheChambre c : chambres) {
            KeyHolder cle = new GeneratedKeyHolder();
            jdbc.update("""
                    INSERT INTO sejour_chambre (logement_id, nom, couchages, remarques, ordre)
                    VALUES (:logement, :nom, :couchages, :remarques, :ordre)""",
                    new MapSqlParameterSource("logement", logementId).addValue("nom", c.nom().trim())
                            .addValue("couchages", c.couchages()).addValue("remarques", nettoyer(c.remarques()))
                            .addValue("ordre", ordre++), cle, new String[]{"id"});
            long chambreId = cle.getKey().longValue();
            for (Long o : c.occupantIds() == null ? List.<Long>of() : c.occupantIds().stream().distinct().toList()) {
                jdbc.update("INSERT INTO sejour_chambre_occupant (chambre_id, participant_id) VALUES (:c, :p)",
                        new MapSqlParameterSource("c", chambreId).addValue("p", o));
            }
        }
    }
}
