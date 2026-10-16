package fr.club.plongee.sejour.adaptateur.sortie.persistance;

import fr.club.plongee.sejour.domaine.Affaire;
import fr.club.plongee.sejour.domaine.CategorieAffaire;
import fr.club.plongee.sejour.domaine.Evenement;
import fr.club.plongee.sejour.domaine.FicheAffaire;
import fr.club.plongee.sejour.domaine.FicheEvenement;
import fr.club.plongee.sejour.domaine.GroupePropose;
import fr.club.plongee.sejour.domaine.Organisateur;
import fr.club.plongee.sejour.domaine.PlongeurGroupe;
import fr.club.plongee.sejour.domaine.ResumeSejour;
import fr.club.plongee.sejour.domaine.port.Sejours;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static fr.club.plongee.sejour.domaine.Textes.nettoyer;

/** Tables {@code sejour}, {@code sejour_organisateur}, {@code sejour_affaire}, {@code sejour_evenement} (V75, V80). */
@Repository
class SejoursJdbc implements Sejours {

    private final NamedParameterJdbcTemplate jdbc;

    SejoursJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ResumeSejour> resumes(Long moi, LocalDate depuis, boolean toutes) {
        var params = new MapSqlParameterSource("moi", moi).addValue("depuis", depuis).addValue("toutes", toutes);
        return jdbc.query("""
                SELECT s.id, s.nom, s.lieu, s.date_debut, s.date_fin,
                       (SELECT COUNT(*) FROM sejour_participant p WHERE p.sortie_id = s.id) AS nombre,
                       (SELECT COUNT(*) FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                         WHERE p.sortie_id = s.id
                           AND (p.utilisateur_id = :moi OR e.utilisateur_id = :moi)) AS moi
                  FROM sortie s
                 WHERE (:toutes = TRUE OR s.date_fin >= :depuis)
                 ORDER BY s.date_debut DESC, s.id DESC""", params, (rs, i) -> new ResumeSejour(
                rs.getLong("id"), rs.getString("nom"), rs.getString("lieu"),
                rs.getObject("date_debut", LocalDate.class), rs.getObject("date_fin", LocalDate.class),
                rs.getInt("nombre"), rs.getInt("moi") > 0));
    }

    @Override
    public String infosPratiques(Long sortieId) {
        List<String> infos = jdbc.queryForList("SELECT infos_pratiques FROM sejour WHERE sortie_id = :id",
                new MapSqlParameterSource("id", sortieId), String.class);
        return infos.isEmpty() ? null : infos.getFirst();
    }

    @Override
    public void definirInfos(Long sortieId, String infos) {
        var p = new MapSqlParameterSource("id", sortieId).addValue("infos", nettoyer(infos));
        // La ligne garde aussi le code de l'adresse des frais (V77) : on ne la remplace pas.
        if (jdbc.update("UPDATE sejour SET infos_pratiques = :infos WHERE sortie_id = :id", p) == 0) {
            jdbc.update("INSERT INTO sejour (sortie_id, infos_pratiques) VALUES (:id, :infos)", p);
        }
    }

