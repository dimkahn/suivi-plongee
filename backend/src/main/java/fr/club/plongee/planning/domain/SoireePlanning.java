package fr.club.plongee.planning.domain;

import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Ce qui vaut pour toute une soirée du planning : le DP fosse, le DP piscine
 * (distincts du directeur de plongée de la fiche de sécurité) et une note.
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

    /** Colonne historique {@code responsable_id} : les anciens responsables de séance sont devenus DP fosse. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsable_id")
    private Utilisateur dpFosse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dp_piscine_id")
    private Utilisateur dpPiscine;

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

    public Utilisateur getDpFosse() {
        return dpFosse;
    }

    public void setDpFosse(Utilisateur dpFosse) {
        this.dpFosse = dpFosse;
    }

    public Utilisateur getDpPiscine() {
        return dpPiscine;
    }

    public void setDpPiscine(Utilisateur dpPiscine) {
        this.dpPiscine = dpPiscine;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
