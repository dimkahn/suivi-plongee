package fr.club.plongee.evaluation;

import fr.club.plongee.formation.Cursus;
import fr.club.plongee.formation.Seance;
import fr.club.plongee.referentiel.Critere;
import fr.club.plongee.securite.Utilisateur;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Table en ajout seul : une evaluation n'est jamais modifiee ni supprimee.
 * L'etat courant d'un critere est l'evaluation la plus recente. On obtient
 * ainsi la progression de l'eleve et la tracabilite de qui a note quoi.
 */
@Entity
public class Evaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cursus_id")
    private Cursus cursus;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "critere_id")
    private Critere critere;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id")
    private Seance seance;

    /** Toujours issu du SecurityContext, jamais du corps de la requete. */
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "moniteur_id")
    private Utilisateur moniteur;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutAcquisition statut;

    @Column(columnDefinition = "text")
    private String commentaire;

    /**
     * Date de la seance evaluee, fournie par le client. Distincte de saisiLe :
     * c'est ce qui rend la synchronisation differee possible quand un moniteur
     * saisit hors ligne au bord du bassin.
     */
    @Column(nullable = false)
    private LocalDate dateEvaluation;

    @Column(nullable = false)
    private Instant saisiLe = Instant.now();

    /**
     * Identifiant genere par le client au moment du geste, y compris hors
     * ligne. Rejouer une saisie deja enregistree ne cree pas de doublon.
     */
    @Column(unique = true, length = 36)
    private String referenceClient;

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

    public Critere getCritere() {
        return critere;
    }

    public void setCritere(Critere critere) {
        this.critere = critere;
    }

    public Seance getSeance() {
        return seance;
    }

    public void setSeance(Seance seance) {
        this.seance = seance;
    }

    public Utilisateur getMoniteur() {
        return moniteur;
    }

    public void setMoniteur(Utilisateur moniteur) {
        this.moniteur = moniteur;
    }

    public StatutAcquisition getStatut() {
        return statut;
    }

    public void setStatut(StatutAcquisition statut) {
        this.statut = statut;
    }

    public String getCommentaire() {
        return commentaire;
    }

    public void setCommentaire(String commentaire) {
        this.commentaire = commentaire;
    }

    public LocalDate getDateEvaluation() {
        return dateEvaluation;
    }

    public void setDateEvaluation(LocalDate dateEvaluation) {
        this.dateEvaluation = dateEvaluation;
    }

    public Instant getSaisiLe() {
        return saisiLe;
    }

    public void setSaisiLe(Instant saisiLe) {
        this.saisiLe = saisiLe;
    }

    public String getReferenceClient() {
        return referenceClient;
    }

    public void setReferenceClient(String referenceClient) {
        this.referenceClient = referenceClient;
    }
}
