package fr.club.plongee.securite;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

@Entity
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

    private String numeroLicence;

    @Column(nullable = false)
    private Instant creeLe = Instant.now();

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

    public void setNumeroLicence(String numeroLicence) {
        this.numeroLicence = numeroLicence;
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
