package fr.club.plongee.evaluation.domain;

import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.domain.PhaseExercice;
import fr.club.plongee.securite.domain.Utilisateur;
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

    /**
     * N2/N3 : note prise en piscine ou en fosse. Suivi d'entrainement, avec
     * son propre etat courant : ne compte jamais pour l'acquisition.
     */
    @Column(nullable = false)
    private boolean entrainement;

    /**
     * Exercice de la base sur lequel le critère a été noté (initiation,
     * perfectionnement ou maîtrise) ; null pour une note sans exercice.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercice_id")
    private ExerciceCompetence exercice;

    /**
     * État de l'exercice noté, tel que saisi par le moniteur ; null sans
     * exercice. {@link #statut} est l'état du critère qui en découle : un
     * exercice d'initiation acquis laisse le critère en cours.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private StatutAcquisition statutExercice;

    /**
     * Exercice libre du programme de la séance sur lequel le critère a été
     * noté : une copie de son intitulé et de sa phase, le programme pouvant
     * être remplacé ensuite. Null sinon.
     */
    @Column(length = 200)
    private String exerciceLibre;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PhaseExercice phaseExercice;

    /** Phase de l'exercice noté, de la base ou libre ; null sans exercice. */
    public PhaseExercice phaseDeLExercice() {
        return exercice != null ? exercice.getPhase() : phaseExercice;
    }

    public String getExerciceLibre() {
        return exerciceLibre;
    }

    public void setExerciceLibre(String exerciceLibre) {
        this.exerciceLibre = exerciceLibre;
    }

    public PhaseExercice getPhaseExercice() {
        return phaseExercice;
    }

    public void setPhaseExercice(PhaseExercice phaseExercice) {
        this.phaseExercice = phaseExercice;
    }

    public StatutAcquisition getStatutExercice() {
        return statutExercice;
    }

    public void setStatutExercice(StatutAcquisition statutExercice) {
        this.statutExercice = statutExercice;
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

    public boolean isEntrainement() {
        return entrainement;
    }

    public void setEntrainement(boolean entrainement) {
        this.entrainement = entrainement;
    }

    public ExerciceCompetence getExercice() {
        return exercice;
    }

    public void setExercice(ExerciceCompetence exercice) {
        this.exercice = exercice;
    }
}
