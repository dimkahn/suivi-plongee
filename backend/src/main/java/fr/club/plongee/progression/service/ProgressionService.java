package fr.club.plongee.progression.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.progression.domain.PeriodeProgression;
import fr.club.plongee.progression.domain.ProgressionType;
import fr.club.plongee.progression.repository.ProgressionTypeRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.referentiel.repository.BlocCompetenceRepository;
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

    public record PeriodeVue(Long id, int rang, String intitule, int moisDebut, int moisFin,
                             String milieu, String note, List<BlocResume> blocs) {}

    public record ProgressionResume(Long id, String nom, Long referentielId, String niveau,
                                    String versionMft, int nombrePeriodes) {}

    public record ProgressionVue(Long id, String nom, String description, Long referentielId,
                                 String niveau, String versionMft, List<PeriodeVue> periodes) {}

    /** {@code id} null : nouvelle periode. */
    public record DemandePeriode(Long id, @NotBlank String intitule,
                                 @Min(1) @Max(12) int moisDebut, @Min(1) @Max(12) int moisFin,
                                 Milieu milieu, String note, List<Long> blocIds) {}

    /** {@code referentielId} n'est lu qu'a la creation : une progression ne change pas de referentiel. */
    public record DemandeProgression(Long referentielId, @NotBlank String nom, String description,
                                     List<@Valid DemandePeriode> periodes) {}

    private final ProgressionTypeRepository progressions;
    private final ReferentielRepository referentiels;
    private final BlocCompetenceRepository blocs;

    public ProgressionService(ProgressionTypeRepository progressions, ReferentielRepository referentiels,
                              BlocCompetenceRepository blocs) {
        this.progressions = progressions;
        this.referentiels = referentiels;
        this.blocs = blocs;
    }

    @Transactional(readOnly = true)
    public List<ProgressionResume> lister() {
        return progressions.listerAvecReferentiel().stream()
                .map(p -> new ProgressionResume(p.getId(), p.getNom(), p.getReferentiel().getId(),
                        p.getReferentiel().getNiveau().name(), p.getReferentiel().getVersionMft(),
                        p.getPeriodes().size()))
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
        for (PeriodeProgression ps : source.getPeriodes()) {
            PeriodeProgression pc = new PeriodeProgression();
            pc.setProgression(copie);
            pc.setRang(ps.getRang());
            pc.setIntitule(ps.getIntitule());
            pc.setMoisDebut(ps.getMoisDebut());
            pc.setMoisFin(ps.getMoisFin());
            pc.setMilieu(ps.getMilieu());
            pc.setNote(ps.getNote());
            pc.setBlocs(new LinkedHashSet<>(ps.getBlocs()));
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
            pp.setMoisDebut(dp.moisDebut());
            pp.setMoisFin(dp.moisFin());
            pp.setMilieu(dp.milieu());
            pp.setNote(dp.note() == null || dp.note().isBlank() ? null : dp.note());
            pp.setBlocs(blocsDuReferentiel(p.getReferentiel(), dp.blocIds()));
            nouvelles.add(pp);
        }
        // Meme collection (orphanRemoval) : les periodes absentes de la demande sont supprimees.
        p.getPeriodes().clear();
        p.getPeriodes().addAll(nouvelles);
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

    private ProgressionVue vers(ProgressionType p) {
        Referentiel r = p.getReferentiel();
        List<PeriodeVue> periodes = p.getPeriodes().stream()
                .sorted(Comparator.comparingInt(PeriodeProgression::getRang))
                .map(pp -> new PeriodeVue(pp.getId(), pp.getRang(), pp.getIntitule(),
                        pp.getMoisDebut(), pp.getMoisFin(),
                        pp.getMilieu() == null ? null : pp.getMilieu().name(), pp.getNote(),
                        pp.getBlocs().stream()
                                .sorted(Comparator.comparingInt(BlocCompetence::getOrdre))
                                .map(b -> new BlocResume(b.getId(), b.getOrdre(), b.getIntitule()))
                                .toList()))
                .toList();
        return new ProgressionVue(p.getId(), p.getNom(), p.getDescription(), r.getId(),
                r.getNiveau().name(), r.getVersionMft(), periodes);
    }
}
