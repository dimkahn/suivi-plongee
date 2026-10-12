package fr.club.plongee.progression.domain;

import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Une periode d'une progression type : une plage de mois (qui peut enjamber
 * le changement d'annee, novembre a fevrier par exemple) et les blocs qui y
 * sont travailles. Un bloc peut figurer dans plusieurs periodes successives.
 * Dans une progression decoupee par plongees (V73), une plage de numeros de
 * plongee en milieu naturel de l'eleve remplace la plage de mois.
 */
@Entity
public class PeriodeProgression {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "progression_id")
    private ProgressionType progression;

    @Column(nullable = false)
    private int rang;

    @Column(nullable = false, length = 200)
    private String intitule;

    /** 1 = janvier ... 12 = decembre ; null dans une progression découpée par plongées. */
    private Integer moisDebut;

    private Integer moisFin;

    /**
     * Numéros de plongée en milieu naturel de l'élève (1 = sa première),
     * bornes comprises ; null dans une progression découpée par mois.
     */
    private Integer plongeeDebut;

    private Integer plongeeFin;

    /** Milieu dominant de la periode ; null = indifferent. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Milieu milieu;

    @Column(columnDefinition = "text")
    private String note;

    @ManyToMany
    @JoinTable(name = "periode_progression_bloc",
            joinColumns = @JoinColumn(name = "periode_id"),
            inverseJoinColumns = @JoinColumn(name = "bloc_id"))
    private Set<BlocCompetence> blocs = new LinkedHashSet<>();

    /**
     * Exercices de la base prévus dans la période (V64) : le parcours de
     * l'initiation à la maîtrise. Affichés dans l'ordre des blocs puis des
     * exercices.
     */
    @ManyToMany
    @JoinTable(name = "periode_progression_exercice",
            joinColumns = @JoinColumn(name = "periode_id"),
            inverseJoinColumns = @JoinColumn(name = "exercice_id"))
    private Set<ExerciceCompetence> exercices = new LinkedHashSet<>();

    public Set<ExerciceCompetence> getExercices() {
        return exercices;
    }

    public void setExercices(Set<ExerciceCompetence> exercices) {
        this.exercices = exercices;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ProgressionType getProgression() {
        return progression;
    }

    public void setProgression(ProgressionType progression) {
        this.progression = progression;
    }

    public int getRang() {
        return rang;
    }

    public void setRang(int rang) {
        this.rang = rang;
    }

    public String getIntitule() {
        return intitule;
    }

    public void setIntitule(String intitule) {
        this.intitule = intitule;
    }

    public Integer getMoisDebut() {
        return moisDebut;
    }

    public void setMoisDebut(Integer moisDebut) {
        this.moisDebut = moisDebut;
    }

    public Integer getMoisFin() {
        return moisFin;
    }

    public void setMoisFin(Integer moisFin) {
        this.moisFin = moisFin;
    }

    public Integer getPlongeeDebut() {
        return plongeeDebut;
    }

    public void setPlongeeDebut(Integer plongeeDebut) {
        this.plongeeDebut = plongeeDebut;
    }

    public Integer getPlongeeFin() {
        return plongeeFin;
    }

    public void setPlongeeFin(Integer plongeeFin) {
        this.plongeeFin = plongeeFin;
    }

    public Milieu getMilieu() {
        return milieu;
    }

    public void setMilieu(Milieu milieu) {
        this.milieu = milieu;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Set<BlocCompetence> getBlocs() {
        return blocs;
    }

    public void setBlocs(Set<BlocCompetence> blocs) {
        this.blocs = blocs;
    }
}
