package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Sortie;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.service.SortieService;
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

    public enum TypeEmprunteur { ELEVE, ENCADRANT }

    public record EmprunteurVue(TypeEmprunteur type, Long id, String nomComplet, String precision) {}

    public record EquipementPreteVue(Long id, TypeEquipement type, String typeLibelle, String reference,
                                     String description) {}

    public record PretVue(Long id, TypeEmprunteur emprunteurType, Long emprunteurId, String emprunteur,
                          Long sortieId, String sortieNom, String sortieLieu, LocalDate sortieDebut,
                          LocalDate sortieFin, int nombrePlongees, String motif,
                          LocalDate datePret, LocalDate dateRetourPrevue, LocalDate dateRetour,
                          boolean enRetard, String pretePar, String recuPar, String remarques,
                          List<EquipementPreteVue> equipements, long photosAvant, long photosApres) {}

    /** Un seul emprunteur : {@code eleveId} ou {@code utilisateurId}. */
    public record DemandePret(Long eleveId, Long utilisateurId, Long sortieId, @Size(max = 120) String motif,
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
    private final SortieService sorties;
    private final PhotoPretService photos;

    public PretService(PretRepository prets, MaterielService materiel, EleveRepository eleves,
                       UtilisateurRepository utilisateurs, SortieService sorties, PhotoPretService photos) {
        this.prets = prets;
        this.materiel = materiel;
        this.eleves = eleves;
        this.utilisateurs = utilisateurs;
        this.sorties = sorties;
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
                .map(e -> new EmprunteurVue(TypeEmprunteur.ELEVE, e.getId(), e.nomComplet(), precisionEleve(e)));
        return Stream.concat(lesEleves, encadrants).toList();
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
        LocalDate retourPrevu = d.dateRetourPrevue();
        if (d.sortieId() != null) {
            Sortie s = sorties.sortie(d.sortieId());
            p.setSortie(s);
            // Sans retour prévu, le matériel revient à la fin de la sortie : c'est jusque-là qu'il doit tenir.
            if (retourPrevu == null && !s.getDateFin().isBefore(d.datePret())) retourPrevu = s.getDateFin();
        }
        p.setMotif(nettoyer(d.motif()));
        p.setDatePret(d.datePret());
        p.setDateRetourPrevue(retourPrevu);
        p.setRemarques(nettoyer(d.remarques()));
        p.setPretePar(utilisateurs.getReferenceById(auteurId));

        // L'équipement doit rester utilisable jusqu'au retour prévu.
        LocalDate finDuPret = retourPrevu != null ? retourPrevu : d.datePret();
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
        return vues(List.of(p)).getFirst();
    }

    private PretVue vue(Pret p, Map<Moment, Long> photosDuPret) {
        Sortie sortie = p.getSortie();
        TypeEmprunteur type = p.getEleve() != null ? TypeEmprunteur.ELEVE
                : p.getUtilisateur() != null ? TypeEmprunteur.ENCADRANT : null;
        Long emprunteurId = p.getEleve() != null ? p.getEleve().getId()
                : p.getUtilisateur() != null ? p.getUtilisateur().getId() : null;
        boolean enRetard = p.estEnCours() && p.getDateRetourPrevue() != null
                && p.getDateRetourPrevue().isBefore(Calendrier.aujourdhui());
        List<EquipementPreteVue> equipements = p.getEquipements().stream()
                .sorted(Comparator.comparing(Equipement::getType).thenComparing(Equipement::getReference))
                .map(e -> new EquipementPreteVue(e.getId(), e.getType(), e.getType().libelle(), e.getReference(),
                        description(e)))
                .toList();
        return new PretVue(p.getId(), type, emprunteurId, p.getEmprunteurNom(),
                sortie == null ? null : sortie.getId(), sortie == null ? null : sortie.getNom(),
                sortie == null ? null : sortie.getLieu(), sortie == null ? null : sortie.getDateDebut(),
                sortie == null ? null : sortie.getDateFin(), sortie == null ? 0 : sortie.nombrePlongees(),
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

    /** « N1 · gilet M · combinaison T3 » : ce qu'il faut savoir pour choisir le matériel à prêter. */
    private static String precisionEleve(Eleve e) {
        List<String> morceaux = new ArrayList<>();
        if (!vide(e.getDernierNiveau())) morceaux.add(e.getDernierNiveau());
        if (!vide(e.getTailleGilet())) morceaux.add("gilet " + e.getTailleGilet());
        if (!vide(e.getTailleCombinaison())) morceaux.add("combinaison " + e.getTailleCombinaison());
        return morceaux.isEmpty() ? null : String.join(" · ", morceaux);
    }

    private static boolean vide(String s) {
        return s == null || s.isBlank();
    }
}
