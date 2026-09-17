package fr.club.plongee.evaluation.domain;

import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.time.LocalDate;

/** Historisée via Envers (voir fr.club.plongee.audit) : qui a validé quoi, et quand. */
@Entity
@Audited
public class ValidationCompetence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cursus_id")
    private Cursus cursus;

    @Audited(targetAuditMode = org.hibernate.envers.RelationTargetAuditMode.NOT_AUDITED)
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "bloc_id")
    private BlocCompetence bloc;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "moniteur_id")
    private Utilisateur moniteur;

    @Column(nullable = false)
    private LocalDate dateValidation;

    @Column(columnDefinition = "text")
    private String commentaire;

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

    public BlocCompetence getBloc() {
        return bloc;
    }

    public void setBloc(BlocCompetence bloc) {
        this.bloc = bloc;
    }

    public Utilisateur getMoniteur() {
        return moniteur;
    }

    public void setMoniteur(Utilisateur moniteur) {
        this.moniteur = moniteur;
    }

    public LocalDate getDateValidation() {
        return dateValidation;
    }

    public void setDateValidation(LocalDate dateValidation) {
        this.dateValidation = dateValidation;
    }

    public String getCommentaire() {
        return commentaire;
    }

    public void setCommentaire(String commentaire) {
        this.commentaire = commentaire;
    }
}
