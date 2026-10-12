package fr.club.plongee.formation.domain;

import jakarta.persistence.*;

@Entity
public class Participation {

    public enum Statut { PRESENT, ABSENT, EXCUSE }

    /** Ce que l'eleve a fait pendant la seance : la colonne Nage / Bloc du tableur. */
    public enum Atelier { NAGE, BLOC, THEORIE, PLONGEE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cursus_id")
    private Cursus cursus;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id")
    private Seance seance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Statut statut;

    @Enumerated(EnumType.STRING)
    private Atelier atelier;

    /**
     * Théorie faite pendant la séance, en plus de la nage ou du bloc ;
     * toujours vraie pour l'atelier THEORIE (théorie seule).
     */
    @Column(nullable = false)
    private boolean theorie;

    @Column(columnDefinition = "text")
    private String commentaire;

    /**
     * Ce que l'élève a fait, tel que l'affichent les écrans : l'atelier
     * (« BLOC »), suivi de « +THEORIE » s'il a fait de la théorie en plus ;
     * null si rien n'est précisé.
     */
    public String codeAtelier() {
        if (atelier == null) return null;
        return theorie && atelier != Atelier.THEORIE ? atelier.name() + "+THEORIE" : atelier.name();
    }

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

    public Seance getSeance() {
        return seance;
    }

    public void setSeance(Seance seance) {
        this.seance = seance;
    }

    public Statut getStatut() {
        return statut;
    }

    public void setStatut(Statut statut) {
        this.statut = statut;
    }

    public Atelier getAtelier() {
        return atelier;
    }

    public void setAtelier(Atelier atelier) {
        this.atelier = atelier;
    }

    public boolean isTheorie() {
        return theorie;
    }

    public void setTheorie(boolean theorie) {
        this.theorie = theorie;
    }

    public String getCommentaire() {
        return commentaire;
    }

    public void setCommentaire(String commentaire) {
        this.commentaire = commentaire;
    }
}
