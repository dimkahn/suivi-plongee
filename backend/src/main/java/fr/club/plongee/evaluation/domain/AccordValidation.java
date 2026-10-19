package fr.club.plongee.evaluation.domain;

import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Accord d'un encadrant du groupe pour valider une compétence d'un élève
 * (choix du club, 2026) : la compétence est validée quand la moitié des
 * encadrants du groupe ont donné le leur. Ajout seul, comme les notes :
 * pas d'Envers.
 */
@Entity
public class AccordValidation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cursus_id")
    private Cursus cursus;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "bloc_id")
    private BlocCompetence bloc;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "moniteur_id")
    private Utilisateur moniteur;

    @Column(nullable = false)
    private LocalDate dateAccord;

    public Long getId() {
        return id;
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

    public LocalDate getDateAccord() {
        return dateAccord;
    }

    public void setDateAccord(LocalDate dateAccord) {
        this.dateAccord = dateAccord;
    }
}
