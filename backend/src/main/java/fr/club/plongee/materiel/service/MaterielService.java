package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.InterventionEquipement;
import fr.club.plongee.materiel.domain.InterventionEquipement.Resultat;
import fr.club.plongee.materiel.domain.Pret;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;
import fr.club.plongee.materiel.repository.EquipementRepository;
import fr.club.plongee.materiel.repository.InterventionEquipementRepository;
import fr.club.plongee.materiel.repository.PretRepository;
import fr.club.plongee.materiel.service.EcheancesEquipement.Alerte;
import fr.club.plongee.materiel.service.EcheancesEquipement.Etat;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Inventaire du matériel et fiche de gestion de chaque équipement : sa
 * description, son journal (en ajout seul) et les échéances qui en
 * découlent. Les prêts sont dans {@link PretService}.
 */
@Service
public class MaterielService {

    public enum Statut { DISPONIBLE, PRETE, A_REGULARISER, HORS_SERVICE, REBUTE }

    public record PretEnCoursVue(Long id, String emprunteur, LocalDate dateRetourPrevue) {}

    public record EquipementVue(Long id, TypeEquipement type, String typeLibelle, String reference,
                                String marque, String modele, String numeroSerie, String taille,
                                LocalDate dateFabrication, LocalDate dateAchat, LocalDate dateMiseEnService,
                                LocalDate dateRebutPrevue, String notice, String consignesEntretien,
                                Integer periodiciteRevisionMois,
                                BigDecimal volumeLitres, Integer pressionServiceBar, Integer pressionEpreuveBar,
                                Equipement.Matiere matiere, String robinetterie, LocalDate datePremiereEpreuve,
                                boolean nitrox, boolean regimeTiv, String composition, BigDecimal epaisseurMm,
                                boolean horsService, LocalDate dateRebut, String motifRebut, String remarques,
                                Statut statut,
                                LocalDate derniereInspection, LocalDate prochaineInspection,
                                LocalDate derniereRequalification, LocalDate prochaineRequalification,
                                LocalDate derniereRevision, LocalDate prochaineRevision,
                                List<Alerte> alertes, PretEnCoursVue pretEnCours) {}

    public record InterventionVue(Long id, TypeIntervention type, String typeLibelle, LocalDate dateIntervention,
                                  String intervenant, Resultat resultat, String description, Long pretId,
                                  String saisiPar, Instant saisiLe) {}

    /**
     * Le type ne change plus après la création (le journal en dépend).
     * {@code derniereInspectionVisuelle}, {@code derniereRequalification} et
     * {@code derniereRevision} ne servent qu'à la création : ils reprennent
     * l'historique d'un équipement déjà en service, sous forme de lignes du
     * journal.
     */
    public record DemandeEquipement(@NotNull TypeEquipement type,
                                    @NotBlank @Size(max = 30) String reference,
                                    @Size(max = 80) String marque, @Size(max = 80) String modele,
                                    @Size(max = 60) String numeroSerie, @Size(max = 20) String taille,
                                    LocalDate dateFabrication, LocalDate dateAchat, LocalDate dateMiseEnService,
                                    LocalDate dateRebutPrevue, @Size(max = 255) String notice,
                                    String consignesEntretien, @Positive Integer periodiciteRevisionMois,
                                    @DecimalMin("0.1") BigDecimal volumeLitres,
                                    @Positive Integer pressionServiceBar, @Positive Integer pressionEpreuveBar,
                                    Equipement.Matiere matiere, @Size(max = 80) String robinetterie,
                                    LocalDate datePremiereEpreuve, Boolean nitrox, Boolean regimeTiv,
                                    @Size(max = 255) String composition, @DecimalMin("0.5") BigDecimal epaisseurMm,
                                    Boolean horsService, String remarques,
                                    LocalDate derniereInspectionVisuelle, LocalDate derniereRequalification,
                                    LocalDate derniereRevision) {}

