package fr.club.plongee.planning.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.AdhesionSaison;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.repository.AdhesionSaisonRepository;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.planning.domain.EspaceBassin;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.repository.EspaceBassinRepository;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Groupes d'entraînement d'une saison : composition par l'admin (nom, lignes
 * d'eau attitrées, encadrants), rangement des élèves de la saison, et
 * suggestion du groupe d'un élève d'après son cursus en cours.
 */
@Service
public class GroupeEntrainementService {

    /** {@code referent} : référent du groupe ; sinon simple encadrant attitré. */
    public record EncadrantVue(Long id, String nomComplet, String niveauEncadrement, boolean referent) {}

    public record EleveGroupeVue(Long id, String nom, String prenom) {}

    public record GroupeVue(Long id, Long saisonId, String nom, int ordre, String niveauPrepare,
                            /** Lignes attitrées dans l'ordre du bassin ; libellé « Ligne 5 + Ligne 6 », null sans ligne. */
                            List<Long> espaceAttitreIds, String espacesAttitres,
                            List<EncadrantVue> encadrants, List<EleveGroupeVue> eleves) {}

    /**
     * Un élève de la saison (cursus ou adhésion), vu depuis l'écran de
     * rangement : son groupe actuel et celui qu'on lui suggère.
     *
     * @param niveauxEnCours niveaux des cursus en cours de l'élève sur la saison
     * @param adhesionSeule  adhérent sans formation cette saison
     * @param groupeSuggereId groupe dont le niveau préparé correspond à un cursus en cours ; null sinon
     */
    public record EleveSaisonVue(Long eleveId, String nom, String prenom, List<String> niveauxEnCours,
                                 boolean adhesionSeule, Long groupeId, Long groupeSuggereId) {}

    /**
     * {@code referentIds} : référents du groupe ; {@code encadrantIds} : les autres encadrants
     * attitrés. Un moniteur cité dans les deux listes est référent.
     */
    public record DemandeGroupe(@NotNull Long saisonId, @NotBlank String nom,
                                @Pattern(regexp = "N[1-3]", message = "Niveau préparé attendu : N1, N2 ou N3.")
                                String niveauPrepare,
                                List<Long> espaceAttitreIds, List<Long> encadrantIds, List<Long> referentIds) {}

    private final GroupeEntrainementRepository groupes;
    private final EspaceBassinRepository espaces;
    private final SaisonRepository saisons;
    private final UtilisateurRepository utilisateurs;
    private final EleveRepository eleves;
    private final CursusRepository cursus;
    private final AdhesionSaisonRepository adhesions;

    public GroupeEntrainementService(GroupeEntrainementRepository groupes, EspaceBassinRepository espaces,
                                     SaisonRepository saisons, UtilisateurRepository utilisateurs,
                                     EleveRepository eleves, CursusRepository cursus,
                                     AdhesionSaisonRepository adhesions) {
        this.groupes = groupes;
        this.espaces = espaces;
        this.saisons = saisons;
        this.utilisateurs = utilisateurs;
        this.eleves = eleves;
        this.cursus = cursus;
        this.adhesions = adhesions;
    }

    /** Sans saison précisée : la saison ouverte la plus récente. */
    @Transactional(readOnly = true)
    public List<GroupeVue> lister(Long saisonId) {
        return groupes.parSaison(saison(saisonId).getId()).stream().map(this::vue).toList();
    }

    @Transactional
    public GroupeVue creer(DemandeGroupe demande) {
        Saison saison = saison(demande.saisonId());
        GroupeEntrainement g = new GroupeEntrainement();
        g.setSaison(saison);
        g.setOrdre(groupes.parSaison(saison.getId()).stream()
                .mapToInt(GroupeEntrainement::getOrdre).max().orElse(0) + 1);
        appliquer(g, demande);
        return vue(groupes.save(g));
    }

    /** La saison d'un groupe ne change pas : celle de la demande est ignorée ici. */
    @Transactional
    public GroupeVue modifier(Long id, DemandeGroupe demande) {
        GroupeEntrainement g = groupe(id);
        appliquer(g, demande);
        return vue(groupes.save(g));
    }

