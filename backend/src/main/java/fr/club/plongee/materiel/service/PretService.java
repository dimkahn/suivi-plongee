package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.PhotoPret.Moment;
import fr.club.plongee.materiel.domain.Pret;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;
import fr.club.plongee.materiel.repository.PretRepository;
import fr.club.plongee.materiel.service.EcheancesEquipement.Etat;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Stream;

/**
 * Prêt de matériel pour une sortie. Le serveur refuse de prêter un
 * équipement déjà prêté, rebuté, hors service ou hors échéance jusqu'à la
 * fin du prêt (voir {@link EcheancesEquipement}), et exige la désinfection
 * des détendeurs à chaque changement d'utilisateur (art. A322-81), inscrite
 * au journal de chacun.
 */
@Service
public class PretService {

    /** Séances en milieu naturel proposées : à venir, ou passées depuis moins de tant de jours. */
    static final int JOURS_SORTIES_PASSEES = 14;

    public enum TypeEmprunteur { ELEVE, ENCADRANT }

    public record EmprunteurVue(TypeEmprunteur type, Long id, String nomComplet, String precision) {}

    public record SortieVue(Long id, LocalDate date, String lieu, String site) {}

    public record EquipementPreteVue(Long id, TypeEquipement type, String typeLibelle, String reference,
                                     String description) {}

    public record PretVue(Long id, TypeEmprunteur emprunteurType, Long emprunteurId, String emprunteur,
                          Long seanceId, LocalDate dateSeance, String lieuSeance, String motif,
                          LocalDate datePret, LocalDate dateRetourPrevue, LocalDate dateRetour,
                          boolean enRetard, String pretePar, String recuPar, String remarques,
                          List<EquipementPreteVue> equipements, long photosAvant, long photosApres) {}

    /** Un seul emprunteur : {@code eleveId} ou {@code utilisateurId}. */
    public record DemandePret(Long eleveId, Long utilisateurId, Long seanceId, @Size(max = 120) String motif,
                              @NotNull LocalDate datePret, LocalDate dateRetourPrevue,
                              @NotEmpty List<Long> equipementIds, Boolean detendeursDesinfectes,
                              String remarques) {}

    /** {@code incident} non vide : inscrit au journal de l'équipement ; {@code horsService} : le retire des prêts. */
    public record RetourEquipement(@NotNull Long equipementId, String incident, Boolean horsService) {}

    public record DemandeRetour(@NotNull LocalDate dateRetour, List<@Valid RetourEquipement> equipements,
                                String remarques) {}

    private final PretRepository prets;
    private final MaterielService materiel;
    private final EleveRepository eleves;
    private final UtilisateurRepository utilisateurs;
    private final SeanceRepository seances;
    private final PhotoPretService photos;

    public PretService(PretRepository prets, MaterielService materiel, EleveRepository eleves,
                       UtilisateurRepository utilisateurs, SeanceRepository seances, PhotoPretService photos) {
        this.prets = prets;
        this.materiel = materiel;
        this.eleves = eleves;
        this.utilisateurs = utilisateurs;
        this.seances = seances;
        this.photos = photos;
    }

    /** Élèves non archivés et encadrants actifs : seulement ce qu'il faut pour choisir. */
    @Transactional(readOnly = true)
    public List<EmprunteurVue> emprunteurs() {
        Stream<EmprunteurVue> encadrants = utilisateurs.parRole(RoleNom.MONITEUR).stream()
                .filter(Utilisateur::isActif)
                .map(u -> new EmprunteurVue(TypeEmprunteur.ENCADRANT, u.getId(), u.nomComplet(),
                        u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name()));
        Stream<EmprunteurVue> lesEleves = eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc().stream()
                .map(e -> new EmprunteurVue(TypeEmprunteur.ELEVE, e.getId(), e.nomComplet(), e.getDernierNiveau()));
        return Stream.concat(lesEleves, encadrants).toList();
    }

