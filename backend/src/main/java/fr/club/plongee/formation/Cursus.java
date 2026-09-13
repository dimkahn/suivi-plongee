package fr.club.plongee.formation;

import fr.club.plongee.referentiel.Referentiel;
import fr.club.plongee.securite.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.time.LocalDate;

/** Historisé via Envers (voir fr.club.plongee.audit) : statut, référent, référentiel figé. */
@Entity
@Audited
public class Cursus {

    public enum Statut { EN_COURS, VALIDE, DELIVRE, SUSPENDU, ABANDON }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @Audited(targetAuditMode = org.hibernate.envers.RelationTargetAuditMode.NOT_AUDITED)
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    /** Fige a l'inscription : la revision du MFT ne s'applique pas retroactivement. */
    @Audited(targetAuditMode = org.hibernate.envers.RelationTargetAuditMode.NOT_AUDITED)
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "referentiel_id")
    private Referentiel referentiel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moniteur_referent_id")
    private Utilisateur moniteurReferent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Statut statut = Statut.EN_COURS;

    @Column(nullable = false)
    private LocalDate ouvertLe = LocalDate.now();

    public boolean modifiable() {
        return statut == Statut.EN_COURS && saison.isOuverte();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Eleve getEleve() {
        return eleve;
    }

    public void setEleve(Eleve eleve) {
        this.eleve = eleve;
    }

    public Saison getSaison() {
        return saison;
    }

    public void setSaison(Saison saison) {
        this.saison = saison;
    }

    public Referentiel getReferentiel() {
        return referentiel;
    }

    public void setReferentiel(Referentiel referentiel) {
        this.referentiel = referentiel;
    }

    public Utilisateur getMoniteurReferent() {
        return moniteurReferent;
    }

    public void setMoniteurReferent(Utilisateur moniteurReferent) {
        this.moniteurReferent = moniteurReferent;
    }

    public Statut getStatut() {
        return statut;
    }

    public void setStatut(Statut statut) {
        this.statut = statut;
    }

    public LocalDate getOuvertLe() {
        return ouvertLe;
    }

    public void setOuvertLe(LocalDate ouvertLe) {
        this.ouvertLe = ouvertLe;
    }
}
