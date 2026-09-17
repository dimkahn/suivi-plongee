package fr.club.plongee.formation.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.time.LocalDate;

/** Modifiable et supprimable : historisée via Envers (voir fr.club.plongee.audit). */
@Entity
@Audited
public class Seance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Audited(targetAuditMode = org.hibernate.envers.RelationTargetAuditMode.NOT_AUDITED)
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    @Column(nullable = false)
    private LocalDate dateSeance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Milieu milieu;

    private String lieu;

    private Integer profondeurMax;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dp_id")
    private Utilisateur dp;

    @Column(columnDefinition = "text")
    private String commentaire;

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

    public LocalDate getDateSeance() {
        return dateSeance;
    }

    public void setDateSeance(LocalDate dateSeance) {
        this.dateSeance = dateSeance;
    }

    public Milieu getMilieu() {
        return milieu;
    }

    public void setMilieu(Milieu milieu) {
        this.milieu = milieu;
    }

    public String getLieu() {
        return lieu;
    }

    public void setLieu(String lieu) {
        this.lieu = lieu;
    }

    public Integer getProfondeurMax() {
        return profondeurMax;
    }

    public void setProfondeurMax(Integer profondeurMax) {
        this.profondeurMax = profondeurMax;
    }

    public Utilisateur getDp() {
        return dp;
    }

    public void setDp(Utilisateur dp) {
        this.dp = dp;
    }

    public String getCommentaire() {
        return commentaire;
    }

    public void setCommentaire(String commentaire) {
        this.commentaire = commentaire;
    }
}
