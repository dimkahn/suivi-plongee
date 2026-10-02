package fr.club.plongee.planning.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.formation.service.FicheSecuriteService;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.planning.domain.AffectationGroupe;
import fr.club.plongee.planning.domain.DisponibiliteEncadrant;
import fr.club.plongee.planning.domain.EspaceBassin;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.domain.SoireePlanning;
import fr.club.plongee.planning.repository.AffectationGroupeRepository;
import fr.club.plongee.planning.repository.DisponibiliteEncadrantRepository;
import fr.club.plongee.planning.repository.EspaceBassinRepository;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.planning.repository.SoireePlanningRepository;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Planning des soirées d'entraînement : pour chaque date de la saison qui
 * porte des séances, où est chaque groupe (ligne d'eau, fosse, activité) et
 * qui est responsable de séance. Un groupe sans consigne pour une date est à
 * sa ligne attitrée. Chaque encadrant répond présent ou absent, soirée par
 * soirée. Les avertissements (fosse trop pleine, débutants ou E1 en fosse
 * profonde, ligne en double, groupe sans encadrant présent, pas de E3 pour
 * la fiche de sécurité) n'empêchent rien : l'admin décide.
 */
@Service
public class PlanningService {

    /**
     * Profondeur à laquelle limiter la fosse pour un groupe de débutants
     * (niveau préparé N1) ou encadré par un E1 : le « F6 » du planning du club.
     */
    public static final int PROFONDEUR_LIMITEE_DEBUTANTS = 6;

    /** ATTITREE : ligne attitrée du groupe (rien d'enregistré) ; AUCUN : pas de ligne attitrée ni de consigne. */
    public enum TypeCase { ATTITREE, ESPACE, ACTIVITE, ABSENT, AUCUN }

    /** {@code referent} : référent du groupe (faux hors d'un groupe, par exemple pour les présences). */
    public record EncadrantPlanningVue(Long id, String nomComplet, String niveauEncadrement, boolean referent) {}

    /** {@code effectif} : élèves du groupe et encadrants attitrés, pour la capacité de la fosse. */
    public record GroupePlanningVue(Long id, String nom, String niveauPrepare, Long espaceAttitreId,
                                    String espaceAttitre, int nombreEleves, int effectif,
                                    List<EncadrantPlanningVue> encadrants) {}

    public record EspacePlanningVue(Long id, String nom, String type, Integer profondeurMax, Integer capacite) {}

    /**
     * Place d'un groupe un soir donné.
     *
     * @param libelle en clair : « Ligne 3 », « Fosse (limitée à 6 m) », « Baptêmes », « Absent »
     */
    public record CaseVue(Long groupeId, String type, Long espaceId, String espace, String espaceType,
                          Integer profondeurLimitee, String activite, String libelle) {}

    /** {@code presents}, {@code absents} : réponses des encadrants ; qui n'y figure pas n'a pas répondu. */
    public record SoireeVue(LocalDate date, Long responsableId, String responsable, String note,
                            List<EncadrantPlanningVue> presents, List<EncadrantPlanningVue> absents,
                            List<CaseVue> cases, List<String> avertissements) {}

    /**
     * {@code mesGroupeIds} : groupes dont l'utilisateur connecté est encadrant
     * attitré ; {@code utilisateurId} : lui-même, pour retrouver ses réponses.
     */
    public record PlanningVue(Long saisonId, String saison, List<GroupePlanningVue> groupes,
                              List<EspacePlanningVue> espaces, List<SoireeVue> soirees, List<Long> mesGroupeIds,
                              Long utilisateurId) {}

    public record DemandeCase(@NotNull TypeCase type, Long espaceId, @Min(1) Integer profondeurLimitee,
                              @Size(max = 80) String activite) {}

    public record DemandeSoiree(Long responsableId, @Size(max = 200) String note) {}

    /** {@code reponse} vide : efface la réponse (« pas encore répondu »). */
    public record DemandeDisponibilite(DisponibiliteEncadrant.Reponse reponse) {}

    private final SaisonRepository saisons;
    private final SeanceRepository seances;
    private final GroupeEntrainementRepository groupes;
    private final EspaceBassinRepository espaces;
    private final AffectationGroupeRepository affectations;
    private final SoireePlanningRepository soirees;
    private final UtilisateurRepository utilisateurs;
    private final DisponibiliteEncadrantRepository disponibilites;

    public PlanningService(SaisonRepository saisons, SeanceRepository seances, GroupeEntrainementRepository groupes,
                           EspaceBassinRepository espaces, AffectationGroupeRepository affectations,
                           SoireePlanningRepository soirees, UtilisateurRepository utilisateurs,
                           DisponibiliteEncadrantRepository disponibilites) {
        this.saisons = saisons;
        this.seances = seances;
        this.groupes = groupes;
        this.espaces = espaces;
        this.affectations = affectations;
        this.soirees = soirees;
        this.utilisateurs = utilisateurs;
        this.disponibilites = disponibilites;
    }

    /**
     * Toutes les soirées de la saison (sans saison précisée : la saison ouverte),
     * avec les groupes que l'utilisateur connecté encadre.
     */
    @Transactional(readOnly = true)
    public PlanningVue planning(Long saisonId, Long utilisateurId) {
        Saison saison = saison(saisonId);
        Contexte ctx = contexte(saison);
        List<SoireeVue> vues = datesDesSeances(saison.getId()).stream().map(d -> soiree(ctx, d)).toList();
        return new PlanningVue(saison.getId(), saison.getLibelle(),
                ctx.groupes.stream().map(PlanningService::groupeVue).toList(),
                espaces.findAllByOrderByOrdreAscIdAsc().stream().filter(EspaceBassin::isActif)
                        .map(e -> new EspacePlanningVue(e.getId(), e.getNom(), e.getType().name(),
                                e.getProfondeurMax(), e.getCapacite()))
                        .toList(),
                vues,
                ctx.groupes.stream()
                        .filter(g -> g.getEncadrants().stream().anyMatch(u -> u.getId().equals(utilisateurId)))
                        .map(GroupeEntrainement::getId)
                        .toList(),
                utilisateurId);
    }

    /** Place d'un groupe pour une soirée ; type ATTITREE efface la consigne (retour à la ligne attitrée). */
    @Transactional
    public SoireeVue definirCase(Long saisonId, LocalDate date, Long groupeId, DemandeCase demande) {
        Saison saison = saison(saisonId);
        verifierSoiree(saison, date);
        GroupeEntrainement groupe = groupes.findById(groupeId)
                .filter(g -> g.getSaison().getId().equals(saison.getId()))
                .orElseThrow(() -> new RessourceIntrouvableException("Groupe introuvable pour cette saison"));
        Optional<AffectationGroupe> existante = affectations.findByGroupeIdAndDateSoiree(groupeId, date);

        if (demande.type() == TypeCase.ATTITREE || demande.type() == TypeCase.AUCUN) {
            existante.ifPresent(affectations::delete);
        } else {
            AffectationGroupe a = existante.orElseGet(AffectationGroupe::new);
            a.setGroupe(groupe);
            a.setDateSoiree(date);
            a.setEspace(null);
            a.setProfondeurLimitee(null);
            a.setActivite(null);
            switch (demande.type()) {
                case ESPACE -> {
                    if (demande.espaceId() == null) throw new RegleMetierException("Choisissez une ligne d'eau ou la fosse.");
                    EspaceBassin e = espaces.findById(demande.espaceId())
                            .orElseThrow(() -> new RessourceIntrouvableException("Espace introuvable"));
                    a.setType(AffectationGroupe.Type.ESPACE);
                    a.setEspace(e);
                    a.setProfondeurLimitee(demande.profondeurLimitee());
                }
                case ACTIVITE -> {
                    if (demande.activite() == null || demande.activite().isBlank()) {
                        throw new RegleMetierException("Précisez l'activité (par exemple « Baptêmes »).");
                    }
                    a.setType(AffectationGroupe.Type.ACTIVITE);
                    a.setActivite(demande.activite().trim());
                }
                default -> a.setType(AffectationGroupe.Type.ABSENT);
            }
            affectations.save(a);
        }
        return soiree(contexte(saison), date);
    }

    /** Responsable de séance et note de la soirée ; les deux vides effacent la soirée. */
    @Transactional
    public SoireeVue definirSoiree(Long saisonId, LocalDate date, DemandeSoiree demande) {
        Saison saison = saison(saisonId);
        verifierSoiree(saison, date);
        Utilisateur responsable = null;
        if (demande.responsableId() != null) {
            responsable = utilisateurs.findById(demande.responsableId())
                    .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable"));
            if (!responsable.isActif() || !responsable.estMoniteur()) {
                throw new RegleMetierException(responsable.nomComplet() + " n'est pas un encadrant actif.");
            }
        }
        String note = demande.note() == null || demande.note().isBlank() ? null : demande.note().trim();
        Optional<SoireePlanning> existante = soirees.findBySaisonIdAndDateSoiree(saison.getId(), date);
        if (responsable == null && note == null) {
            existante.ifPresent(soirees::delete);
        } else {
            SoireePlanning s = existante.orElseGet(SoireePlanning::new);
            s.setSaison(saison);
            s.setDateSoiree(date);
            s.setResponsable(responsable);
            s.setNote(note);
            soirees.save(s);
        }
        return soiree(contexte(saison), date);
    }

    /**
     * Réponse d'un encadrant pour une soirée, saisie par lui-même ou par un
     * admin ({@code saisiParId}) ; une réponse vide l'efface.
     */
    @Transactional
    public SoireeVue definirDisponibilite(Long saisonId, LocalDate date, Long utilisateurId,
                                          DisponibiliteEncadrant.Reponse reponse, Long saisiParId) {
        Saison saison = saison(saisonId);
        verifierSoiree(saison, date);
        Utilisateur encadrant = utilisateurs.findById(utilisateurId)
                .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable"));
        if (!encadrant.isActif() || !encadrant.estMoniteur()) {
            throw new RegleMetierException(encadrant.nomComplet()
                    + " n'est pas un encadrant actif : pas de présence à annoncer.");
        }
        Optional<DisponibiliteEncadrant> existante = disponibilites.findByUtilisateurIdAndDateSoiree(utilisateurId, date);
        if (reponse == null) {
            existante.ifPresent(disponibilites::delete);
        } else {
            DisponibiliteEncadrant d = existante.orElseGet(DisponibiliteEncadrant::new);
            d.setSaison(saison);
            d.setDateSoiree(date);
            d.setUtilisateur(encadrant);
            d.setReponse(reponse);
            d.setSaisiPar(saisiParId == null ? null : utilisateurs.getReferenceById(saisiParId));
            disponibilites.save(d);
        }
        return soiree(contexte(saison), date);
    }

    // ------------------------------------------------------------------

    /** Ce qu'il faut pour assembler une soirée, chargé une fois pour toute la saison. */
    private record Contexte(List<GroupeEntrainement> groupes,
                            Map<LocalDate, Map<Long, AffectationGroupe>> affectations,
                            Map<LocalDate, SoireePlanning> soirees,
                            Map<Long, Integer> capacites,
                            Map<LocalDate, List<DisponibiliteEncadrant>> disponibilites) {}

    private Contexte contexte(Saison saison) {
        Map<LocalDate, Map<Long, AffectationGroupe>> parDate = new HashMap<>();
        for (AffectationGroupe a : affectations.parSaison(saison.getId())) {
            parDate.computeIfAbsent(a.getDateSoiree(), k -> new HashMap<>()).put(a.getGroupe().getId(), a);
        }
        Map<LocalDate, SoireePlanning> soireesParDate = soirees.parSaison(saison.getId()).stream()
                .collect(Collectors.toMap(SoireePlanning::getDateSoiree, s -> s));
        Map<Long, Integer> capacites = new HashMap<>();
        for (EspaceBassin e : espaces.findAll()) {
            if (e.getCapacite() != null) capacites.put(e.getId(), e.getCapacite());
        }
        Map<LocalDate, List<DisponibiliteEncadrant>> reponses = disponibilites.parSaison(saison.getId()).stream()
                .collect(Collectors.groupingBy(DisponibiliteEncadrant::getDateSoiree));
        return new Contexte(groupes.parSaison(saison.getId()), parDate, soireesParDate, capacites, reponses);
    }

    private SoireeVue soiree(Contexte ctx, LocalDate date) {
        Map<Long, AffectationGroupe> consignes = ctx.affectations.getOrDefault(date, Map.of());
        List<CaseVue> cases = ctx.groupes.stream().map(g -> caseVue(g, consignes.get(g.getId()))).toList();
        SoireePlanning s = ctx.soirees.get(date);
        Utilisateur r = s == null ? null : s.getResponsable();
        List<DisponibiliteEncadrant> reponses = ctx.disponibilites.getOrDefault(date, List.of());
        List<Utilisateur> presents = encadrants(reponses, DisponibiliteEncadrant.Reponse.PRESENT);
        List<Utilisateur> absents = encadrants(reponses, DisponibiliteEncadrant.Reponse.ABSENT);
        List<String> avertissements = new ArrayList<>(avertissements(ctx.groupes, cases, ctx.capacites));
        avertissements.addAll(avertissementsEncadrants(ctx.groupes, cases, r, presents, absents));
        return new SoireeVue(date, r == null ? null : r.getId(), r == null ? null : r.nomComplet(),
                s == null ? null : s.getNote(),
                presents.stream().map(PlanningService::encadrantVue).toList(),
                absents.stream().map(PlanningService::encadrantVue).toList(),
                cases, avertissements);
    }

    private static List<Utilisateur> encadrants(List<DisponibiliteEncadrant> reponses,
                                                DisponibiliteEncadrant.Reponse reponse) {
        return reponses.stream().filter(d -> d.getReponse() == reponse).map(DisponibiliteEncadrant::getUtilisateur)
                .sorted(Comparator.comparing(Utilisateur::nomComplet)).toList();
    }

    /**
     * Ce que les réponses des encadrants font apparaître : un groupe qui a
     * séance mais dont tous les encadrants attitrés ont répondu absent, un
     * responsable de séance absent, et, dès qu'au moins un encadrant a
     * répondu présent, l'absence de tout E3 parmi eux (pas de directeur de
     * plongée pour la fiche de sécurité). Qui n'a pas répondu ne compte ni
     * comme présent ni comme absent.
     */
    static List<String> avertissementsEncadrants(List<GroupeEntrainement> groupesSaison, List<CaseVue> cases,
                                                 Utilisateur responsable, List<Utilisateur> presents,
                                                 List<Utilisateur> absents) {
        Set<Long> absentsIds = absents.stream().map(Utilisateur::getId).collect(Collectors.toSet());
        Map<Long, CaseVue> caseParGroupe = new HashMap<>();
        cases.forEach(c -> caseParGroupe.put(c.groupeId(), c));
        List<String> resultat = new ArrayList<>();

        for (GroupeEntrainement g : groupesSaison) {
            CaseVue c = caseParGroupe.get(g.getId());
            if (c != null && TypeCase.ABSENT.name().equals(c.type())) continue;
            if (!g.getEncadrants().isEmpty()
                    && g.getEncadrants().stream().allMatch(u -> absentsIds.contains(u.getId()))) {
                String noms = g.getEncadrants().stream().map(Utilisateur::nomComplet).sorted()
                        .collect(Collectors.joining(", "));
                resultat.add(g.getNom() + " : aucun encadrant attitré présent (" + noms + " absent"
                        + (g.getEncadrants().size() > 1 ? "s" : "") + ").");
            }
        }
        if (responsable != null && absentsIds.contains(responsable.getId())) {
            resultat.add(responsable.nomComplet() + ", responsable de séance, a répondu absent.");
        }
        if (!presents.isEmpty() && presents.stream().noneMatch(u -> u.getNiveauEncadrement() != null
                && u.getNiveauEncadrement().auMoins(FicheSecuriteService.NIVEAU_DP_MINIMUM))) {
            resultat.add("Aucun " + FicheSecuriteService.NIVEAU_DP_MINIMUM
                    + " parmi les présents : pas de directeur de plongée pour la fiche de sécurité.");
        }
        return resultat;
    }

    static CaseVue caseVue(GroupeEntrainement g, AffectationGroupe a) {
        if (a == null) {
            EspaceBassin e = g.getEspaceAttitre();
            if (e == null) return new CaseVue(g.getId(), TypeCase.AUCUN.name(), null, null, null, null, null, "À placer");
            return new CaseVue(g.getId(), TypeCase.ATTITREE.name(), e.getId(), e.getNom(), e.getType().name(),
                    null, null, e.getNom());
        }
        return switch (a.getType()) {
            case ESPACE -> new CaseVue(g.getId(), TypeCase.ESPACE.name(), a.getEspace().getId(), a.getEspace().getNom(),
                    a.getEspace().getType().name(), a.getProfondeurLimitee(), null,
                    a.getEspace().getNom() + (a.getProfondeurLimitee() == null ? ""
                            : " (limitée à " + a.getProfondeurLimitee() + " m)"));
            case ACTIVITE -> new CaseVue(g.getId(), TypeCase.ACTIVITE.name(), null, null, null, null,
                    a.getActivite(), a.getActivite());
            case ABSENT -> new CaseVue(g.getId(), TypeCase.ABSENT.name(), null, null, null, null, null, "Absent");
        };
    }

    /**
     * Ce qui mérite l'attention de l'admin pour une soirée : une fosse au-delà
     * de sa capacité (élèves et encadrants attitrés des groupes qui y sont),
     * un groupe de débutants ou encadré par un E1 en fosse sans limite de
     * profondeur, une même ligne d'eau donnée à plusieurs groupes.
     */
    static List<String> avertissements(List<GroupeEntrainement> groupesSaison, List<CaseVue> cases,
                                       Map<Long, Integer> capacites) {
        Map<Long, GroupeEntrainement> parId = new HashMap<>();
        groupesSaison.forEach(g -> parId.put(g.getId(), g));
        Map<Long, List<GroupeEntrainement>> parEspace = new LinkedHashMap<>();
        Map<Long, CaseVue> caseParEspace = new HashMap<>();
        List<String> resultat = new ArrayList<>();

        for (CaseVue c : cases) {
            if (c.espaceId() == null) continue;
            GroupeEntrainement g = parId.get(c.groupeId());
            parEspace.computeIfAbsent(c.espaceId(), k -> new ArrayList<>()).add(g);
            caseParEspace.putIfAbsent(c.espaceId(), c);

            boolean fosse = "FOSSE".equals(c.espaceType());
            boolean limitee = c.profondeurLimitee() != null && c.profondeurLimitee() <= PROFONDEUR_LIMITEE_DEBUTANTS;
            if (fosse && !limitee) {
                if ("N1".equals(g.getNiveauPrepare())) {
                    resultat.add(g.getNom() + " en " + c.espace() + " : limiter à "
                            + PROFONDEUR_LIMITEE_DEBUTANTS + " m pour des débutants.");
                } else if (g.getEncadrants().stream().anyMatch(u -> u.getNiveauEncadrement() == NiveauEncadrement.E1)) {
                    resultat.add(g.getNom() + " en " + c.espace() + " : limiter à "
                            + PROFONDEUR_LIMITEE_DEBUTANTS + " m, le groupe est encadré par un E1.");
                }
            }
        }

        for (Map.Entry<Long, List<GroupeEntrainement>> e : parEspace.entrySet()) {
            CaseVue c = caseParEspace.get(e.getKey());
            List<GroupeEntrainement> presents = e.getValue();
            String noms = presents.stream().map(GroupeEntrainement::getNom).collect(Collectors.joining(", "));
            if ("LIGNE".equals(c.espaceType()) && presents.size() > 1) {
                resultat.add(c.espace() + " donnée à plusieurs groupes : " + noms + ".");
            }
            if ("FOSSE".equals(c.espaceType())) {
                Integer capacite = capacites.get(e.getKey());
                int plongeurs = presents.stream().mapToInt(PlanningService::effectif).sum();
                if (capacite != null && plongeurs > capacite) {
                    resultat.add(c.espace() + " : " + plongeurs + " plongeurs pour " + capacite
                            + " places (" + noms + ").");
                }
            }
        }
        return resultat;
    }

    static int effectif(GroupeEntrainement g) {
        return g.getEleves().size() + g.getEncadrants().size();
    }

    private static EncadrantPlanningVue encadrantVue(Utilisateur u) {
        return encadrantVue(u, false);
    }

    private static EncadrantPlanningVue encadrantVue(Utilisateur u, boolean referent) {
        return new EncadrantPlanningVue(u.getId(), u.nomComplet(),
                u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name(), referent);
    }

    private static GroupePlanningVue groupeVue(GroupeEntrainement g) {
        EspaceBassin e = g.getEspaceAttitre();
        return new GroupePlanningVue(g.getId(), g.getNom(), g.getNiveauPrepare(),
                e == null ? null : e.getId(), e == null ? null : e.getNom(),
                g.getEleves().size(), effectif(g),
                g.getEncadrants().stream()
                        .map(u -> encadrantVue(u, g.estReferent(u)))
                        .sorted(Comparator.comparing((EncadrantPlanningVue v) -> !v.referent())
                                .thenComparing(EncadrantPlanningVue::nomComplet))
                        .toList());
    }

    private List<LocalDate> datesDesSeances(Long saisonId) {
        return seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saisonId).stream()
                .map(Seance::getDateSeance).distinct().toList();
    }

    private void verifierSoiree(Saison saison, LocalDate date) {
        if (!datesDesSeances(saison.getId()).contains(date)) {
            throw new RegleMetierException("Aucune séance le " + date.format(Calendrier.DATE_FR)
                    + " sur cette saison : créez d'abord la séance.");
        }
    }

    private Saison saison(Long saisonId) {
        return saisonId != null
                ? saisons.findById(saisonId).orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"))
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"));
    }
}
