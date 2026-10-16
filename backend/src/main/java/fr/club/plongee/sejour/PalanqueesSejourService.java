package fr.club.plongee.sejour;

import fr.club.plongee.formation.domain.FonctionPalanquee;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalTime;
import java.util.*;

/**
 * Les palanquées des plongées d'un séjour, lues sur les fiches de sécurité
 * des séances de la sortie (demande du club, 2026) : montrées dans le
 * programme, avec la fonction de chacun. Un encadrant voit toutes les
 * palanquées ; un participant seulement la sienne.
 * <p>
 * Le participant est retrouvé dans une palanquée par son dossier élève ou son
 * compte, sinon par ses nom et prénom (invité saisi à la main), comme pour
 * l'envoi des paramètres de fin de séjour.
 */
@Service
public class PalanqueesSejourService {

    /** Un plongeur d'une palanquée ; {@code moi} : c'est celui qui regarde. */
    public record MembrePalanqueeVue(String prenom, String nom, FonctionPalanquee fonction, String aptitude,
                                     String qualificationPreparee, boolean moi) {}

    /**
     * Une palanquée d'une plongée de la sortie. Profondeur et durée : le
     * réalisé s'il est saisi, sinon le prévu ({@code realise} le dit).
     */
    public record PalanqueeVue(Long seanceId, int numero, String directeurPlongee, Integer profondeur,
                               Integer duree, boolean realise, LocalTime heureImmersion,
                               List<MembrePalanqueeVue> membres) {}

    /** Qui regarde : sa ligne de participant (dossier, compte, nom et prénom). */
    record Identite(Long eleveId, Long compte, String nom, String prenom) {}

    private final NamedParameterJdbcTemplate jdbc;

    public PalanqueesSejourService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Toutes les palanquées ({@code toutes}, pour un encadrant) ou seulement
     * celles où figure le participant. Rangées par plongée puis par numéro.
     */
    @Transactional(readOnly = true)
    public List<PalanqueeVue> palanquees(Long sortieId, Long participantId, boolean toutes) {
        Identite moi = participantId == null ? null : identite(participantId);
        if (!toutes && moi == null) return List.of();

        var params = new MapSqlParameterSource("id", sortieId);
        Map<Long, List<MembrePalanqueeVue>> membres = new HashMap<>();
        jdbc.query("""
                SELECT m.palanquee_id, m.eleve_id, m.utilisateur_id, e.utilisateur_id AS compte_eleve,
                       m.nom, m.prenom, m.aptitude, m.qualification_preparee, m.fonction
                  FROM membre_palanquee m
                  JOIN palanquee pa ON pa.id = m.palanquee_id
                  JOIN fiche_securite f ON f.id = pa.fiche_securite_id
                  JOIN sortie_seance ss ON ss.seance_id = f.seance_id
                  LEFT JOIN eleve e ON e.id = m.eleve_id
                 WHERE ss.sortie_id = :id
                 ORDER BY m.id""", params, rs -> {
                    Long eleve = rs.getObject("eleve_id", Long.class);
                    Long utilisateur = rs.getObject("utilisateur_id", Long.class);
                    Long compte = utilisateur != null ? utilisateur : rs.getObject("compte_eleve", Long.class);
                    String nom = rs.getString("nom");
                    String prenom = rs.getString("prenom");
                    boolean estMoi = moi != null && correspond(moi, new Identite(eleve, compte, nom, prenom));
                    membres.computeIfAbsent(rs.getLong("palanquee_id"), k -> new ArrayList<>())
                            .add(new MembrePalanqueeVue(prenom, nom, FonctionPalanquee.valueOf(rs.getString("fonction")),
                                    rs.getString("aptitude"), rs.getString("qualification_preparee"), estMoi));
                });

        List<PalanqueeVue> liste = jdbc.query("""
                SELECT pa.*, f.seance_id, u.prenom AS dp_prenom, u.nom AS dp_nom
                  FROM palanquee pa
                  JOIN fiche_securite f ON f.id = pa.fiche_securite_id
                  JOIN sortie_seance ss ON ss.seance_id = f.seance_id
                  JOIN seance s ON s.id = f.seance_id
                  LEFT JOIN utilisateur u ON u.id = f.dp_id
                 WHERE ss.sortie_id = :id
                 ORDER BY s.date_seance, COALESCE(s.ordre, 0), s.id, pa.numero""", params, (rs, i) -> {
            Integer profR = rs.getObject("profondeur_realisee", Integer.class);
            Integer dureeR = rs.getObject("duree_realisee", Integer.class);
            boolean realise = profR != null || dureeR != null;
            String dp = rs.getString("dp_nom") == null ? null : rs.getString("dp_prenom") + " " + rs.getString("dp_nom");
            List<MembrePalanqueeVue> vues = membres.getOrDefault(rs.getLong("id"), List.of()).stream()
                    .sorted(Comparator.comparingInt((MembrePalanqueeVue m) -> rangFonction(m.fonction())))
                    .toList();
            return new PalanqueeVue(rs.getLong("seance_id"), rs.getInt("numero"), dp,
                    realise ? profR : rs.getObject("profondeur_prevue", Integer.class),
                    realise ? dureeR : rs.getObject("duree_prevue", Integer.class), realise,
                    rs.getObject("heure_immersion", LocalTime.class), vues);
        });
        if (toutes) return liste;
        return liste.stream().filter(p -> p.membres().stream().anyMatch(MembrePalanqueeVue::moi)).toList();
    }

    private Identite identite(Long participantId) {
        List<Identite> lignes = jdbc.query("""
                SELECT p.eleve_id, p.utilisateur_id, e.utilisateur_id AS compte_eleve, p.nom, p.prenom
                  FROM sejour_participant p LEFT JOIN eleve e ON e.id = p.eleve_id
                 WHERE p.id = :id""", new MapSqlParameterSource("id", participantId), (rs, i) -> {
            Long utilisateur = rs.getObject("utilisateur_id", Long.class);
            return new Identite(rs.getObject("eleve_id", Long.class),
                    utilisateur != null ? utilisateur : rs.getObject("compte_eleve", Long.class),
                    rs.getString("nom"), rs.getString("prenom"));
        });
        return lignes.isEmpty() ? null : lignes.getFirst();
    }

    /** L'encadrant, puis le guide de palanquée, puis les plongeurs. */
    private static int rangFonction(FonctionPalanquee f) {
        return switch (f) {
            case ENCADRANT -> 0;
            case GUIDE_PALANQUEE -> 1;
            case PLONGEUR -> 2;
        };
    }

    /** Même dossier élève, sinon même compte, sinon mêmes nom et prénom (sans accents ni casse). */
    static boolean correspond(Identite a, Identite b) {
        if (a.eleveId() != null && b.eleveId() != null) return a.eleveId().equals(b.eleveId());
        if (a.compte() != null && b.compte() != null) return a.compte().equals(b.compte());
        return normaliser(a.nom()).equals(normaliser(b.nom())) && normaliser(a.prenom()).equals(normaliser(b.prenom()));
    }

    private static String normaliser(String texte) {
        if (texte == null) return "";
        return Normalizer.normalize(texte, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).trim();
    }
}
