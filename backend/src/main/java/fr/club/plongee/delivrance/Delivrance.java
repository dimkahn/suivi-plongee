package fr.club.plongee.delivrance;

import fr.club.plongee.formation.Cursus;
import fr.club.plongee.securite.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.time.LocalDate;

/** Historisée via Envers (voir fr.club.plongee.audit) : la délivrance d'un brevet ne se refait pas. */
@Entity
@Audited
public class Delivrance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cursus_id")
    private Cursus cursus;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "delivre_par_id")
    private Utilisateur delivrePar;

    @Column(nullable = false)
    private LocalDate dateDelivrance;

    private String numeroBrevet;

    /**
     * N1 obtenu en milieu artificiel : 4 plongees en milieu naturel a attester
     * sur le carnet dans les douze mois suivant la certification.
     */
    @Column(name = "plongees_milieu_naturel_a_faire", nullable = false)
    private int plongeesMilieuNaturelAFaire = 0;

    private LocalDate echeancePlongees;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Cursus getCursus() {
        return cursus;
    }

    public void setCursus(Cursus cursus) {
        this.cursus = cursus;
    }

    public Utilisateur getDelivrePar() {
        return delivrePar;
    }

    public void setDelivrePar(Utilisateur delivrePar) {
        this.delivrePar = delivrePar;
    }

    public LocalDate getDateDelivrance() {
        return dateDelivrance;
    }

    public void setDateDelivrance(LocalDate dateDelivrance) {
        this.dateDelivrance = dateDelivrance;
    }

    public String getNumeroBrevet() {
        return numeroBrevet;
    }

    public void setNumeroBrevet(String numeroBrevet) {
        this.numeroBrevet = numeroBrevet;
    }

    public int getPlongeesMilieuNaturelAFaire() {
        return plongeesMilieuNaturelAFaire;
    }

    public void setPlongeesMilieuNaturelAFaire(int plongeesMilieuNaturelAFaire) {
        this.plongeesMilieuNaturelAFaire = plongeesMilieuNaturelAFaire;
    }

    public LocalDate getEcheancePlongees() {
        return echeancePlongees;
    }

    public void setEcheancePlongees(LocalDate echeancePlongees) {
        this.echeancePlongees = echeancePlongees;
    }
}
