package fr.club.plongee.materiel.domain;

import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Un équipement du club et sa fiche de gestion (Code du sport, annexe
 * III-27) : référence précise, notice, dates d'achat, de mise en service
 * et de mise au rebut, organisation de l'entretien. Le journal des
 * interventions est à part ({@link InterventionEquipement}). Les colonnes
 * propres à un type (volume d'un bloc, épaisseur d'une combinaison...)
 * restent nulles pour les autres. Historisé par Envers.
 */
@Entity
@Audited
public class Equipement {

    public enum Matiere { ACIER, ALUMINIUM }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;


    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private TypeEquipement type;

    /** Marquage du club (B-12, D-03...), unique. */
    @Column(nullable = false, length = 30, unique = true)
    private String reference;

    @Column(length = 80)
    private String marque;

    @Column(length = 80)
    private String modele;

    @Column(length = 60)
    private String numeroSerie;

    @Column(length = 20)
    private String taille;

    private LocalDate dateFabrication;

    private LocalDate dateAchat;

    private LocalDate dateMiseEnService;

    /** Pour les EPI sujets au vieillissement : au-delà, plus de prêt. */
    private LocalDate dateRebutPrevue;

    /** Où trouver la notice du fabricant (classeur, lien...). */
    @Column(length = 255)
    private String notice;

    /** Organisation du maintien en conformité, d'après la notice. */
    @Column(columnDefinition = "text")
    private String consignesEntretien;

    /** Révision préconisée par le fabricant (détendeurs, gilets) ; null = pas de suivi d'échéance. */
    private Integer periodiciteRevisionMois;

    @Column(precision = 4, scale = 1)
    private BigDecimal volumeLitres;

    private Integer pressionServiceBar;

    private Integer pressionEpreuveBar;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Matiere matiere;

    @Column(length = 80)
    private String robinetterie;

    /** Poinçon de la première épreuve : base de la requalification tant qu'aucune n'est enregistrée. */
    private LocalDate datePremiereEpreuve;

    @Column(nullable = false)
    private boolean nitrox;

    /** Inspection annuelle par un TIV : requalification tous les 6 ans au lieu de 2. */
    @Column(nullable = false)
    private boolean regimeTiv = true;

    /** 1er étage, 2e étage, octopus, manomètre : l'assemblage conditionne la conformité EN 250. */
    @Column(length = 255)
    private String composition;

    @Column(precision = 3, scale = 1)
    private BigDecimal epaisseurMm;

    @Column(nullable = false)
    private boolean horsService;

    /** Date effective de mise au rebut ou de sortie du stock ; null tant qu'il est en service. */
    private LocalDate dateRebut;

    @Column(length = 255)
    private String motifRebut;

    @Column(columnDefinition = "text")
    private String remarques;

    public boolean estRebute() {
        return dateRebut != null;
    }

    /** « Bloc B-12 », pour les messages. */
    public String designation() {
        return type.libelle() + " " + reference;
    }

    public Long getId() {
        return id;
    }

    public TypeEquipement getType() {
        return type;
    }

    public void setType(TypeEquipement type) {
        this.type = type;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getMarque() {
        return marque;
    }

    public void setMarque(String marque) {
        this.marque = marque;
    }

    public String getModele() {
        return modele;
    }

    public void setModele(String modele) {
        this.modele = modele;
    }

    public String getNumeroSerie() {
        return numeroSerie;
    }

    public void setNumeroSerie(String numeroSerie) {
        this.numeroSerie = numeroSerie;
    }

    public String getTaille() {
        return taille;
    }

    public void setTaille(String taille) {
        this.taille = taille;
    }

    public LocalDate getDateFabrication() {
        return dateFabrication;
    }

    public void setDateFabrication(LocalDate dateFabrication) {
        this.dateFabrication = dateFabrication;
    }

    public LocalDate getDateAchat() {
        return dateAchat;
    }

    public void setDateAchat(LocalDate dateAchat) {
        this.dateAchat = dateAchat;
    }

    public LocalDate getDateMiseEnService() {
        return dateMiseEnService;
    }

    public void setDateMiseEnService(LocalDate dateMiseEnService) {
        this.dateMiseEnService = dateMiseEnService;
    }

    public LocalDate getDateRebutPrevue() {
        return dateRebutPrevue;
    }

    public void setDateRebutPrevue(LocalDate dateRebutPrevue) {
        this.dateRebutPrevue = dateRebutPrevue;
    }

    public String getNotice() {
        return notice;
    }

    public void setNotice(String notice) {
        this.notice = notice;
    }

    public String getConsignesEntretien() {
        return consignesEntretien;
    }

    public void setConsignesEntretien(String consignesEntretien) {
        this.consignesEntretien = consignesEntretien;
    }

    public Integer getPeriodiciteRevisionMois() {
        return periodiciteRevisionMois;
    }

    public void setPeriodiciteRevisionMois(Integer periodiciteRevisionMois) {
        this.periodiciteRevisionMois = periodiciteRevisionMois;
    }

    public BigDecimal getVolumeLitres() {
        return volumeLitres;
    }

    public void setVolumeLitres(BigDecimal volumeLitres) {
        this.volumeLitres = volumeLitres;
    }

    public Integer getPressionServiceBar() {
        return pressionServiceBar;
    }

    public void setPressionServiceBar(Integer pressionServiceBar) {
        this.pressionServiceBar = pressionServiceBar;
    }

    public Integer getPressionEpreuveBar() {
        return pressionEpreuveBar;
    }

    public void setPressionEpreuveBar(Integer pressionEpreuveBar) {
        this.pressionEpreuveBar = pressionEpreuveBar;
    }

    public Matiere getMatiere() {
        return matiere;
    }

    public void setMatiere(Matiere matiere) {
        this.matiere = matiere;
    }

    public String getRobinetterie() {
        return robinetterie;
    }

    public void setRobinetterie(String robinetterie) {
        this.robinetterie = robinetterie;
    }

    public LocalDate getDatePremiereEpreuve() {
        return datePremiereEpreuve;
    }

    public void setDatePremiereEpreuve(LocalDate datePremiereEpreuve) {
        this.datePremiereEpreuve = datePremiereEpreuve;
    }

    public boolean isNitrox() {
        return nitrox;
    }

    public void setNitrox(boolean nitrox) {
        this.nitrox = nitrox;
    }

    public boolean isRegimeTiv() {
        return regimeTiv;
    }

    public void setRegimeTiv(boolean regimeTiv) {
        this.regimeTiv = regimeTiv;
    }

    public String getComposition() {
        return composition;
    }

    public void setComposition(String composition) {
        this.composition = composition;
    }

    public BigDecimal getEpaisseurMm() {
        return epaisseurMm;
    }

    public void setEpaisseurMm(BigDecimal epaisseurMm) {
        this.epaisseurMm = epaisseurMm;
    }

    public boolean isHorsService() {
        return horsService;
    }

    public void setHorsService(boolean horsService) {
        this.horsService = horsService;
    }

    public LocalDate getDateRebut() {
        return dateRebut;
    }

    public void setDateRebut(LocalDate dateRebut) {
        this.dateRebut = dateRebut;
    }

    public String getMotifRebut() {
        return motifRebut;
    }

    public void setMotifRebut(String motifRebut) {
        this.motifRebut = motifRebut;
    }

    public String getRemarques() {
        return remarques;
    }

    public void setRemarques(String remarques) {
        this.remarques = remarques;
    }
}
