package fr.club.plongee.materiel.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Une ligne du journal d'un équipement. Table en AJOUT SEUL, comme
 * {@code evaluation} : c'est l'historique exigé par la fiche de gestion
 * (annexe III-27). Une erreur se corrige par une nouvelle ligne.
 */
@Entity
public class InterventionEquipement {

    public enum Resultat { CONFORME, NON_CONFORME }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "equipement_id")
    private Equipement equipement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TypeIntervention type;

    @Column(nullable = false)
    private LocalDate dateIntervention;

    /** Le TIV (nom, numéro), l'atelier, l'organisme de requalification... */
    @Column(length = 120)
    private String intervenant;

    /** Null pour ce qui n'est pas un contrôle (désinfection, réparation sans essai...). */
    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private Resultat resultat;

    @Column(columnDefinition = "text")
    private String description;

    /** Renseigné quand la ligne vient d'un prêt : désinfection à la remise, incident au retour. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pret_id")
    private Pret pret;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisi_par_id")
    private Utilisateur saisiPar;

    @Column(nullable = false)
    private Instant saisiLe = Instant.now();

    public Long getId() {
        return id;
    }

    public Equipement getEquipement() {
        return equipement;
    }

    public void setEquipement(Equipement equipement) {
        this.equipement = equipement;
    }

    public TypeIntervention getType() {
        return type;
    }

    public void setType(TypeIntervention type) {
        this.type = type;
    }

    public LocalDate getDateIntervention() {
        return dateIntervention;
    }

    public void setDateIntervention(LocalDate dateIntervention) {
        this.dateIntervention = dateIntervention;
    }

    public String getIntervenant() {
        return intervenant;
    }

    public void setIntervenant(String intervenant) {
        this.intervenant = intervenant;
    }

    public Resultat getResultat() {
        return resultat;
    }

    public void setResultat(Resultat resultat) {
        this.resultat = resultat;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Pret getPret() {
        return pret;
    }

    public void setPret(Pret pret) {
        this.pret = pret;
    }

    public Utilisateur getSaisiPar() {
        return saisiPar;
    }

    public void setSaisiPar(Utilisateur saisiPar) {
        this.saisiPar = saisiPar;
    }

    public Instant getSaisiLe() {
        return saisiLe;
    }
}
