package fr.club.plongee.referentiel.domain;

import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Un exercice type de la base d'exercices, rattaché à une compétence (bloc)
 * d'une version du MFT. Il sert à préparer le programme d'une séance et il
 * est noté avec chaque évaluation d'un critère de sa compétence. Modifiable
 * depuis l'écran d'administration ; un exercice déjà noté ne se supprime pas,
 * il se désactive (la table evaluation est en ajout seul).
 */
@Entity
public class ExerciceCompetence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "bloc_id")
    private BlocCompetence bloc;

    /** Numéro affiché, celui du document du club (« 1.7 ») : unique dans la compétence. */
    @Column(nullable = false, length = 10)
    private String numero;

    @Column(nullable = false)
    private int ordre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PhaseExercice phase;

    @Column(nullable = false, length = 200)
    private String intitule;

    /** Organisation et déroulement. */
    @Column(columnDefinition = "text")
    private String deroulement;

    @Column(columnDefinition = "text")
    private String critereReussite;

    /** Désactivé : n'est plus proposé, mais reste lisible sur les notes passées. */
    @Column(nullable = false)
    private boolean actif = true;

    /** Critères de sa compétence que l'exercice fait travailler (au moins un). */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "exercice_competence_critere",
            joinColumns = @JoinColumn(name = "exercice_id"),
            inverseJoinColumns = @JoinColumn(name = "critere_id"))
    private Set<Critere> criteres = new LinkedHashSet<>();

    public Set<Critere> getCriteres() {
        return criteres;
    }

    public boolean travaille(Critere critere) {
        return criteres.stream().anyMatch(c -> c.getId().equals(critere.getId()));
    }

    public Long getId() {
        return id;
    }

    public BlocCompetence getBloc() {
        return bloc;
    }

    public void setBloc(BlocCompetence bloc) {
        this.bloc = bloc;
    }

    public String getNumero() {
        return numero;
    }

    public void setNumero(String numero) {
        this.numero = numero;
    }

    public int getOrdre() {
        return ordre;
    }

    public void setOrdre(int ordre) {
        this.ordre = ordre;
    }

    public PhaseExercice getPhase() {
        return phase;
    }

    public void setPhase(PhaseExercice phase) {
        this.phase = phase;
    }

    public String getIntitule() {
        return intitule;
    }

    public void setIntitule(String intitule) {
        this.intitule = intitule;
    }

    public String getDeroulement() {
        return deroulement;
    }

    public void setDeroulement(String deroulement) {
        this.deroulement = deroulement;
    }

    public String getCritereReussite() {
        return critereReussite;
    }

    public void setCritereReussite(String critereReussite) {
        this.critereReussite = critereReussite;
    }

    public boolean isActif() {
        return actif;
    }

    public void setActif(boolean actif) {
        this.actif = actif;
    }

    /** « 1.7 Gréage avec anomalie cachée ». */
    public String libelle() {
        return numero + " " + intitule;
    }
}
