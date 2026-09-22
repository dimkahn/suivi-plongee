package fr.club.plongee.formation.domain;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
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

    /**
     * Rang de la séance dans sa journée (1, 2, 3…), pour distinguer plusieurs
     * séances à la même date (ex. bassin le matin et l'après-midi, ou deux
     * rotations de plongée le même jour) et pour numéroter la plongée sur la
     * fiche de sécurité imprimée (« Plongée n° »).
     */
    @Column(nullable = false)
    private Integer ordre = 1;

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

    /**
     * Une séance à venir se prépare (création, fiche de sécurité prévue) mais
     * ne se remplit pas : ni évaluation, ni présence, ni profil réalisé.
     */
    public boolean estAVenir() {
        return dateSeance.isAfter(Calendrier.aujourdhui());
    }

    /** Refuse de remplir une séance à venir ; {@code quoi} complète le message (« noter une compétence »). */
    public void verifierQueLaSeanceAEuLieu(String quoi) {
        if (estAVenir()) {
            throw new RegleMetierException(
                    "La séance du " + dateSeance.format(Calendrier.DATE_FR)
                            + " n'a pas encore eu lieu : impossible d'y " + quoi + ".");
        }
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

    public Integer getOrdre() {
        return ordre;
    }

    public void setOrdre(Integer ordre) {
        this.ordre = ordre;
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
