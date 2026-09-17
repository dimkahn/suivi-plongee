package fr.club.plongee.formation.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;

/** Dossier élève : historisé via Envers (voir fr.club.plongee.audit), y compris les consentements. */
@Entity
@Audited
public class Eleve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String prenom;

    private LocalDate dateNaissance;

    private String numeroLicence;

    /**
     * Donnee de sante : on ne conserve que la date de fin de validite,
     * jamais le certificat medical lui-meme.
     */
    private LocalDate certificatValideJusquAu;

    @Column(nullable = false)
    private boolean autorisationLegale = false;

    /**
     * Droit à l'image : consentement distinct de autorisationLegale (qui ne
     * couvre que la pratique). Une photo n'est jamais affichée sans lui.
     */
    @Column(nullable = false)
    private boolean autorisationImage = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    private Instant archiveLe;

    public String nomComplet() {
        return prenom + " " + nom;
    }

    public Integer ageAu(LocalDate date) {
        return dateNaissance == null ? null : Period.between(dateNaissance, date).getYears();
    }

    public boolean certificatValideAu(LocalDate date) {
        return certificatValideJusquAu != null && !certificatValideJusquAu.isBefore(date);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getPrenom() {
        return prenom;
    }

    public void setPrenom(String prenom) {
        this.prenom = prenom;
    }

    public LocalDate getDateNaissance() {
        return dateNaissance;
    }

    public void setDateNaissance(LocalDate dateNaissance) {
        this.dateNaissance = dateNaissance;
    }

    public String getNumeroLicence() {
        return numeroLicence;
    }

    public void setNumeroLicence(String numeroLicence) {
        this.numeroLicence = numeroLicence;
    }

    public LocalDate getCertificatValideJusquAu() {
        return certificatValideJusquAu;
    }

    public void setCertificatValideJusquAu(LocalDate certificatValideJusquAu) {
        this.certificatValideJusquAu = certificatValideJusquAu;
    }

    public boolean isAutorisationLegale() {
        return autorisationLegale;
    }

    public void setAutorisationLegale(boolean autorisationLegale) {
        this.autorisationLegale = autorisationLegale;
    }

    public boolean isAutorisationImage() {
        return autorisationImage;
    }

    public void setAutorisationImage(boolean autorisationImage) {
        this.autorisationImage = autorisationImage;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public Instant getArchiveLe() {
        return archiveLe;
    }

    public void setArchiveLe(Instant archiveLe) {
        this.archiveLe = archiveLe;
    }
}
