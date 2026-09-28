package fr.club.plongee.materiel.domain;

import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Prêt de matériel à un élève ou à un encadrant, pour une sortie (séance
 * en milieu naturel) ou un autre motif. {@code dateRetour} null = en cours.
 * {@code emprunteurNom} garde le nom tel qu'au moment du prêt : le lien vers
 * l'élève ou le compte peut disparaître, la traçabilité du matériel reste.
 */
@Entity
@Audited
public class Pret {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Column(nullable = false, length = 170)
    private String emprunteurNom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id")
    private Seance seance;

    @Column(length = 120)
    private String motif;

    @Column(nullable = false)
    private LocalDate datePret;

    private LocalDate dateRetourPrevue;

    private LocalDate dateRetour;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prete_par_id")
    private Utilisateur pretePar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recu_par_id")
    private Utilisateur recuPar;

    @Column(columnDefinition = "text")
    private String remarques;

    /** Fixé à la création du prêt : pas de table _aud pour la liaison (même choix que les rôles d'un utilisateur). */
    @NotAudited
    @ManyToMany
    @JoinTable(name = "pret_equipement",
            joinColumns = @JoinColumn(name = "pret_id"),
            inverseJoinColumns = @JoinColumn(name = "equipement_id"))
    private Set<Equipement> equipements = new LinkedHashSet<>();

    public boolean estEnCours() {
        return dateRetour == null;
    }

    public Long getId() {
        return id;
    }

    public Eleve getEleve() {
        return eleve;
    }

    public void setEleve(Eleve eleve) {
        this.eleve = eleve;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public String getEmprunteurNom() {
        return emprunteurNom;
    }

    public void setEmprunteurNom(String emprunteurNom) {
        this.emprunteurNom = emprunteurNom;
    }

    public Seance getSeance() {
        return seance;
    }

    public void setSeance(Seance seance) {
        this.seance = seance;
    }

    public String getMotif() {
        return motif;
    }

    public void setMotif(String motif) {
        this.motif = motif;
    }

    public LocalDate getDatePret() {
        return datePret;
    }

    public void setDatePret(LocalDate datePret) {
        this.datePret = datePret;
    }

    public LocalDate getDateRetourPrevue() {
        return dateRetourPrevue;
    }

    public void setDateRetourPrevue(LocalDate dateRetourPrevue) {
        this.dateRetourPrevue = dateRetourPrevue;
    }

    public LocalDate getDateRetour() {
        return dateRetour;
    }

    public void setDateRetour(LocalDate dateRetour) {
        this.dateRetour = dateRetour;
    }

    public Utilisateur getPretePar() {
        return pretePar;
    }

    public void setPretePar(Utilisateur pretePar) {
        this.pretePar = pretePar;
    }

    public Utilisateur getRecuPar() {
        return recuPar;
    }

    public void setRecuPar(Utilisateur recuPar) {
        this.recuPar = recuPar;
    }

    public String getRemarques() {
        return remarques;
    }

    public void setRemarques(String remarques) {
        this.remarques = remarques;
    }

    public Set<Equipement> getEquipements() {
        return equipements;
    }
}
