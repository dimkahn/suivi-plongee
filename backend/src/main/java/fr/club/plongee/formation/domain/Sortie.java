package fr.club.plongee.formation.domain;

import jakarta.persistence.*;
import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Une sortie (week-end en carrière, séjour en mer...) et les séances
 * choisies pour elle, toutes dans ses dates. Une séance appartient au plus
 * à une sortie (contrainte en base). Les prêts de matériel s'y rattachent.
 */
@Entity
@Audited
public class Sortie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String nom;

    @Column(length = 120)
    private String lieu;

    @Column(nullable = false)
    private LocalDate dateDebut;

    @Column(nullable = false)
    private LocalDate dateFin;

    @Column(columnDefinition = "text")
    private String remarques;

    /** Pas de table _aud pour la liaison (même choix que les équipements d'un prêt). */
    @NotAudited
    @ManyToMany
    @JoinTable(name = "sortie_seance",
            joinColumns = @JoinColumn(name = "sortie_id"),
            inverseJoinColumns = @JoinColumn(name = "seance_id"))
    private Set<Seance> seances = new LinkedHashSet<>();

    /** Deux séances d'une même plongée (deux bateaux, deux groupes) comptent pour une. */
    public int nombrePlongees() {
        return (int) seances.stream().map(s -> s.getDateSeance() + "#" + s.getOrdre()).distinct().count();
    }

    public Long getId() {
        return id;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getLieu() {
        return lieu;
    }

    public void setLieu(String lieu) {
        this.lieu = lieu;
    }

    public LocalDate getDateDebut() {
        return dateDebut;
    }

    public void setDateDebut(LocalDate dateDebut) {
        this.dateDebut = dateDebut;
    }

    public LocalDate getDateFin() {
        return dateFin;
    }

    public void setDateFin(LocalDate dateFin) {
        this.dateFin = dateFin;
    }

    public String getRemarques() {
        return remarques;
    }

    public void setRemarques(String remarques) {
        this.remarques = remarques;
    }

    public Set<Seance> getSeances() {
        return seances;
    }
}