    @Transactional
    public void supprimer(Long id) {
        groupes.delete(groupe(id));
    }

    /** Nouvel ordre d'affichage : la liste complète des groupes de la saison, dans l'ordre voulu. */
    @Transactional
    public List<GroupeVue> ordonner(Long saisonId, List<Long> groupeIds) {
        List<GroupeEntrainement> liste = groupes.parSaison(saison(saisonId).getId());
        Map<Long, GroupeEntrainement> parId = new HashMap<>();
        liste.forEach(g -> parId.put(g.getId(), g));
        if (groupeIds == null || !new HashSet<>(groupeIds).equals(parId.keySet())) {
            throw new RegleMetierException("La liste des groupes a changé entre-temps : rechargez la page.");
        }
        for (int i = 0; i < groupeIds.size(); i++) parId.get(groupeIds.get(i)).setOrdre(i + 1);
        return lister(saisonId);
    }

    /**
     * Élèves de la saison : ceux qui y ont un cursus ou une adhésion, avec
     * leur groupe actuel et la suggestion tirée de leur cursus en cours.
     */
    @Transactional(readOnly = true)
    public List<EleveSaisonVue> elevesDeLaSaison(Long saisonId) {
        Long id = saison(saisonId).getId();
        List<GroupeEntrainement> groupesSaison = groupes.parSaison(id);

        Map<Long, Eleve> parId = new TreeMap<>();
        Map<Long, List<String>> niveaux = new HashMap<>();
        for (Cursus c : cursus.parSaison(id)) {
            parId.put(c.getEleve().getId(), c.getEleve());
            if (c.getStatut() == Cursus.Statut.EN_COURS) {
                niveaux.computeIfAbsent(c.getEleve().getId(), k -> new ArrayList<>())
                        .add(c.getReferentiel().getNiveau().name());
            }
        }
        Set<Long> avecCursus = new HashSet<>(parId.keySet());
        for (AdhesionSaison a : adhesions.parSaison(id)) parId.putIfAbsent(a.getEleve().getId(), a.getEleve());

        Map<Long, Long> groupeDeLEleve = new HashMap<>();
        for (GroupeEntrainement g : groupesSaison) {
            for (Eleve e : g.getEleves()) groupeDeLEleve.put(e.getId(), g.getId());
        }

        return parId.values().stream()
                .sorted(Comparator.comparing(Eleve::getNom, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Eleve::getPrenom, String.CASE_INSENSITIVE_ORDER))
                .map(e -> {
                    List<String> enCours = niveaux.getOrDefault(e.getId(), List.of()).stream().sorted().toList();
                    return new EleveSaisonVue(e.getId(), e.getNom(), e.getPrenom(), enCours,
                            !avecCursus.contains(e.getId()), groupeDeLEleve.get(e.getId()),
                            suggestion(enCours, groupesSaison));
                })
                .toList();
    }

    /** Range un élève dans un groupe de la saison (null : le retire de tout groupe). */
    @Transactional
    public EleveSaisonVue ranger(Long saisonId, Long eleveId, Long groupeId) {
        Long id = saison(saisonId).getId();
        Eleve eleve = eleves.findById(eleveId)
                .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable"));
        if (!cursus.existsByEleveIdAndSaisonId(eleveId, id) && !adhesions.existsByEleveIdAndSaisonId(eleveId, id)) {
            throw new RegleMetierException(
                    "Cet élève n'a ni cursus ni adhésion sur cette saison : inscrivez-le d'abord.");
        }
        List<GroupeEntrainement> groupesSaison = groupes.parSaison(id);
        GroupeEntrainement cible = null;
        if (groupeId != null) {
            cible = groupesSaison.stream().filter(g -> g.getId().equals(groupeId)).findFirst()
                    .orElseThrow(() -> new RessourceIntrouvableException("Groupe introuvable pour cette saison"));
        }
        for (GroupeEntrainement g : groupesSaison) g.getEleves().removeIf(e -> e.getId().equals(eleveId));
        if (cible != null) cible.getEleves().add(eleve);
        return elevesDeLaSaison(id).stream().filter(v -> v.eleveId().equals(eleveId)).findFirst().orElseThrow();
    }

