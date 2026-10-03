package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.ExerciceSeance;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.ExerciceSeanceRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.planning.repository.GroupeEntrainementRepository;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.CritereRepository;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Programme d'exercices d'une séance, préparé par un moniteur. Chaque
 * exercice vise une formation (version du MFT) et les critères qu'il fait
 * travailler : la fiche de suivi d'un élève présent les met en avant, et la
 * notation groupée peut les reprendre. Chaque groupe d'entraînement prépare
 * son propre programme ; un programme commun sert les séances sans groupe. Le programme ne note personne :
 * l'évaluation reste un geste du moniteur, critère par critère.
 */
@Service
public class ProgrammeSeanceService {

    /** Au-delà, c'est plus probablement une erreur qu'une séance. */
    public static final int EXERCICES_MAX = 40;
    private static final int DUREE_MAX_MINUTES = 600;

    public record CritereExerciceVue(Long id, Long blocId, String bloc, String savoirFaire) {}

    /** {@code groupeId} null : exercice du programme commun à toute la séance. */
    public record ExerciceVue(Long id, Long groupeId, int ordre, String intitule, String consignes,
                              Integer dureeMinutes, Long referentielId, String niveau,
                              List<CritereExerciceVue> criteres) {}

    /** Une formation proposée pour les exercices : celles des élèves de la saison, puis les versions actives. */
    public record FormationVue(Long referentielId, String niveau, String versionMft, int eleves) {}

    /**
     * Un groupe d'entraînement de la saison de la séance. {@code modifiable} :
     * l'utilisateur peut préparer son programme (encadrant attitré ou admin) ;
     * {@code mien} : il en est encadrant attitré.
     */
    public record GroupeProgrammeVue(Long id, String nom, String niveauPrepare, int eleves,
                                     boolean modifiable, boolean mien) {}

    public record ProgrammeVue(Long seanceId, List<FormationVue> formations, List<GroupeProgrammeVue> groupes,
                               List<ExerciceVue> exercices) {}

    public record DemandeExercice(String intitule, String consignes, Integer dureeMinutes,
                                  Long referentielId, List<Long> critereIds) {}

    private final SeanceRepository seances;
    private final ExerciceSeanceRepository exercices;
    private final ReferentielRepository referentiels;
    private final CritereRepository criteres;
    private final CursusRepository cursus;
    private final GroupeEntrainementRepository groupes;

    public ProgrammeSeanceService(SeanceRepository seances, ExerciceSeanceRepository exercices,
                                  ReferentielRepository referentiels, CritereRepository criteres,
                                  CursusRepository cursus, GroupeEntrainementRepository groupes) {
        this.seances = seances;
        this.exercices = exercices;
        this.referentiels = referentiels;
        this.criteres = criteres;
        this.cursus = cursus;
        this.groupes = groupes;
    }

    @Transactional(readOnly = true)
    public ProgrammeVue programme(Long seanceId, UtilisateurPrincipal moi) {
        Seance seance = seance(seanceId);
        List<GroupeProgrammeVue> groupesVue = groupes.parSaison(seance.getSaison().getId()).stream()
                .map(g -> {
                    boolean mien = estEncadrant(g, moi);
                    return new GroupeProgrammeVue(g.getId(), g.getNom(), g.getNiveauPrepare(), g.getEleves().size(),
                            mien || estAdmin(moi), mien);
                })
                .toList();
        return new ProgrammeVue(seanceId, formations(seance), groupesVue,
                exercices.deLaSeance(seanceId).stream().map(ProgrammeSeanceService::vue).toList());
    }

