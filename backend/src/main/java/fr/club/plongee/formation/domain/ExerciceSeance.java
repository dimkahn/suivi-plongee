package fr.club.plongee.formation.domain;

import fr.club.plongee.planning.domain.GroupeEntrainement;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import fr.club.plongee.referentiel.domain.Referentiel;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Un exercice du programme d'une séance. Rattaché à une formation (version
 * du MFT) et aux critères qu'il fait travailler, il éclaire la fiche de suivi
 * des élèves présents ; sans formation, c'est un exercice commun (échauffement,
 * nage) sans critère. Chaque groupe d'entraînement a son propre programme
 * pour la séance. Pas d'historique : le programme se remplace d'un bloc.
 */
@Entity
public class ExerciceSeance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id")
    private Seance seance;

    /** Groupe d'entraînement qui prépare cet exercice ; null : programme commun à toute la séance. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_id")
    private GroupeEntrainement groupe;

    /** Null : exercice commun à toutes les formations, sans critère. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referentiel_id")
    private Referentiel referentiel;

    @Column(nullable = false)
    private int ordre;

    @Column(nullable = false, length = 200)
    private String intitule;

    @Column(columnDefinition = "text")
    private String consignes;

    private Integer dureeMinutes;

    /** Exercice de la base d'exercices dont celui-ci est tiré ; null pour un exercice libre. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercice_competence_id")
    private ExerciceCompetence exerciceCompetence;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "exercice_seance_critere",
            joinColumns = @JoinColumn(name = "exercice_id"),
            inverseJoinColumns = @JoinColumn(name = "critere_id"))
    private Set<Critere> criteres = new LinkedHashSet<>();

    public Long getId() {
        return id;
    }

    public Seance getSeance() {
        return seance;
    }

    public void setSeance(Seance seance) {
        this.seance = seance;
    }

    public GroupeEntrainement getGroupe() {
        return groupe;
    }

    public void setGroupe(GroupeEntrainement groupe) {
        this.groupe = groupe;
    }

    public Referentiel getReferentiel() {
        return referentiel;
    }

    public void setReferentiel(Referentiel referentiel) {
        this.referentiel = referentiel;
    }

    public int getOrdre() {
        return ordre;
    }

    public void setOrdre(int ordre) {
        this.ordre = ordre;
    }

    public String getIntitule() {
        return intitule;
    }

    public void setIntitule(String intitule) {
        this.intitule = intitule;
    }

    public String getConsignes() {
        return consignes;
    }

    public void setConsignes(String consignes) {
        this.consignes = consignes;
    }

    public Integer getDureeMinutes() {
        return dureeMinutes;
    }

    public void setDureeMinutes(Integer dureeMinutes) {
        this.dureeMinutes = dureeMinutes;
    }

    public ExerciceCompetence getExerciceCompetence() {
        return exerciceCompetence;
    }

    public void setExerciceCompetence(ExerciceCompetence exerciceCompetence) {
        this.exerciceCompetence = exerciceCompetence;
    }

    public Set<Critere> getCriteres() {
        return criteres;
    }
}