    public record DemandeIntervention(@NotNull TypeIntervention type, @NotNull LocalDate dateIntervention,
                                      @Size(max = 120) String intervenant, Resultat resultat,
                                      String description) {}

    public record DemandeRebut(@NotNull LocalDate dateRebut, @NotBlank @Size(max = 255) String motif) {}

    private final EquipementRepository equipements;
    private final InterventionEquipementRepository interventions;
    private final PretRepository prets;
    private final UtilisateurRepository utilisateurs;

    public MaterielService(EquipementRepository equipements, InterventionEquipementRepository interventions,
                           PretRepository prets, UtilisateurRepository utilisateurs) {
        this.equipements = equipements;
        this.interventions = interventions;
        this.prets = prets;
        this.utilisateurs = utilisateurs;
    }

    @Transactional(readOnly = true)
    public List<EquipementVue> lister() {
        List<Equipement> liste = equipements.findAllByOrderByTypeAscReferenceAsc();
        Map<Long, List<InterventionEquipement>> journaux = liste.isEmpty() ? Map.of()
                : interventions.parEquipements(liste.stream().map(Equipement::getId).toList()).stream()
                        .collect(Collectors.groupingBy(i -> i.getEquipement().getId()));
        Map<Long, Pret> enPret = pretsEnCoursParEquipement();
        return liste.stream()
                .map(e -> vue(e, journaux.getOrDefault(e.getId(), List.of()), enPret.get(e.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public EquipementVue lire(Long id) {
        Equipement e = equipement(id);
        return vue(e, interventions.parEquipement(id), pretsEnCoursParEquipement().get(id));
    }

    @Transactional(readOnly = true)
    public List<InterventionVue> journal(Long id) {
        equipement(id);
        return interventions.parEquipement(id).stream().map(MaterielService::vue).toList();
    }

    @Transactional
    public EquipementVue creer(DemandeEquipement d, Long auteurId) {
        String reference = d.reference().trim();
        if (equipements.existsByReferenceIgnoreCase(reference)) {
            throw new RegleMetierException("La référence « " + reference + " » est déjà utilisée par un autre équipement.");
        }
        Equipement e = new Equipement();
        e.setType(d.type());
        appliquer(e, d);
        equipements.save(e);

        Utilisateur auteur = utilisateurs.getReferenceById(auteurId);
        String reprise = "Reprise de l'historique à l'enregistrement de l'équipement.";
        if (d.type() == TypeEquipement.BLOC) {
            if (d.derniereRequalification() != null) {
                journaliser(e, TypeIntervention.REQUALIFICATION, d.derniereRequalification(), Resultat.CONFORME,
                        reprise, null, auteur);
            }
            if (d.derniereInspectionVisuelle() != null) {
                journaliser(e, TypeIntervention.INSPECTION_VISUELLE, d.derniereInspectionVisuelle(), Resultat.CONFORME,
                        reprise, null, auteur);
            }
        } else if (d.derniereRevision() != null) {
            journaliser(e, TypeIntervention.REVISION, d.derniereRevision(), Resultat.CONFORME, reprise, null, auteur);
        }
        return lire(e.getId());
    }

    @Transactional
    public EquipementVue modifier(Long id, DemandeEquipement d) {
        Equipement e = equipement(id);
        String reference = d.reference().trim();
        if (equipements.existsByReferenceIgnoreCaseAndIdNot(reference, id)) {
            throw new RegleMetierException("La référence « " + reference + " » est déjà utilisée par un autre équipement.");
        }
        appliquer(e, d);
        return lire(id);
    }

    /**
     * Seulement pour une saisie par erreur : un équipement qui a un journal
     * ou des prêts se met au rebut, sa fiche doit être conservée (trois ans
     * après la mise au rebut, art. A322-177).
     */
    @Transactional
    public void supprimer(Long id) {
        Equipement e = equipement(id);
        if (interventions.existsByEquipementId(id) || prets.existsParEquipement(id)) {
            throw new RegleMetierException("Cet équipement a un historique (interventions ou prêts) : "
                    + "mettez-le au rebut plutôt que de le supprimer, sa fiche doit être conservée.");
        }
        equipements.delete(e);
    }

    @Transactional
    public EquipementVue mettreAuRebut(Long id, DemandeRebut d) {
        Equipement e = equipement(id);
        if (e.estRebute()) throw new RegleMetierException("Cet équipement est déjà au rebut.");
        if (pretsEnCoursParEquipement().containsKey(id)) {
            throw new RegleMetierException("Cet équipement est prêté : enregistrez d'abord son retour.");
        }
        if (d.dateRebut().isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date de mise au rebut ne peut pas être dans le futur.");
        }
        e.setDateRebut(d.dateRebut());
        e.setMotifRebut(d.motif().trim());
        return lire(id);
    }

    /** Annule une mise au rebut enregistrée par erreur ; Envers garde la trace des deux gestes. */
    @Transactional
    public EquipementVue remettreEnStock(Long id) {
        Equipement e = equipement(id);
        if (!e.estRebute()) throw new RegleMetierException("Cet équipement n'est pas au rebut.");
        e.setDateRebut(null);
        e.setMotifRebut(null);
        return lire(id);
    }

    @Transactional
    public InterventionVue ajouterIntervention(Long id, DemandeIntervention d, Long auteurId) {
        Equipement e = equipement(id);
        if (e.estRebute()) {
            throw new RegleMetierException("Cet équipement est au rebut : remettez-le en stock avant d'enregistrer une intervention.");
        }
        if (!d.type().concerne(e.getType())) {
            throw new RegleMetierException("« " + d.type().libelle() + " » ne concerne pas un "
                    + e.getType().libelle().toLowerCase() + ".");
        }
        if (d.dateIntervention().isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date d'une intervention ne peut pas être dans le futur.");
        }
        if (d.type() == TypeIntervention.INCIDENT && vide(d.description())) {
            throw new RegleMetierException("Décrivez l'incident.");
        }
        return vue(journaliser(e, d.type(), d.dateIntervention(), d.resultat(), d.description(), null,
                utilisateurs.getReferenceById(auteurId), d.intervenant()));
    }

    /** État à une date donnée (fin d'un prêt), pour {@link PretService}, dans sa transaction. */
    public Etat etat(Equipement e, LocalDate dateReference) {
        return EcheancesEquipement.calculer(e, interventions.parEquipement(e.getId()),
                dateReference, Calendrier.aujourdhui());
    }

    /** Pour {@link PretService} : désinfection à la remise, incident au retour. */
    public InterventionEquipement journaliser(Equipement e, TypeIntervention type, LocalDate date, Resultat resultat,
                                              String description, Pret pret, Utilisateur auteur) {
        return journaliser(e, type, date, resultat, description, pret, auteur, null);
    }

    private InterventionEquipement journaliser(Equipement e, TypeIntervention type, LocalDate date,
                                               Resultat resultat, String description, Pret pret,
                                               Utilisateur auteur, String intervenant) {
        InterventionEquipement i = new InterventionEquipement();
        i.setEquipement(e);
        i.setType(type);
        i.setDateIntervention(date);
        i.setResultat(resultat);
        i.setDescription(nettoyer(description));
        i.setIntervenant(nettoyer(intervenant));
        i.setPret(pret);
        i.setSaisiPar(auteur);
        return interventions.save(i);
    }

    private Map<Long, Pret> pretsEnCoursParEquipement() {
        Map<Long, Pret> parEquipement = new HashMap<>();
        for (Pret p : prets.enCours()) {
            for (Equipement e : p.getEquipements()) parEquipement.put(e.getId(), p);
        }
        return parEquipement;
    }

    public Equipement equipement(Long id) {
        return equipements.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Équipement introuvable"));
    }

    private void appliquer(Equipement e, DemandeEquipement d) {
        boolean bloc = e.getType() == TypeEquipement.BLOC;
        e.setReference(d.reference().trim());
        e.setMarque(nettoyer(d.marque()));
        e.setModele(nettoyer(d.modele()));
        e.setNumeroSerie(nettoyer(d.numeroSerie()));
        e.setTaille(bloc ? null : nettoyer(d.taille()));
        e.setDateFabrication(d.dateFabrication());
        e.setDateAchat(d.dateAchat());
        e.setDateMiseEnService(d.dateMiseEnService());
        e.setDateRebutPrevue(d.dateRebutPrevue());
        e.setNotice(nettoyer(d.notice()));
        e.setConsignesEntretien(nettoyer(d.consignesEntretien()));
        e.setPeriodiciteRevisionMois(bloc ? null : d.periodiciteRevisionMois());
        e.setVolumeLitres(bloc ? d.volumeLitres() : null);
        e.setPressionServiceBar(bloc ? d.pressionServiceBar() : null);
        e.setPressionEpreuveBar(bloc ? d.pressionEpreuveBar() : null);
        e.setMatiere(bloc ? d.matiere() : null);
        e.setRobinetterie(bloc ? nettoyer(d.robinetterie()) : null);
        e.setDatePremiereEpreuve(bloc ? d.datePremiereEpreuve() : null);
        e.setNitrox(bloc && Boolean.TRUE.equals(d.nitrox()));
        e.setRegimeTiv(!bloc || !Boolean.FALSE.equals(d.regimeTiv()));
        e.setComposition(e.getType() == TypeEquipement.DETENDEUR ? nettoyer(d.composition()) : null);
        e.setEpaisseurMm(e.getType() == TypeEquipement.COMBINAISON ? d.epaisseurMm() : null);
        e.setHorsService(Boolean.TRUE.equals(d.horsService()));
        e.setRemarques(nettoyer(d.remarques()));
    }

    private EquipementVue vue(Equipement e, List<InterventionEquipement> journal, Pret pretEnCours) {
        Etat etat = EcheancesEquipement.calculer(e, journal);
        Statut statut = e.estRebute() ? Statut.REBUTE
                : e.isHorsService() ? Statut.HORS_SERVICE
                : pretEnCours != null ? Statut.PRETE
                : etat.bloquant() ? Statut.A_REGULARISER
                : Statut.DISPONIBLE;
        return new EquipementVue(e.getId(), e.getType(), e.getType().libelle(), e.getReference(),
                e.getMarque(), e.getModele(), e.getNumeroSerie(), e.getTaille(),
                e.getDateFabrication(), e.getDateAchat(), e.getDateMiseEnService(), e.getDateRebutPrevue(),
                e.getNotice(), e.getConsignesEntretien(), e.getPeriodiciteRevisionMois(),
                e.getVolumeLitres(), e.getPressionServiceBar(), e.getPressionEpreuveBar(),
                e.getMatiere(), e.getRobinetterie(), e.getDatePremiereEpreuve(),
                e.isNitrox(), e.isRegimeTiv(), e.getComposition(), e.getEpaisseurMm(),
                e.isHorsService(), e.getDateRebut(), e.getMotifRebut(), e.getRemarques(),
                statut,
                etat.derniereInspection(), etat.prochaineInspection(),
                etat.derniereRequalification(), etat.prochaineRequalification(),
                etat.derniereRevision(), etat.prochaineRevision(),
                etat.alertes(),
                pretEnCours == null ? null
                        : new PretEnCoursVue(pretEnCours.getId(), pretEnCours.getEmprunteurNom(),
                                pretEnCours.getDateRetourPrevue()));
    }

    private static InterventionVue vue(InterventionEquipement i) {
        return new InterventionVue(i.getId(), i.getType(), i.getType().libelle(), i.getDateIntervention(),
                i.getIntervenant(), i.getResultat(), i.getDescription(),
                i.getPret() == null ? null : i.getPret().getId(),
                i.getSaisiPar() == null ? null : i.getSaisiPar().nomComplet(), i.getSaisiLe());
    }

    private static String nettoyer(String s) {
        return vide(s) ? null : s.trim();
    }

    private static boolean vide(String s) {
        return s == null || s.isBlank();
    }
}
