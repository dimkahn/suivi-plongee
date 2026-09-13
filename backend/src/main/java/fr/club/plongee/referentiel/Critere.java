package fr.club.plongee.referentiel;

import jakarta.persistence.*;

@Entity
public class Critere {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "bloc_id")
    private BlocCompetence bloc;

    @Column(nullable = false)
    private int ordre;

    @Column(nullable = false, length = 400)
    private String savoirFaire;

    @Column(columnDefinition = "text")
    private String critereRealisation;

    @Column(columnDefinition = "text")
    private String commentaire;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public BlocCompetence getBloc() {
        return bloc;
    }

    public void setBloc(BlocCompetence bloc) {
        this.bloc = bloc;
    }

    public int getOrdre() {
        return ordre;
    }

    public void setOrdre(int ordre) {
        this.ordre = ordre;
    }

    public String getSavoirFaire() {
        return savoirFaire;
    }

    public void setSavoirFaire(String savoirFaire) {
        this.savoirFaire = savoirFaire;
    }

    public String getCritereRealisation() {
        return critereRealisation;
    }

    public void setCritereRealisation(String critereRealisation) {
        this.critereRealisation = critereRealisation;
    }

    public String getCommentaire() {
        return commentaire;
    }

    public void setCommentaire(String commentaire) {
        this.commentaire = commentaire;
    }
}