    @Override
    public boolean organise(Long sortieId, Long utilisateurId) {
        Integer n = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM sejour WHERE sortie_id = :sortie AND createur_id = :moi)
                     + (SELECT COUNT(*) FROM sejour_organisateur WHERE sortie_id = :sortie AND utilisateur_id = :moi)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("moi", utilisateurId), Integer.class);
        return n != null && n > 0;
    }

    @Override
    public boolean estCreateur(Long sortieId, Long utilisateurId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM sejour WHERE sortie_id = :sortie AND createur_id = :moi",
                new MapSqlParameterSource("sortie", sortieId).addValue("moi", utilisateurId), Integer.class);
        return n != null && n > 0;
    }

    @Override
    public List<Organisateur> organisateurs(Long sortieId) {
        var id = new MapSqlParameterSource("id", sortieId);
        List<Long> createur = createur(sortieId);
        return jdbc.query("""
                SELECT id, prenom, nom FROM utilisateur
                 WHERE id IN (SELECT createur_id FROM sejour WHERE sortie_id = :id)
                    OR id IN (SELECT utilisateur_id FROM sejour_organisateur WHERE sortie_id = :id)""", id,
                (rs, i) -> new Organisateur(rs.getLong("id"), rs.getString("prenom") + " " + rs.getString("nom"),
                        createur.contains(rs.getLong("id"))));
    }

    @Override
    public List<Long> createur(Long sortieId) {
        return jdbc.queryForList("SELECT createur_id FROM sejour WHERE sortie_id = :id AND createur_id IS NOT NULL",
                new MapSqlParameterSource("id", sortieId), Long.class);
    }

    @Override
    public void noterCreateur(Long sortieId, Long utilisateurId) {
        var p = new MapSqlParameterSource("id", sortieId).addValue("moi", utilisateurId);
        if (jdbc.update("UPDATE sejour SET createur_id = :moi WHERE sortie_id = :id", p) == 0) {
            jdbc.update("INSERT INTO sejour (sortie_id, createur_id) VALUES (:id, :moi)", p);
        }
    }

    @Override
    public List<Long> encadrantsActifs(Collection<Long> utilisateurIds) {
        if (utilisateurIds.isEmpty()) return List.of();
        return jdbc.queryForList("""
                SELECT DISTINCT u.id FROM utilisateur u JOIN utilisateur_role r ON r.utilisateur_id = u.id
                 WHERE u.id IN (:ids) AND u.actif = TRUE
                   AND r.role IN ('MONITEUR', 'ADMIN', 'DIRECTEUR_TECHNIQUE')""",
                new MapSqlParameterSource("ids", utilisateurIds), Long.class);
    }

    @Override
    public void remplacerOrganisateurs(Long sortieId, Collection<Long> utilisateurIds) {
        jdbc.update("DELETE FROM sejour_organisateur WHERE sortie_id = :id", new MapSqlParameterSource("id", sortieId));
        for (Long u : utilisateurIds) {
            jdbc.update("INSERT INTO sejour_organisateur (sortie_id, utilisateur_id) VALUES (:id, :u)",
                    new MapSqlParameterSource("id", sortieId).addValue("u", u));
        }
    }

    @Override
    public List<Affaire> affaires(Long sortieId) {
        return jdbc.query("SELECT * FROM sejour_affaire WHERE sortie_id = :id ORDER BY ordre, id",
                new MapSqlParameterSource("id", sortieId),
                (rs, i) -> new Affaire(rs.getLong("id"), CategorieAffaire.valueOf(rs.getString("categorie")),
                        rs.getString("libelle"), rs.getBoolean("indispensable")));
    }

    @Override
    public void remplacerAffaires(Long sortieId, List<FicheAffaire> affaires) {
        jdbc.update("DELETE FROM sejour_affaire WHERE sortie_id = :sortie", new MapSqlParameterSource("sortie", sortieId));
        int ordre = 0;
        for (FicheAffaire a : affaires) {
            jdbc.update("""
                    INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
                    VALUES (:sortie, :categorie, :libelle, :indispensable, :ordre)""",
                    new MapSqlParameterSource("sortie", sortieId).addValue("categorie", a.categorie().name())
                            .addValue("libelle", a.libelle().trim()).addValue("indispensable", a.indispensable())
                            .addValue("ordre", ordre++));
        }
    }

    @Override
    public List<Evenement> evenements(Long sortieId) {
        return jdbc.query("SELECT * FROM sejour_evenement WHERE sortie_id = :id", new MapSqlParameterSource("id", sortieId),
                (rs, i) -> new Evenement(rs.getLong("id"), rs.getObject("jour", LocalDate.class),
                        rs.getObject("heure_debut", LocalTime.class), rs.getObject("heure_fin", LocalTime.class),
                        rs.getString("titre"), rs.getString("lieu"), rs.getString("details")));
    }

    @Override
    public boolean evenementDuSejour(Long sortieId, Long evenementId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sejour_evenement WHERE id = :x AND sortie_id = :sortie",
                new MapSqlParameterSource("x", evenementId).addValue("sortie", sortieId), Integer.class) > 0;
    }

    @Override
    public void creerEvenement(Long sortieId, FicheEvenement d) {
        jdbc.update("""
                INSERT INTO sejour_evenement (sortie_id, jour, heure_debut, heure_fin, titre, lieu, details)
                VALUES (:sortie, :jour, :debut, :fin, :titre, :lieu, :details)""", parametres(d).addValue("sortie", sortieId));
    }

    @Override
    public void modifierEvenement(Long evenementId, FicheEvenement d) {
        jdbc.update("""
                UPDATE sejour_evenement SET jour = :jour, heure_debut = :debut, heure_fin = :fin, titre = :titre,
                       lieu = :lieu, details = :details WHERE id = :evenement""",
                parametres(d).addValue("evenement", evenementId));
    }

    @Override
    public void supprimerEvenement(Long evenementId) {
        jdbc.update("DELETE FROM sejour_evenement WHERE id = :e", new MapSqlParameterSource("e", evenementId));
    }

    private static MapSqlParameterSource parametres(FicheEvenement d) {
        return new MapSqlParameterSource("jour", d.jour())
                .addValue("debut", d.heureDebut()).addValue("fin", d.heureFin())
                .addValue("titre", d.titre().trim()).addValue("lieu", nettoyer(d.lieu()))
                .addValue("details", nettoyer(d.details()));
    }

    @Override
    public List<GroupePropose> groupesDeLaSaison(LocalDate jour) {
        var saison = new MapSqlParameterSource("debut", jour);
        Map<Long, List<PlongeurGroupe>> plongeurs = new HashMap<>();
        jdbc.query("""
                SELECT m.*, COALESCE(m.email, e.email, u.email) AS email_effectif
                  FROM membre_groupe_plongeurs m
                  JOIN groupe_plongeurs g ON g.id = m.groupe_id JOIN saison s ON s.id = g.saison_id
                  LEFT JOIN eleve e ON e.id = m.eleve_id LEFT JOIN utilisateur u ON u.id = m.utilisateur_id
                 WHERE :debut BETWEEN s.date_debut AND s.date_fin
                 ORDER BY LOWER(m.nom), LOWER(m.prenom)""", saison,
                rs -> {
                    plongeurs.computeIfAbsent(rs.getLong("groupe_id"), k -> new ArrayList<>()).add(new PlongeurGroupe(
                            rs.getLong("id"), rs.getObject("eleve_id", Long.class),
                            rs.getObject("utilisateur_id", Long.class), rs.getString("nom"), rs.getString("prenom"),
                            rs.getString("email_effectif"), rs.getString("aptitude")));
                });
        return jdbc.query("""
                SELECT g.id, g.nom FROM groupe_plongeurs g JOIN saison s ON s.id = g.saison_id
                 WHERE :debut BETWEEN s.date_debut AND s.date_fin
                 ORDER BY g.nom""", saison,
                (rs, i) -> {
                    List<PlongeurGroupe> liste = plongeurs.getOrDefault(rs.getLong("id"), List.of());
                    return new GroupePropose(rs.getLong("id"), rs.getString("nom"), liste.size(), liste);
                });
    }
}