    @Transactional(readOnly = true)
    public List<SortieVue> sorties() {
        return seances.findByMilieuAndDateSeanceGreaterThanEqualOrderByDateSeanceAscOrdreAsc(Milieu.NATUREL,
                        Calendrier.aujourdhui().minusDays(JOURS_SORTIES_PASSEES)).stream()
                .map(s -> new SortieVue(s.getId(), s.getDateSeance(), s.getLieu(), s.getSite()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PretVue> lister(boolean enCours) {
        return vues(enCours ? prets.enCours() : prets.rendus());
    }

    @Transactional(readOnly = true)
    public List<PretVue> parEquipement(Long equipementId) {
        materiel.equipement(equipementId);
        return vues(prets.parEquipement(equipementId));
    }

    @Transactional
    public PretVue creer(DemandePret d, Long auteurId) {
        if ((d.eleveId() == null) == (d.utilisateurId() == null)) {
            throw new RegleMetierException("Choisissez un emprunteur : un élève ou un encadrant.");
        }
        if (d.dateRetourPrevue() != null && d.dateRetourPrevue().isBefore(d.datePret())) {
            throw new RegleMetierException("Le retour prévu ne peut pas précéder la date du prêt.");
        }

        Pret p = new Pret();
        if (d.eleveId() != null) {
            Eleve e = eleves.findById(d.eleveId())
                    .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable"));
            if (e.getArchiveLe() != null) throw new RegleMetierException("Cet élève est archivé.");
            p.setEleve(e);
            p.setEmprunteurNom(e.nomComplet());
        } else {
            Utilisateur u = utilisateurs.findById(d.utilisateurId())
                    .filter(x -> x.getRoles().contains(RoleNom.MONITEUR))
                    .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable"));
            if (!u.isActif()) throw new RegleMetierException("Le compte de cet encadrant est désactivé.");
            p.setUtilisateur(u);
            p.setEmprunteurNom(u.nomComplet());
        }
        if (d.seanceId() != null) {
            p.setSeance(seances.findById(d.seanceId())
                    .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable")));
        }
        p.setMotif(nettoyer(d.motif()));
        p.setDatePret(d.datePret());
        p.setDateRetourPrevue(d.dateRetourPrevue());
        p.setRemarques(nettoyer(d.remarques()));
        p.setPretePar(utilisateurs.getReferenceById(auteurId));

        // L'équipement doit rester utilisable jusqu'au retour prévu.
        LocalDate finDuPret = d.dateRetourPrevue() != null ? d.dateRetourPrevue() : d.datePret();
        Map<Long, Pret> enCours = new HashMap<>();
        for (Pret q : prets.enCours()) q.getEquipements().forEach(e -> enCours.put(e.getId(), q));

        List<String> refus = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(d.equipementIds())) {
            Equipement e = materiel.equipement(id);
            Pret autre = enCours.get(id);
            if (autre != null) {
                refus.add(e.designation() + " : déjà prêté à " + autre.getEmprunteurNom() + ".");
                continue;
            }
            Etat etat = materiel.etat(e, finDuPret);
            if (etat.bloquant()) {
                refus.add(e.designation() + " : " + String.join(" ", etat.motifsBloquants()));
                continue;
            }
            p.getEquipements().add(e);
        }
        if (!refus.isEmpty()) {
            throw new RegleMetierException("Prêt impossible. " + String.join(" ", refus));
        }

        List<Equipement> detendeurs = p.getEquipements().stream()
                .filter(e -> e.getType() == TypeEquipement.DETENDEUR).toList();
        if (!detendeurs.isEmpty() && !Boolean.TRUE.equals(d.detendeursDesinfectes())) {
            throw new RegleMetierException("Les détendeurs se désinfectent avant d'être remis à un nouvel "
                    + "utilisateur (Code du sport, art. A322-81) : confirmez la désinfection.");
        }

        prets.save(p);
        Utilisateur auteur = utilisateurs.getReferenceById(auteurId);
        for (Equipement e : detendeurs) {
            materiel.journaliser(e, TypeIntervention.DESINFECTION, d.datePret(), null,
                    "Avant remise à " + p.getEmprunteurNom() + ".", p, auteur);
        }
        return vue(p);
    }

    @Transactional
    public PretVue rendre(Long id, DemandeRetour d, Long auteurId) {
        Pret p = pret(id);
        if (!p.estEnCours()) throw new RegleMetierException("Ce prêt est déjà rendu.");
        if (d.dateRetour().isBefore(p.getDatePret())) {
            throw new RegleMetierException("Le retour ne peut pas précéder la date du prêt.");
        }
        if (d.dateRetour().isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date de retour ne peut pas être dans le futur.");
        }
        Map<Long, Equipement> duPret = new HashMap<>();
        p.getEquipements().forEach(e -> duPret.put(e.getId(), e));

        Utilisateur auteur = utilisateurs.getReferenceById(auteurId);
        for (RetourEquipement r : d.equipements() == null ? List.<RetourEquipement>of() : d.equipements()) {
            Equipement e = duPret.get(r.equipementId());
            if (e == null) throw new RegleMetierException("Cet équipement ne fait pas partie du prêt.");
            if (!vide(r.incident())) {
                materiel.journaliser(e, TypeIntervention.INCIDENT, d.dateRetour(), null,
                        "Signalé au retour du prêt de " + p.getEmprunteurNom() + " : " + r.incident().trim(), p, auteur);
            }
            if (Boolean.TRUE.equals(r.horsService())) e.setHorsService(true);
        }

        p.setDateRetour(d.dateRetour());
        p.setRecuPar(auteur);
        if (!vide(d.remarques())) {
            p.setRemarques(vide(p.getRemarques()) ? d.remarques().trim() : p.getRemarques() + "\n" + d.remarques().trim());
        }
        return vue(p);
    }

    /** Un prêt saisi par erreur, pas encore rendu. Les désinfections déjà faites restent au journal. */
    @Transactional
    public void annuler(Long id) {
        Pret p = pret(id);
        if (!p.estEnCours()) {
            throw new RegleMetierException("Un prêt rendu fait partie de l'historique du matériel : il ne s'annule plus.");
        }
        prets.delete(p);
    }

    private Pret pret(Long id) {
        return prets.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Prêt introuvable"));
    }

    private List<PretVue> vues(List<Pret> liste) {
        Map<Long, Map<Moment, Long>> comptes = photos.compter(liste.stream().map(Pret::getId).toList());
        return liste.stream().map(p -> vue(p, comptes.getOrDefault(p.getId(), Map.of()))).toList();
    }

    private PretVue vue(Pret p) {
        return vue(p, photos.compter(List.of(p.getId())).getOrDefault(p.getId(), Map.of()));
    }

    private PretVue vue(Pret p, Map<Moment, Long> photosDuPret) {
        TypeEmprunteur type = p.getEleve() != null ? TypeEmprunteur.ELEVE
                : p.getUtilisateur() != null ? TypeEmprunteur.ENCADRANT : null;
        Long emprunteurId = p.getEleve() != null ? p.getEleve().getId()
                : p.getUtilisateur() != null ? p.getUtilisateur().getId() : null;
        Seance s = p.getSeance();
        boolean enRetard = p.estEnCours() && p.getDateRetourPrevue() != null
                && p.getDateRetourPrevue().isBefore(Calendrier.aujourdhui());
        List<EquipementPreteVue> equipements = p.getEquipements().stream()
                .sorted(Comparator.comparing(Equipement::getType).thenComparing(Equipement::getReference))
                .map(e -> new EquipementPreteVue(e.getId(), e.getType(), e.getType().libelle(), e.getReference(),
                        description(e)))
                .toList();
        return new PretVue(p.getId(), type, emprunteurId, p.getEmprunteurNom(),
                s == null ? null : s.getId(), s == null ? null : s.getDateSeance(),
                s == null ? null : Stream.of(s.getLieu(), s.getSite()).filter(Objects::nonNull)
                        .reduce((a, b) -> a + " – " + b).orElse(null),
                p.getMotif(), p.getDatePret(), p.getDateRetourPrevue(), p.getDateRetour(), enRetard,
                p.getPretePar() == null ? null : p.getPretePar().nomComplet(),
                p.getRecuPar() == null ? null : p.getRecuPar().nomComplet(),
                p.getRemarques(), equipements,
                photosDuPret.getOrDefault(Moment.AVANT, 0L), photosDuPret.getOrDefault(Moment.APRES, 0L));
    }

    /** « Aqualung Legend », « Scubapro 5 mm, taille M », « 12 L acier ». */
    static String description(Equipement e) {
        List<String> morceaux = new ArrayList<>();
        String modele = Stream.of(e.getMarque(), e.getModele()).filter(Objects::nonNull)
                .reduce((a, b) -> a + " " + b).orElse(null);
        if (e.getType() == TypeEquipement.BLOC && e.getVolumeLitres() != null) {
            morceaux.add(e.getVolumeLitres().stripTrailingZeros().toPlainString() + " L"
                    + (e.getMatiere() == null ? "" : " " + e.getMatiere().name().toLowerCase())
                    + (e.isNitrox() ? " nitrox" : ""));
        }
        if (modele != null) morceaux.add(modele);
        if (e.getEpaisseurMm() != null) morceaux.add(e.getEpaisseurMm().stripTrailingZeros().toPlainString() + " mm");
        if (e.getTaille() != null) morceaux.add("taille " + e.getTaille());
        return String.join(", ", morceaux);
    }

    private static String nettoyer(String s) {
        return vide(s) ? null : s.trim();
    }

    private static boolean vide(String s) {
        return s == null || s.isBlank();
    }
}
