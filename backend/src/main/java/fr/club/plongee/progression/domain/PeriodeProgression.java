package fr.club.plongee.progression.domain;

import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Une periode d'une progression type : une plage de mois (qui peut enjamber
 * le changement d'annee, novembre a fevrier par exemple) et les blocs qui y
 * sont travailles. Un bloc peut figurer dans plusieurs periodes successives.
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

    /** 1 = janvier ... 12 = decembre. */
    @Column(nullable = false)
    private int moisDebut;

    @Column(nullable = false)
    private int moisFin;

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

    public int getMoisDebut() {
        return moisDebut;
    }

    public void setMoisDebut(int moisDebut) {
        this.moisDebut = moisDebut;
    }

    public int getMoisFin() {
        return moisFin;
    }

    public void setMoisFin(int moisFin) {
        this.moisFin = moisFin;
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
