package fr.club.plongee.progression.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.progression.domain.DecoupageProgression;
import fr.club.plongee.progression.domain.PeriodeProgression;
import fr.club.plongee.progression.domain.ProgressionType;
import fr.club.plongee.progression.repository.ProgressionTypeRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.BlocCompetenceRepository;
import fr.club.plongee.referentiel.repository.ExerciceCompetenceRepository;
import fr.club.plongee.referentiel.repository.ReferentielRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Progressions types : ecriture par l'admin, lecture par tous les encadrants.
 * Une progression s'enregistre d'un bloc (nom + toutes ses periodes, dans
 * l'ordre) : l'ecran d'edition renvoie la liste complete, les periodes
 * absentes sont supprimees, l'ordre de la liste donne le rang.
 */
@Service
public class ProgressionService {

    public record BlocResume(Long id, int ordre, String intitule) {}

    /** Exercice de la base prévu dans une période ; {@code blocId} : sa compétence. */
    public record ExerciceResume(Long id, Long blocId, String numero, String intitule, String phase,
                                 boolean actif) {}

    /**
     * Mois (progression découpée par mois) ou numéros de plongée (découpée
     * par plongées) : l'autre paire est nulle.
     */
    public record PeriodeVue(Long id, int rang, String intitule, Integer moisDebut, Integer moisFin,
                             Integer plongeeDebut, Integer plongeeFin,
                             String milieu, String note, List<BlocResume> blocs,
                             List<ExerciceResume> exercices) {}

    public record ProgressionResume(Long id, String nom, Long referentielId, String niveau,
                                    String versionMft, String decoupage, int nombrePeriodes) {}

    public record ProgressionVue(Long id, String nom, String description, Long referentielId,
                                 String niveau, String versionMft, String decoupage, List<PeriodeVue> periodes) {}

    /** Borne de saisie d'une étape : bien au-delà d'une formation, même N3. */
    public static final int MAX_PLONGEES = 99;

    /**
     * {@code id} null : nouvelle periode. {@code exerciceIds} null : exercices
     * inchangés (écran d'une version précédente, qui ne les envoyait pas).
     * Mois ou plongées selon le découpage de la progression.
     */
    public record DemandePeriode(Long id, @NotBlank String intitule,
                                 @Min(1) @Max(12) Integer moisDebut, @Min(1) @Max(12) Integer moisFin,
                                 @Min(1) @Max(MAX_PLONGEES) Integer plongeeDebut,
                                 @Min(1) @Max(MAX_PLONGEES) Integer plongeeFin,
                                 Milieu milieu, String note, List<Long> blocIds, List<Long> exerciceIds) {}

    /**
     * {@code referentielId} et {@code decoupage} (null = MOIS) ne sont lus qu'a
     * la creation : une progression ne change ni de referentiel ni de decoupage.
     */
    public record DemandeProgression(Long referentielId, @NotBlank String nom, String description,
                                     DecoupageProgression decoupage,
                                     List<@Valid DemandePeriode> periodes) {}

    private final ProgressionTypeRepository progressions;
    private final ReferentielRepository referentiels;
    private final BlocCompetenceRepository blocs;
    private final SaisonRepository saisons;
    private final ExerciceCompetenceRepository exercices;

    public ProgressionService(ProgressionTypeRepository progressions, ReferentielRepository referentiels,
                              BlocCompetenceRepository blocs, SaisonRepository saisons,
                              ExerciceCompetenceRepository exercices) {
        this.progressions = progressions;
        this.referentiels = referentiels;
        this.blocs = blocs;
        this.saisons = saisons;
        this.exercices = exercices;
    }

    /**
     * Progressions suivies par une saison, periodes comprises : de quoi
     * afficher le programme de chaque seance. Sans saison precisee : la
     * saison ouverte la plus recente, comme la liste des seances.
     */
    @Transactional(readOnly = true)
    public List<ProgressionVue> deLaSaison(Long saisonId) {
        Long id = saisonId != null ? saisonId : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte")).getId();
        return progressions.suiviesPar(id).stream().map(this::vers).toList();
    }

    /** Remplace les progressions suivies par la saison ; au plus une par référentiel. */
    @Transactional
    public List<ProgressionVue> definirPourSaison(Long saisonId, List<Long> progressionIds) {
        Saison saison = saisons.findById(saisonId)
                .orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"));
        Set<Long> ids = progressionIds == null ? Set.of() : new LinkedHashSet<>(progressionIds);
        List<ProgressionType> choisies = progressions.findAllById(ids);
        if (choisies.size() != ids.size()) {
            throw new RessourceIntrouvableException("Progression introuvable");
        }
        Set<Long> referentielsVus = new HashSet<>();
        for (ProgressionType p : choisies) {
            if (!referentielsVus.add(p.getReferentiel().getId())) {
                throw new RegleMetierException("Une saison ne suit qu'une progression par référentiel ("
                        + p.getReferentiel().getNiveau() + " MFT " + p.getReferentiel().getVersionMft() + ").");
            }
        }
        for (ProgressionType p : progressions.suiviesPar(saisonId)) {
            if (!ids.contains(p.getId())) p.getSaisons().remove(saison);
        }
        for (ProgressionType p : choisies) {
            p.getSaisons().add(saison);
        }
        return deLaSaison(saisonId);
    }

    @Transactional(readOnly = true)
    public List<ProgressionResume> lister() {
        return progressions.listerAvecReferentiel().stream()
                .map(p -> new ProgressionResume(p.getId(), p.getNom(), p.getReferentiel().getId(),
                        p.getReferentiel().getNiveau().name(), p.getReferentiel().getVersionMft(),
                        p.getDecoupage().name(), p.getPeriodes().size()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProgressionVue detail(Long id) {
        return vers(charger(id));
    }

    @Transactional
    public ProgressionVue creer(DemandeProgression demande) {
        if (demande.referentielId() == null) {
            throw new RegleMetierException("Choisissez le référentiel de la progression.");
        }
        Referentiel r = referentiels.findById(demande.referentielId())
                .orElseThrow(() -> new RessourceIntrouvableException("Referentiel introuvable"));
        ProgressionType p = new ProgressionType();
        p.setReferentiel(r);
        if (demande.decoupage() != null) p.setDecoupage(demande.decoupage());
        appliquer(p, demande);
        return vers(progressions.save(p));
    }

    @Transactional
    public ProgressionVue modifier(Long id, DemandeProgression demande) {
        ProgressionType p = charger(id);
        appliquer(p, demande);
        return vers(progressions.save(p));
    }

    /** Point de départ d'une variante (« N1 stage » à partir de « N1 hiver »). */
    @Transactional
    public ProgressionVue copier(Long id) {
        ProgressionType source = charger(id);
        ProgressionType copie = new ProgressionType();
        copie.setReferentiel(source.getReferentiel());
        copie.setNom(source.getNom() + " (copie)");
        copie.setDescription(source.getDescription());
        copie.setDecoupage(source.getDecoupage());
        for (PeriodeProgression ps : source.getPeriodes()) {
            PeriodeProgression pc = new PeriodeProgression();
            pc.setProgression(copie);
            pc.setRang(ps.getRang());
            pc.setIntitule(ps.getIntitule());
            pc.setMoisDebut(ps.getMoisDebut());
            pc.setMoisFin(ps.getMoisFin());
            pc.setPlongeeDebut(ps.getPlongeeDebut());
            pc.setPlongeeFin(ps.getPlongeeFin());
            pc.setMilieu(ps.getMilieu());
            pc.setNote(ps.getNote());
            pc.setBlocs(new LinkedHashSet<>(ps.getBlocs()));
            pc.setExercices(new LinkedHashSet<>(ps.getExercices()));
            copie.getPeriodes().add(pc);
        }
        return vers(progressions.save(copie));
    }

    @Transactional
    public void supprimer(Long id) {
        progressions.delete(charger(id));
    }

    private ProgressionType charger(Long id) {
        return progressions.findById(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Progression introuvable"));
    }

    private void appliquer(ProgressionType p, DemandeProgression d) {
        p.setNom(d.nom().trim());
        p.setDescription(d.description() == null || d.description().isBlank() ? null : d.description());

        Map<Long, PeriodeProgression> existantes = new HashMap<>();
        for (PeriodeProgression pp : p.getPeriodes()) existantes.put(pp.getId(), pp);

        List<PeriodeProgression> nouvelles = new ArrayList<>();
        List<DemandePeriode> demandes = d.periodes() == null ? List.of() : d.periodes();
        for (int i = 0; i < demandes.size(); i++) {
            DemandePeriode dp = demandes.get(i);
            PeriodeProgression pp;
            if (dp.id() == null) {
                pp = new PeriodeProgression();
                pp.setProgression(p);
            } else {
                pp = existantes.get(dp.id());
                if (pp == null) throw new RessourceIntrouvableException("Période introuvable");
            }
            pp.setRang(i + 1);
            pp.setIntitule(dp.intitule().trim());
            appliquerPlage(p, pp, dp);
            pp.setMilieu(dp.milieu());
            pp.setNote(dp.note() == null || dp.note().isBlank() ? null : dp.note());
            pp.setBlocs(blocsDuReferentiel(p.getReferentiel(), dp.blocIds()));
            if (dp.exerciceIds() != null) pp.setExercices(exercicesDuReferentiel(p.getReferentiel(), dp.exerciceIds()));
            nouvelles.add(pp);
        }
        // Meme collection (orphanRemoval) : les periodes absentes de la demande sont supprimees.
        p.getPeriodes().clear();
        p.getPeriodes().addAll(nouvelles);
    }

    /** Mois ou plongées selon le découpage ; l'autre paire est effacée. */
    private static void appliquerPlage(ProgressionType p, PeriodeProgression pp, DemandePeriode dp) {
        String nom = "« " + dp.intitule().trim() + " »";
        if (p.parPlongees()) {
            if (dp.plongeeDebut() == null || dp.plongeeFin() == null) {
                throw new RegleMetierException("Indiquez la première et la dernière plongée de l'étape " + nom + ".");
            }
            if (dp.plongeeFin() < dp.plongeeDebut()) {
                throw new RegleMetierException("L'étape " + nom
                        + " finit avant de commencer : sa dernière plongée doit venir après la première.");
            }
            pp.setPlongeeDebut(dp.plongeeDebut());
            pp.setPlongeeFin(dp.plongeeFin());
            pp.setMoisDebut(null);
            pp.setMoisFin(null);
        } else {
            if (dp.moisDebut() == null || dp.moisFin() == null) {
                throw new RegleMetierException("Indiquez le mois de début et le mois de fin de la période " + nom + ".");
            }
            pp.setMoisDebut(dp.moisDebut());
            pp.setMoisFin(dp.moisFin());
            pp.setPlongeeDebut(null);
            pp.setPlongeeFin(null);
        }
    }

    private Set<BlocCompetence> blocsDuReferentiel(Referentiel r, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return new LinkedHashSet<>();
        Set<Long> uniques = new LinkedHashSet<>(ids);
        List<BlocCompetence> trouves = blocs.findAllById(uniques);
        if (trouves.size() != uniques.size()
                || trouves.stream().anyMatch(b -> !b.getReferentiel().getId().equals(r.getId()))) {
            throw new RegleMetierException(
                    "Une période désigne un bloc qui n'appartient pas au référentiel de la progression.");
        }
        return new LinkedHashSet<>(trouves);
    }

    private Set<ExerciceCompetence> exercicesDuReferentiel(Referentiel r, List<Long> ids) {
        if (ids.isEmpty()) return new LinkedHashSet<>();
        Set<Long> uniques = new LinkedHashSet<>(ids);
        List<ExerciceCompetence> trouves = exercices.findAllById(uniques);
        if (trouves.size() != uniques.size()
                || trouves.stream().anyMatch(e -> !e.getBloc().getReferentiel().getId().equals(r.getId()))) {
            throw new RegleMetierException(
                    "Une période désigne un exercice qui n'appartient pas au référentiel de la progression.");
        }
        return new LinkedHashSet<>(trouves);
    }

    private ProgressionVue vers(ProgressionType p) {
        Referentiel r = p.getReferentiel();
        List<PeriodeVue> periodes = p.getPeriodes().stream()
                .sorted(Comparator.comparingInt(PeriodeProgression::getRang))
                .map(pp -> new PeriodeVue(pp.getId(), pp.getRang(), pp.getIntitule(),
                        pp.getMoisDebut(), pp.getMoisFin(), pp.getPlongeeDebut(), pp.getPlongeeFin(),
                        pp.getMilieu() == null ? null : pp.getMilieu().name(), pp.getNote(),
                        pp.getBlocs().stream()
                                .sorted(Comparator.comparingInt(BlocCompetence::getOrdre))
                                .map(b -> new BlocResume(b.getId(), b.getOrdre(), b.getIntitule()))
                                .toList(),
                        pp.getExercices().stream()
                                .sorted(Comparator.comparingInt((ExerciceCompetence e) -> e.getBloc().getOrdre())
                                        .thenComparingInt(ExerciceCompetence::getOrdre)
                                        .thenComparing(ExerciceCompetence::getNumero))
                                .map(e -> new ExerciceResume(e.getId(), e.getBloc().getId(), e.getNumero(),
                                        e.getIntitule(), e.getPhase().name(), e.isActif()))
                                .toList()))
                .toList();
        return new ProgressionVue(p.getId(), p.getNom(), p.getDescription(), r.getId(),
                r.getNiveau().name(), r.getVersionMft(), p.getDecoupage().name(), periodes);
    }
}
