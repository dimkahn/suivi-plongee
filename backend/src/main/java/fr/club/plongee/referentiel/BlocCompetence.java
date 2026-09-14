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

    /**
     * Texte libre porte par les revisions post-PE20 (decembre 2025) du MFT,
     * qui ont abandonne les paires savoir-faire/critere de realisation au
     * profit d'une structure Technique/Comportement/Theorie par competence.
     * Nullable : les blocs des revisions anterieures n'ont pas cette matiere.
     */
    @Column(columnDefinition = "text")
    private String competenceAttendue;

    @Column(columnDefinition = "text")
    private String comportement;

    @Column(columnDefinition = "text")
    private String theorie;

    @Column(columnDefinition = "text")
    private String modalitesEvaluation;

    /**
     * Etiquette d'affichage ("Commun", "PA20", "PE40"...) pour les niveaux
     * qui se scindent en plusieurs qualifications (N2 = PA20 + PE40, N3 =
     * PA40 + PE60 + competences complementaires) fusionnees en un seul
     * referentiel plutot que suivies separement (voir CLAUDE.md). Nullable :
     * sans objet pour un niveau qui ne se scinde pas.
     */
    @Column(length = 40)
    private String regroupement;

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

    public String getCompetenceAttendue() {
        return competenceAttendue;
    }

    public void setCompetenceAttendue(String competenceAttendue) {
        this.competenceAttendue = competenceAttendue;
    }

    public String getComportement() {
        return comportement;
    }

    public void setComportement(String comportement) {
        this.comportement = comportement;
    }

    public String getTheorie() {
        return theorie;
    }

    public void setTheorie(String theorie) {
        this.theorie = theorie;
    }

    public String getModalitesEvaluation() {
        return modalitesEvaluation;
    }

    public void setModalitesEvaluation(String modalitesEvaluation) {
        this.modalitesEvaluation = modalitesEvaluation;
    }

    public String getRegroupement() {
        return regroupement;
    }

    public void setRegroupement(String regroupement) {
        this.regroupement = regroupement;
    }

    public List<Critere> getCriteres() {
        return criteres;
    }

    public void setCriteres(List<Critere> criteres) {
        this.criteres = criteres;
    }
}