    /**
     * Remplace le programme d'un groupe pour la séance ({@code groupeId}
     * null : le programme commun) par la liste reçue, dans son ordre ; les
     * programmes des autres groupes ne bougent pas. Tout ou rien : une ligne
     * refusée n'enregistre aucune des autres. Le programme d'un groupe est
     * préparé par ses encadrants attitrés (référents compris) ou un admin.
     */
    @Transactional
    public ProgrammeVue enregistrer(Long seanceId, Long groupeId, List<DemandeExercice> demandes,
                                    UtilisateurPrincipal moi) {
        Seance seanceAvant = seance(seanceId);
        if (groupeId != null) {
            GroupeEntrainement g = groupes.findById(groupeId)
                    .orElseThrow(() -> new RessourceIntrouvableException("Groupe introuvable"));
            if (!g.getSaison().getId().equals(seanceAvant.getSaison().getId())) {
                throw new RegleMetierException("Le groupe « " + g.getNom()
                        + " » n'appartient pas à la saison de cette séance.");
            }
            if (!estEncadrant(g, moi) && !estAdmin(moi)) {
                throw new RegleMetierException("Seuls les encadrants du groupe « " + g.getNom()
                        + " » et les administrateurs préparent son programme d'exercices.");
            }
        }
        List<DemandeExercice> liste = demandes == null ? List.of() : demandes;
        if (liste.size() > EXERCICES_MAX) {
            throw new RegleMetierException("Un programme compte au plus " + EXERCICES_MAX + " exercices.");
        }

        Map<Long, Referentiel> refs = referentiels.findAllById(liste.stream()
                        .map(DemandeExercice::referentielId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Referentiel::getId, Function.identity()));
        Set<Long> idsCriteres = liste.stream()
                .flatMap(d -> d.critereIds() == null ? java.util.stream.Stream.<Long>empty() : d.critereIds().stream())
                .collect(Collectors.toSet());
        Map<Long, Critere> criteresConnus = criteres.findAllById(idsCriteres).stream()
                .collect(Collectors.toMap(Critere::getId, Function.identity()));

        List<ExerciceSeance> nouveaux = new ArrayList<>();
        int ordre = 1;
        for (DemandeExercice d : liste) {
            String intitule = d.intitule() == null ? "" : d.intitule().trim();
            if (intitule.isEmpty()) {
                throw new RegleMetierException("Chaque exercice doit avoir un intitulé (exercice n° " + ordre + ").");
            }
            if (intitule.length() > 200) {
                throw new RegleMetierException("L'intitulé de l'exercice « " + intitule.substring(0, 40)
                        + "… » est trop long (200 caractères au plus) : mettez le détail dans les consignes.");
            }
            if (d.dureeMinutes() != null && (d.dureeMinutes() <= 0 || d.dureeMinutes() > DUREE_MAX_MINUTES)) {
                throw new RegleMetierException("La durée de l'exercice « " + intitule
                        + " » doit être comprise entre 1 et " + DUREE_MAX_MINUTES + " minutes.");
            }

            Referentiel ref = null;
            if (d.referentielId() != null) {
                ref = refs.get(d.referentielId());
                if (ref == null) throw new RessourceIntrouvableException("Referentiel introuvable");
            }
            List<Long> ids = d.critereIds() == null ? List.of() : d.critereIds();
            if (!ids.isEmpty() && ref == null) {
                throw new RegleMetierException("Choisissez la formation de l'exercice « " + intitule
                        + " » avant de lui associer des critères.");
            }

            ExerciceSeance e = new ExerciceSeance();
            e.setReferentiel(ref);
            e.setOrdre(ordre++);
            e.setIntitule(intitule);
            e.setConsignes(d.consignes() == null || d.consignes().isBlank() ? null : d.consignes().trim());
            e.setDureeMinutes(d.dureeMinutes());
            for (Long id : ids) {
                Critere c = criteresConnus.get(id);
                if (c == null) throw new RessourceIntrouvableException("Critère introuvable");
                if (!c.getBloc().getReferentiel().getId().equals(ref.getId())) {
                    throw new RegleMetierException("Le critère « " + c.getSavoirFaire()
                            + " » n'appartient pas à la formation choisie pour l'exercice « " + intitule + " ».");
                }
                e.getCriteres().add(c);
            }
            nouveaux.add(e);
        }

        if (groupeId == null) exercices.supprimerProgrammeCommun(seanceId);
        else exercices.supprimerProgrammeDuGroupe(seanceId, groupeId);
        // Relus après la suppression, qui vide le contexte de persistance.
        Seance seance = seance(seanceId);
        GroupeEntrainement groupe = groupeId == null ? null : groupes.getReferenceById(groupeId);
        nouveaux.forEach(e -> {
            e.setSeance(seance);
            e.setGroupe(groupe);
        });
        exercices.saveAll(nouveaux);
        exercices.flush();
        return programme(seanceId, moi);
    }

    /** Encadrant attitré du groupe ; un référent l'est toujours aussi (règle de GroupeEntrainementService). */
    private static boolean estEncadrant(GroupeEntrainement g, UtilisateurPrincipal moi) {
        return moi != null && g.getEncadrants().stream().anyMatch(u -> u.getId().equals(moi.id()));
    }

    private static boolean estAdmin(UtilisateurPrincipal moi) {
        return moi != null && moi.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    /**
     * Formations proposées : celles des élèves inscrits sur la saison de la
     * séance (y compris une ancienne version du MFT figée sur un cursus),
     * puis les versions actives qui n'y figurent pas encore.
     */
    private List<FormationVue> formations(Seance seance) {
        Map<Long, FormationVue> parRef = new LinkedHashMap<>();
        Map<Long, Integer> eleves = new LinkedHashMap<>();
        for (Cursus c : cursus.parSaison(seance.getSaison().getId())) {
            if (c.getStatut() == Cursus.Statut.ABANDON) continue;
            Referentiel r = c.getReferentiel();
            eleves.merge(r.getId(), 1, Integer::sum);
            parRef.putIfAbsent(r.getId(), new FormationVue(r.getId(), r.getNiveau().name(), r.getVersionMft(), 0));
        }
        List<FormationVue> liste = new ArrayList<>(parRef.values().stream()
                .map(f -> new FormationVue(f.referentielId(), f.niveau(), f.versionMft(), eleves.get(f.referentielId())))
                .toList());
        Set<Long> deja = new HashSet<>(parRef.keySet());
        for (Referentiel r : referentiels.findByActifTrueOrderByNiveau()) {
            if (deja.add(r.getId())) liste.add(new FormationVue(r.getId(), r.getNiveau().name(), r.getVersionMft(), 0));
        }
        liste.sort(Comparator.comparing(FormationVue::niveau).thenComparing(f -> -f.eleves()));
        return liste;
    }

    private static ExerciceVue vue(ExerciceSeance e) {
        List<CritereExerciceVue> criteres = e.getCriteres().stream()
                .sorted(Comparator.comparingInt((Critere c) -> c.getBloc().getOrdre()).thenComparingInt(Critere::getOrdre))
                .map(c -> new CritereExerciceVue(c.getId(), c.getBloc().getId(), c.getBloc().getIntitule(),
                        c.getSavoirFaire()))
                .toList();
        Referentiel r = e.getReferentiel();
        return new ExerciceVue(e.getId(), e.getGroupe() == null ? null : e.getGroupe().getId(), e.getOrdre(), e.getIntitule(), e.getConsignes(), e.getDureeMinutes(),
                r == null ? null : r.getId(), r == null ? null : r.getNiveau().name(), criteres);
    }

    private Seance seance(Long id) {
        return seances.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
    }
}
