package fr.club.plongee.materiel.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Le compte rendu détaillé d'une inspection visuelle de bouteille : la
 * « fiche d'évaluation et de suivi » du club. Rattaché à la ligne
 * INSPECTION_VISUELLE du journal, qui porte la date, le TIV, le résultat et
 * les observations. En AJOUT SEUL comme le journal : une erreur se corrige
 * par une nouvelle inspection.
 *
 * <p>Ce qui est copié ici plutôt que lu sur l'équipement (propriétaire,
 * échéances) l'est volontairement : le compte rendu doit rester tel qu'il a
 * été émis, même si la fiche du bloc change ensuite.
 */
@Entity
public class InspectionTiv {

    public enum Motif {
        PERIODIQUE("Inspection périodique (annuelle)"),
        AVANT_REQUALIFICATION("Visite avant requalification"),
        APRES_INCIDENT("Après un incident (choc, chute, eau, vidage complet)"),
        AUTRE("Autre");

        private final String libelle;

        Motif(String libelle) {
            this.libelle = libelle;
        }

        public String libelle() {
            return libelle;
        }
    }

    /** La décision émise à l'issue de l'inspection. */
    public enum Decision {
        FAVORABLE("Favorable au maintien en service"),
        DEFAVORABLE("Défavorable au maintien en service"),
        REBUT("Bouteille rebutée");

        private final String libelle;

        Decision(String libelle) {
            this.libelle = libelle;
        }

        public String libelle() {
            return libelle;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "intervention_id")
    private InterventionEquipement intervention;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private Motif motif;

    @Column(nullable = false, length = 120)
    private String tivNom;

    @Column(nullable = false, length = 30)
    private String tivNumero;

    /** Null = le club. */
    @Column(length = 80)
    private String proprietaire;

    @Column(length = 30)
    private String filetageBouteille;

    @Column(length = 30)
    private String filetageRobinet;

    /** Le poinçon de la dernière requalification relevé sur l'ogive. */
    @Column(length = 80)
    private String marquageRequalification;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Decision decision;

    /** Null si la décision n'est pas favorable. */
    private LocalDate prochaineInspection;

    private LocalDate prochaineRequalification;

    @ElementCollection
    @CollectionTable(name = "constat_tiv", joinColumns = @JoinColumn(name = "inspection_id"))
    @OrderColumn(name = "ordre")
    private List<ConstatTiv> constats = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public InterventionEquipement getIntervention() {
        return intervention;
    }

    public void setIntervention(InterventionEquipement intervention) {
        this.intervention = intervention;
    }

    public Motif getMotif() {
        return motif;
    }

    public void setMotif(Motif motif) {
        this.motif = motif;
    }

    public String getTivNom() {
        return tivNom;
    }

    public void setTivNom(String tivNom) {
        this.tivNom = tivNom;
    }

    public String getTivNumero() {
        return tivNumero;
    }

    public void setTivNumero(String tivNumero) {
        this.tivNumero = tivNumero;
    }

    public String getProprietaire() {
        return proprietaire;
    }

    public void setProprietaire(String proprietaire) {
        this.proprietaire = proprietaire;
    }

    public String getFiletageBouteille() {
        return filetageBouteille;
    }

    public void setFiletageBouteille(String filetageBouteille) {
        this.filetageBouteille = filetageBouteille;
    }

    public String getFiletageRobinet() {
        return filetageRobinet;
    }

    public void setFiletageRobinet(String filetageRobinet) {
        this.filetageRobinet = filetageRobinet;
    }

    public String getMarquageRequalification() {
        return marquageRequalification;
    }

    public void setMarquageRequalification(String marquageRequalification) {
        this.marquageRequalification = marquageRequalification;
    }

    public Decision getDecision() {
        return decision;
    }

    public void setDecision(Decision decision) {
        this.decision = decision;
    }

    public LocalDate getProchaineInspection() {
        return prochaineInspection;
    }

    public void setProchaineInspection(LocalDate prochaineInspection) {
        this.prochaineInspection = prochaineInspection;
    }

    public LocalDate getProchaineRequalification() {
        return prochaineRequalification;
    }

    public void setProchaineRequalification(LocalDate prochaineRequalification) {
        this.prochaineRequalification = prochaineRequalification;
    }

    public List<ConstatTiv> getConstats() {
        return constats;
    }
}
