package fr.club.plongee.securite.domain;

import fr.club.plongee.commun.ActiviteCaci;
import fr.club.plongee.commun.Caci;
import fr.club.plongee.commun.ConvertisseurActivitesCaci;
import fr.club.plongee.commun.MedecinCaci;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;

import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Set;

/** Comptes moniteurs/admin gérés à la main : historisés via Envers (voir fr.club.plongee.audit). */
@Entity
@Audited
public class Utilisateur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String motDePasse;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String prenom;

    @Column(nullable = false)
    private boolean actif = true;

    /** Renseigne uniquement pour un encadrant. */
    @Enumerated(EnumType.STRING)
    private NiveauEncadrement niveauEncadrement;

    /**
     * Niveau de plongeur (N1 à N5), distinct du niveau d'encadrement : un E1
     * peut n'être que N2. Saisi par un ADMIN ; null tant qu'il est inconnu.
     */
    @Column(length = 2)
    private String niveauPlongeur;

    private String numeroLicence;

    /**
     * Fin de validite du CACI de l'encadrant, deduite de la date de l'examen
     * (voir {@link Caci#finValidite}). Jamais le certificat medical lui-meme.
     */
    private LocalDate certificatValideJusquAu;

    /** Date de l'examen médical portée sur le CACI. */
    private LocalDate caciDateExamen;

    /** Qualité du médecin signataire du CACI. */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private MedecinCaci caciMedecin;

    /** Cases cochées sur le CACI FFESSM, comme pour un élève : jamais le texte écrit par le médecin. */
    @Convert(converter = ConvertisseurActivitesCaci.class)
    @Column(length = 400)
    private Set<ActiviteCaci> caciActivites = EnumSet.noneOf(ActiviteCaci.class);

    /**
     * Droit à l'image pour le trombinoscope des moniteurs, recueilli par un
     * ADMIN : sans lui, aucune photo n'est acceptée ni renvoyée.
     */
    @Column(nullable = false)
    private boolean autorisationImage;

    @Column(nullable = false)
    private Instant creeLe = Instant.now();

    /** Pas de table _AUD dédiée pour une simple collection de rôles : hors du périmètre audité. */
    @NotAudited
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "utilisateur_role", joinColumns = @JoinColumn(name = "utilisateur_id"))
    @Column(name = "role")
    @Enumerated(EnumType.STRING)
    private Set<RoleNom> roles = EnumSet.noneOf(RoleNom.class);

    public String nomComplet() {
        return prenom + " " + nom;
    }

    public boolean estMoniteur() {
        return roles.contains(RoleNom.MONITEUR) && niveauEncadrement != null;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMotDePasse() {
        return motDePasse;
    }

    public void setMotDePasse(String motDePasse) {
        this.motDePasse = motDePasse;
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

    public boolean isActif() {
        return actif;
    }

    public void setActif(boolean actif) {
        this.actif = actif;
    }

    public NiveauEncadrement getNiveauEncadrement() {
        return niveauEncadrement;
    }

    public void setNiveauEncadrement(NiveauEncadrement niveauEncadrement) {
        this.niveauEncadrement = niveauEncadrement;
    }

    public String getNumeroLicence() {
        return numeroLicence;
    }

    public String getNiveauPlongeur() {
        return niveauPlongeur;
    }

    public void setNiveauPlongeur(String niveauPlongeur) {
        this.niveauPlongeur = niveauPlongeur;
    }

    public void setNumeroLicence(String numeroLicence) {
        this.numeroLicence = numeroLicence;
    }

    public boolean certificatValideAu(LocalDate date) {
        return certificatValideJusquAu != null && !certificatValideJusquAu.isBefore(date);
    }

    public LocalDate getCertificatValideJusquAu() {
        return certificatValideJusquAu;
    }

    public void setCertificatValideJusquAu(LocalDate certificatValideJusquAu) {
        this.certificatValideJusquAu = certificatValideJusquAu;
    }

    public Caci getCaci() {
        return new Caci(caciDateExamen, caciMedecin, caciActivites);
    }

    /** Date de l'examen, médecin et cases, après vérification ; la fin de validité s'en déduit. */
    public void setCaci(Caci caci) {
        caci.verifier();
        this.certificatValideJusquAu = caci.finValidite();
        this.caciDateExamen = caci.dateExamen();
        this.caciMedecin = caci.medecin();
        this.caciActivites = caci.activites() == null || caci.activites().isEmpty()
                ? EnumSet.noneOf(ActiviteCaci.class) : EnumSet.copyOf(caci.activites());
    }

    public boolean isAutorisationImage() {
        return autorisationImage;
    }

    public void setAutorisationImage(boolean autorisationImage) {
        this.autorisationImage = autorisationImage;
    }

    public Instant getCreeLe() {
        return creeLe;
    }

    public void setCreeLe(Instant creeLe) {
        this.creeLe = creeLe;
    }

    public Set<RoleNom> getRoles() {
        return roles;
    }

    public void setRoles(Set<RoleNom> roles) {
        this.roles = roles;
    }
}
