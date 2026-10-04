package fr.club.plongee.planning.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Milieu;
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
 * qui sont le DP fosse et le DP piscine. Un groupe sans consigne pour une date est à
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
    public record GroupePlanningVue(Long id, String nom, String niveauPrepare, List<Long> espaceAttitreIds,
                                    String espacesAttitres, int nombreEleves, int effectif,
                                    List<EncadrantPlanningVue> encadrants) {}

    public record EspacePlanningVue(Long id, String nom, String type, Integer profondeurMax, Integer capacite) {}

    /** Un espace occupé par un groupe un soir donné. */
    public record EspaceCaseVue(Long id, String nom, String type) {}

    /**
     * Place d'un groupe un soir donné. {@code espaces} : tous les espaces
     * occupés (plusieurs pour un groupe attitré à plusieurs lignes) ;
     * {@code espaceId}, {@code espace}, {@code espaceType} : le premier.
     *
     * @param libelle en clair : « Ligne 3 », « Ligne 5 + Ligne 6 », « Fosse (limitée à 6 m) », « Baptêmes », « Absent »
     */
    public record CaseVue(Long groupeId, String type, Long espaceId, String espace, String espaceType,
                          List<EspaceCaseVue> espaces, Integer profondeurLimitee, String activite, String libelle) {}

    /** {@code presents}, {@code absents} : réponses des encadrants ; qui n'y figure pas n'a pas répondu. */
    public record SoireeVue(LocalDate date, Long dpFosseId, String dpFosse, Long dpPiscineId, String dpPiscine,
                            String note,
                            List<EncadrantPlanningVue> presents, List<EncadrantPlanningVue> absents,
                            List<CaseVue> cases, List<String> avertissements) {}

    /**
     * {@code mesGroupeIds} : groupes dont l'utilisateur connecté est encadrant
     * attitré ; {@code utilisateurId} : lui-même, pour retrouver ses réponses.
     */
    public record PlanningVue(Long saisonId, String saison, List<GroupePlanningVue> groupes,
                              List<EspacePlanningVue> espaces, List<SoireeVue> soirees, List<Long> mesGroupeIds,
                              Long utilisateurId) {}

    /**
     * {@code espaceIds} : une ou plusieurs lignes d'eau, ou la fosse seule ;
     * {@code espaceId} reste accepté pour un seul espace.
     */
    public record DemandeCase(@NotNull TypeCase type, Long espaceId, List<Long> espaceIds,
                              @Min(1) Integer profondeurLimitee, @Size(max = 80) String activite) {}

    public record DemandeSoiree(Long dpFosseId, Long dpPiscineId, @Size(max = 200) String note) {}

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
            a.getLignesSupplementaires().clear();
            a.setProfondeurLimitee(null);
            a.setActivite(null);
            switch (demande.type()) {
                case ESPACE -> {
                    List<EspaceBassin> choisis = espacesDemandes(demande);
                    a.setType(AffectationGroupe.Type.ESPACE);
                    a.setEspace(choisis.get(0));
                    a.getLignesSupplementaires().addAll(choisis.subList(1, choisis.size()));
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

    /**
     * Espaces d'une consigne « espace », dans l'ordre du bassin : une ou
     * plusieurs lignes d'eau, ou la fosse seule (sa profondeur limitée ne
     * vaut que pour elle).
     */
    private List<EspaceBassin> espacesDemandes(DemandeCase demande) {
        Set<Long> ids = new LinkedHashSet<>();
        if (demande.espaceIds() != null) demande.espaceIds().stream().filter(Objects::nonNull).forEach(ids::add);
        if (ids.isEmpty() && demande.espaceId() != null) ids.add(demande.espaceId());
        if (ids.isEmpty()) throw new RegleMetierException("Choisissez une ou plusieurs lignes d'eau, ou la fosse.");
        List<EspaceBassin> choisis = new ArrayList<>();
        for (Long id : ids) {
            choisis.add(espaces.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Espace introuvable")));
        }
        if (choisis.size() > 1 && choisis.stream().anyMatch(e -> e.getType() != EspaceBassin.Type.LIGNE)) {
            throw new RegleMetierException("Plusieurs espaces ne se choisissent que parmi les lignes d'eau : "
                    + "la fosse se donne seule.");
        }
        choisis.sort(Comparator.comparingInt(EspaceBassin::getOrdre).thenComparing(EspaceBassin::getId));
        return choisis;
    }

    /** DP fosse, DP piscine et note de la soirée ; les trois vides effacent la soirée. */
    @Transactional
    public SoireeVue definirSoiree(Long saisonId, LocalDate date, DemandeSoiree demande) {
        Saison saison = saison(saisonId);
        verifierSoiree(saison, date);
        Utilisateur dpFosse = encadrantActif(demande.dpFosseId());
        Utilisateur dpPiscine = encadrantActif(demande.dpPiscineId());
        String note = demande.note() == null || demande.note().isBlank() ? null : demande.note().trim();
        Optional<SoireePlanning> existante = soirees.findBySaisonIdAndDateSoiree(saison.getId(), date);
        if (dpFosse == null && dpPiscine == null && note == null) {
            existante.ifPresent(soirees::delete);
        } else {
            SoireePlanning s = existante.orElseGet(SoireePlanning::new);
            s.setSaison(saison);
            s.setDateSoiree(date);
            s.setDpFosse(dpFosse);
            s.setDpPiscine(dpPiscine);
            s.setNote(note);
            soirees.save(s);
        }
        return soiree(contexte(saison), date);
    }

    /** Encadrant actif désigné pour une soirée ; null si personne n'est désigné. */
    private Utilisateur encadrantActif(Long id) {
        if (id == null) return null;
        Utilisateur u = utilisateurs.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable"));
        if (!u.isActif() || !u.estMoniteur()) {
            throw new RegleMetierException(u.nomComplet() + " n'est pas un encadrant actif.");
        }
        return u;
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
        Utilisateur fosse = s == null ? null : s.getDpFosse();
        Utilisateur piscine = s == null ? null : s.getDpPiscine();
        List<DisponibiliteEncadrant> reponses = ctx.disponibilites.getOrDefault(date, List.of());
        List<Utilisateur> presents = encadrants(reponses, DisponibiliteEncadrant.Reponse.PRESENT);
        List<Utilisateur> absents = encadrants(reponses, DisponibiliteEncadrant.Reponse.ABSENT);
        List<String> avertissements = new ArrayList<>(avertissements(ctx.groupes, cases, ctx.capacites));
        avertissements.addAll(avertissementsEncadrants(ctx.groupes, cases, fosse, piscine, presents, absents));
        return new SoireeVue(date, fosse == null ? null : fosse.getId(), fosse == null ? null : fosse.nomComplet(),
                piscine == null ? null : piscine.getId(), piscine == null ? null : piscine.nomComplet(),
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
     * DP fosse ou DP piscine absent, et, dès qu'au moins un encadrant a
     * répondu présent, l'absence de tout E3 parmi eux (pas de directeur de
     * plongée pour la fiche de sécurité). Qui n'a pas répondu ne compte ni
     * comme présent ni comme absent.
     */
    static List<String> avertissementsEncadrants(List<GroupeEntrainement> groupesSaison, List<CaseVue> cases,
                                                 Utilisateur dpFosse, Utilisateur dpPiscine,
                                                 List<Utilisateur> presents, List<Utilisateur> absents) {
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
        if (dpFosse != null && absentsIds.contains(dpFosse.getId())) {
            resultat.add(dpFosse.nomComplet() + ", DP fosse, a répondu absent.");
        }
        if (dpPiscine != null && absentsIds.contains(dpPiscine.getId())) {
            resultat.add(dpPiscine.nomComplet() + ", DP piscine, a répondu absent.");
        }
        if (!presents.isEmpty() && presents.stream().noneMatch(u -> u.getNiveauEncadrement() != null
                && u.getNiveauEncadrement().auMoins(FicheSecuriteService.NIVEAU_DP_MINIMUM))) {
            resultat.add("Aucun " + FicheSecuriteService.NIVEAU_DP_MINIMUM
                    + " parmi les présents : pas de directeur de plongée pour la fiche de sécurité.");
        }
        return resultat;
    }

    /**
     * Sans consigne pour la soirée, le groupe est à toutes ses lignes
     * attitrées ; une consigne « espace » le met ce soir-là à la place sur
     * les espaces qu'elle désigne (la fosse, ou une ou plusieurs lignes).
     */
    static CaseVue caseVue(GroupeEntrainement g, AffectationGroupe a) {
        if (a == null) {
            List<EspaceBassin> attitres = g.espacesAttitresOrdonnes();
            if (attitres.isEmpty()) {
                return new CaseVue(g.getId(), TypeCase.AUCUN.name(), null, null, null, List.of(), null, null, "À placer");
            }
            EspaceBassin e = attitres.get(0);
            return new CaseVue(g.getId(), TypeCase.ATTITREE.name(), e.getId(), e.getNom(), e.getType().name(),
                    attitres.stream().map(PlanningService::espaceCase).toList(),
                    null, null, g.libelleEspacesAttitres());
        }
        return switch (a.getType()) {
            case ESPACE -> {
                List<EspaceBassin> occupes = a.espacesOrdonnes();
                EspaceBassin premier = occupes.get(0);
                yield new CaseVue(g.getId(), TypeCase.ESPACE.name(), premier.getId(), premier.getNom(),
                        premier.getType().name(), occupes.stream().map(PlanningService::espaceCase).toList(),
                        a.getProfondeurLimitee(), null,
                        occupes.stream().map(EspaceBassin::getNom).collect(Collectors.joining(" + "))
                                + (a.getProfondeurLimitee() == null ? ""
                                : " (limitée à " + a.getProfondeurLimitee() + " m)"));
            }
            case ACTIVITE -> new CaseVue(g.getId(), TypeCase.ACTIVITE.name(), null, null, null, List.of(), null,
                    a.getActivite(), a.getActivite());
            case ABSENT -> new CaseVue(g.getId(), TypeCase.ABSENT.name(), null, null, null, List.of(), null, null, "Absent");
        };
    }

    private static EspaceCaseVue espaceCase(EspaceBassin e) {
        return new EspaceCaseVue(e.getId(), e.getNom(), e.getType().name());
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
        Map<Long, EspaceCaseVue> espaceParId = new HashMap<>();
        List<String> resultat = new ArrayList<>();

        for (CaseVue c : cases) {
            GroupeEntrainement g = parId.get(c.groupeId());
            for (EspaceCaseVue espace : c.espaces()) {
                parEspace.computeIfAbsent(espace.id(), k -> new ArrayList<>()).add(g);
                espaceParId.putIfAbsent(espace.id(), espace);

                boolean fosse = "FOSSE".equals(espace.type());
                boolean limitee = c.profondeurLimitee() != null && c.profondeurLimitee() <= PROFONDEUR_LIMITEE_DEBUTANTS;
                if (fosse && !limitee) {
                    if ("N1".equals(g.getNiveauPrepare())) {
                        resultat.add(g.getNom() + " en " + espace.nom() + " : limiter à "
                                + PROFONDEUR_LIMITEE_DEBUTANTS + " m pour des débutants.");
                    } else if (g.getEncadrants().stream().anyMatch(u -> u.getNiveauEncadrement() == NiveauEncadrement.E1)) {
                        resultat.add(g.getNom() + " en " + espace.nom() + " : limiter à "
                                + PROFONDEUR_LIMITEE_DEBUTANTS + " m, le groupe est encadré par un E1.");
                    }
                }
            }
        }

        for (Map.Entry<Long, List<GroupeEntrainement>> e : parEspace.entrySet()) {
            EspaceCaseVue espace = espaceParId.get(e.getKey());
            List<GroupeEntrainement> presents = e.getValue();
            String noms = presents.stream().map(GroupeEntrainement::getNom).collect(Collectors.joining(", "));
            if ("LIGNE".equals(espace.type()) && presents.size() > 1) {
                resultat.add(espace.nom() + " donnée à plusieurs groupes : " + noms + ".");
            }
            if ("FOSSE".equals(espace.type())) {
                Integer capacite = capacites.get(e.getKey());
                int plongeurs = presents.stream().mapToInt(PlanningService::effectif).sum();
                if (capacite != null && plongeurs > capacite) {
                    resultat.add(espace.nom() + " : " + plongeurs + " plongeurs pour " + capacite
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
        return new GroupePlanningVue(g.getId(), g.getNom(), g.getNiveauPrepare(),
                g.espacesAttitresOrdonnes().stream().map(EspaceBassin::getId).toList(), g.libelleEspacesAttitres(),
                g.getEleves().size(), effectif(g),
                g.getEncadrants().stream()
                        .map(u -> encadrantVue(u, g.estReferent(u)))
                        .sorted(Comparator.comparing((EncadrantPlanningVue v) -> !v.referent())
                                .thenComparing(EncadrantPlanningVue::nomComplet))
                        .toList());
    }

    /**
     * Les soirées du planning : dates qui portent au moins une séance en
     * milieu artificiel (piscine, fosse). Une sortie en milieu naturel n'a ni
     * ligne d'eau ni fosse : elle n'y figure pas.
     */
    private List<LocalDate> datesDesSeances(Long saisonId) {
        return seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saisonId).stream()
                .filter(s -> s.getMilieu() == Milieu.ARTIFICIEL)
                .map(Seance::getDateSeance).distinct().toList();
    }

    private void verifierSoiree(Saison saison, LocalDate date) {
        if (!datesDesSeances(saison.getId()).contains(date)) {
            throw new RegleMetierException("Aucune séance en piscine ou en fosse le " + date.format(Calendrier.DATE_FR)
                    + " sur cette saison : le planning du bassin ne concerne que ces séances.");
        }
    }

    private Saison saison(Long saisonId) {
        return saisonId != null
                ? saisons.findById(saisonId).orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"))
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"));
    }
}