    /** Range chaque élève encore sans groupe dans le groupe suggéré, s'il y en a un. */
    @Transactional
    public List<EleveSaisonVue> appliquerSuggestions(Long saisonId) {
        Long id = saison(saisonId).getId();
        Map<Long, GroupeEntrainement> parId = new HashMap<>();
        groupes.parSaison(id).forEach(g -> parId.put(g.getId(), g));
        for (EleveSaisonVue v : elevesDeLaSaison(id)) {
            if (v.groupeId() == null && v.groupeSuggereId() != null) {
                parId.get(v.groupeSuggereId()).getEleves().add(eleves.getReferenceById(v.eleveId()));
            }
        }
        return elevesDeLaSaison(id);
    }

    /** Premier groupe (dans l'ordre d'affichage) qui prépare un des niveaux en cours. */
    static Long suggestion(List<String> niveauxEnCours, List<GroupeEntrainement> groupesSaison) {
        return groupesSaison.stream()
                .filter(g -> g.getNiveauPrepare() != null && niveauxEnCours.contains(g.getNiveauPrepare()))
                .sorted(Comparator.comparingInt(GroupeEntrainement::getOrdre))
                .map(GroupeEntrainement::getId)
                .findFirst().orElse(null);
    }

    private void appliquer(GroupeEntrainement g, DemandeGroupe d) {
        g.setNom(d.nom().trim());
        g.setNiveauPrepare(d.niveauPrepare() == null || d.niveauPrepare().isBlank() ? null : d.niveauPrepare());
        Set<EspaceBassin> attitres = new LinkedHashSet<>();
        for (Long eid : d.espaceAttitreIds() == null ? List.<Long>of() : d.espaceAttitreIds()) {
            attitres.add(espaces.findById(eid)
                    .orElseThrow(() -> new RessourceIntrouvableException("Espace introuvable")));
        }
        g.setEspacesAttitres(attitres);
        // Un référent est aussi un encadrant attitré : le planning ne lit que cette liste-là.
        Set<Utilisateur> referents = encadrantsActifs(d.referentIds());
        Set<Utilisateur> encadrants = new LinkedHashSet<>(referents);
        encadrants.addAll(encadrantsActifs(d.encadrantIds()));
        g.setReferents(referents);
        g.setEncadrants(encadrants);
    }

    private Set<Utilisateur> encadrantsActifs(List<Long> ids) {
        Set<Utilisateur> resultat = new LinkedHashSet<>();
        for (Long uid : ids == null ? List.<Long>of() : ids) {
            Utilisateur u = utilisateurs.findById(uid)
                    .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable"));
            if (!u.isActif() || !u.estMoniteur()) {
                throw new RegleMetierException(u.nomComplet() + " n'est pas un encadrant actif.");
            }
            resultat.add(u);
        }
        return resultat;
    }

    private GroupeVue vue(GroupeEntrainement g) {
        return new GroupeVue(g.getId(), g.getSaison().getId(), g.getNom(), g.getOrdre(), g.getNiveauPrepare(),
                g.espacesAttitresOrdonnes().stream().map(EspaceBassin::getId).toList(), g.libelleEspacesAttitres(),
                g.getEncadrants().stream()
                        .map(u -> new EncadrantVue(u.getId(), u.nomComplet(),
                                u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name(),
                                g.estReferent(u)))
                        .sorted(Comparator.comparing((EncadrantVue v) -> !v.referent())
                                .thenComparing(EncadrantVue::nomComplet))
                        .toList(),
                g.getEleves().stream()
                        .sorted(Comparator.comparing(Eleve::getNom, String.CASE_INSENSITIVE_ORDER)
                                .thenComparing(Eleve::getPrenom, String.CASE_INSENSITIVE_ORDER))
                        .map(el -> new EleveGroupeVue(el.getId(), el.getNom(), el.getPrenom()))
                        .toList());
    }

    private GroupeEntrainement groupe(Long id) {
        return groupes.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Groupe introuvable"));
    }

    private Saison saison(Long saisonId) {
        return saisonId != null
                ? saisons.findById(saisonId).orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"))
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"));
    }
}
