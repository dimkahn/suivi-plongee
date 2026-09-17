package fr.club.plongee.formation.domain;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Appartenance d'un élève à une saison, sans référentiel ni formation
 * associée : pour un élève déjà breveté qui continue de plonger avec le
 * club sans viser un nouveau niveau. Ne pas confondre avec {@link Cursus},
 * qui fige une formation N1/N2/N3 ; un élève peut avoir les deux (rare,
 * pas interdit) ou l'un sans l'autre selon les saisons.
 */
@Entity
@Table(name = "adhesion_saison")
public class AdhesionSaison {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    @Column(nullable = false)
    private LocalDate adhereLe = LocalDate.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Eleve getEleve() {
        return eleve;
    }

    public void setEleve(Eleve eleve) {
        this.eleve = eleve;
    }

    public Saison getSaison() {
        return saison;
    }

    public void setSaison(Saison saison) {
        this.saison = saison;
    }

    public LocalDate getAdhereLe() {
        return adhereLe;
    }

    public void setAdhereLe(LocalDate adhereLe) {
        this.adhereLe = adhereLe;
    }
}
