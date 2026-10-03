package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.ExerciceSeance;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.ExerciceSeanceRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
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
 * notation groupée peut les reprendre. Le programme ne note personne :
 * l'évaluation reste un geste du moniteur, critère par critère.
 */
@Service
public class ProgrammeSeanceService {

    /** Au-delà, c'est plus probablement une erreur qu'une séance. */
    public static final int EXERCICES_MAX = 40;
    private static final int DUREE_MAX_MINUTES = 600;

    public record CritereExerciceVue(Long id, Long blocId, String bloc, String savoirFaire) {}

    public record ExerciceVue(Long id, int ordre, String intitule, String consignes, Integer dureeMinutes,
                              Long referentielId, String niveau, List<CritereExerciceVue> criteres) {}

    /** Une formation proposée pour les exercices : celles des élèves de la saison, puis les versions actives. */
    public record FormationVue(Long referentielId, String niveau, String versionMft, int eleves) {}

    public record ProgrammeVue(Long seanceId, List<FormationVue> formations, List<ExerciceVue> exercices) {}

    public record DemandeExercice(String intitule, String consignes, Integer dureeMinutes,
                                  Long referentielId, List<Long> critereIds) {}

    private final SeanceRepository seances;
    private final ExerciceSeanceRepository exercices;
    private final ReferentielRepository referentiels;
    private final CritereRepository criteres;
    private final CursusRepository cursus;

    public ProgrammeSeanceService(SeanceRepository seances, ExerciceSeanceRepository exercices,
                                  ReferentielRepository referentiels, CritereRepository criteres,
                                  CursusRepository cursus) {
        this.seances = seances;
        this.exercices = exercices;
        this.referentiels = referentiels;
        this.criteres = criteres;
        this.cursus = cursus;
    }

    @Transactional(readOnly = true)
    public ProgrammeVue programme(Long seanceId) {
        Seance seance = seance(seanceId);
        return new ProgrammeVue(seanceId, formations(seance),
                exercices.deLaSeance(seanceId).stream().map(ProgrammeSeanceService::vue).toList());
    }

    /**
     * Remplace tout le programme de la séance par la liste reçue, dans son
     * ordre. Tout ou rien : une ligne refusée n'enregistre aucune des autres.
     */
    @Transactional
    public ProgrammeVue enregistrer(Long seanceId, List<DemandeExercice> demandes) {
        seance(seanceId);
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

        exercices.supprimerDeLaSeance(seanceId);
        // Relue après la suppression, qui vide le contexte de persistance.
        Seance seance = seance(seanceId);
        nouveaux.forEach(e -> e.setSeance(seance));
        exercices.saveAll(nouveaux);
        exercices.flush();
        return programme(seanceId);
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
        return new ExerciceVue(e.getId(), e.getOrdre(), e.getIntitule(), e.getConsignes(), e.getDureeMinutes(),
                r == null ? null : r.getId(), r == null ? null : r.getNiveau().name(), criteres);
    }

    private Seance seance(Long id) {
        return seances.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Seance introuvable"));
    }
}
