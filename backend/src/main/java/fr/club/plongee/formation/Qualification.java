package fr.club.plongee.formation;

import jakarta.persistence.*;

import java.time.LocalDate;

/** Brevets et qualifications detenus : N1, N2, N3, RIFAP, PE40, PA20, NITROX... */
@Entity
public class Qualification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private LocalDate dateObtention;

    private LocalDate expireLe;

    public boolean valideAu(LocalDate date) {
        return !dateObtention.isAfter(date) && (expireLe == null || !expireLe.isBefore(date));
    }

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public LocalDate getDateObtention() {
        return dateObtention;
    }

    public void setDateObtention(LocalDate dateObtention) {
        this.dateObtention = dateObtention;
    }

    public LocalDate getExpireLe() {
        return expireLe;
    }

    public void setExpireLe(LocalDate expireLe) {
        this.expireLe = expireLe;
    }
}
