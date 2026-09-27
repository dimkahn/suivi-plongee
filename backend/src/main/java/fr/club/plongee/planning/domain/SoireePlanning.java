package fr.club.plongee.planning.domain;

import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Ce qui vaut pour toute une soirée du planning : le responsable de séance
 * (distinct du directeur de plongée de la fiche de sécurité) et une note.
 */
@Entity
public class SoireePlanning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    @Column(nullable = false)
    private LocalDate dateSoiree;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsable_id")
    private Utilisateur responsable;

    @Column(length = 200)
    private String note;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Saison getSaison() {
        return saison;
    }

    public void setSaison(Saison saison) {
        this.saison = saison;
    }

    public LocalDate getDateSoiree() {
        return dateSoiree;
    }

    public void setDateSoiree(LocalDate dateSoiree) {
        this.dateSoiree = dateSoiree;
    }

    public Utilisateur getResponsable() {
        return responsable;
    }

    public void setResponsable(Utilisateur responsable) {
        this.responsable = responsable;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
