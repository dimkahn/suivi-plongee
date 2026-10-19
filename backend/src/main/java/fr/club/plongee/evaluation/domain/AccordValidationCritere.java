package fr.club.plongee.evaluation.domain;

import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.referentiel.domain.Critere;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.LocalDate;

/** Accord d'un encadrant du groupe pour valider un critère technique seul (V94). Ajout seul. */
@Entity
public class AccordValidationCritere {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cursus_id")
    private Cursus cursus;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "critere_id")
    private Critere critere;

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

    public Critere getCritere() {
        return critere;
    }

    public void setCritere(Critere critere) {
        this.critere = critere;
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
