package fr.club.plongee.referentiel;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
public class BlocCompetence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "referentiel_id")
    private Referentiel referentiel;

    /** C1 a C9 : codes communs aux trois niveaux, intitules et criteres differents. */
    @Column(nullable = false, length = 4)
    private String code;

    @Column(nullable = false)
    private String intitule;

    @Column(nullable = false)
    private int ordre;

    /** C8 : connaissances verifiees au fil des autres competences, pas en seance dediee. */
    @Column(nullable = false)
    private boolean evaluationTransverse;

    /** C6 du N2 : ne peut etre validee qu'une fois les autres blocs acquis. */
    @Column(nullable = false)
    private boolean validerEnDernier;

    @OneToMany(mappedBy = "bloc", fetch = FetchType.LAZY)
    @OrderBy("ordre")
    private List<Critere> criteres = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Referentiel getReferentiel() {
        return referentiel;
    }

    public void setReferentiel(Referentiel referentiel) {
        this.referentiel = referentiel;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getIntitule() {
        return intitule;
    }

    public void setIntitule(String intitule) {
        this.intitule = intitule;
    }

    public int getOrdre() {
        return ordre;
    }

    public void setOrdre(int ordre) {
        this.ordre = ordre;
    }

    public boolean isEvaluationTransverse() {
        return evaluationTransverse;
    }

    public void setEvaluationTransverse(boolean evaluationTransverse) {
        this.evaluationTransverse = evaluationTransverse;
    }

    public boolean isValiderEnDernier() {
        return validerEnDernier;
    }

    public void setValiderEnDernier(boolean validerEnDernier) {
        this.validerEnDernier = validerEnDernier;
    }

    public List<Critere> getCriteres() {
        return criteres;
    }

    public void setCriteres(List<Critere> criteres) {
        this.criteres = criteres;
    }
}
