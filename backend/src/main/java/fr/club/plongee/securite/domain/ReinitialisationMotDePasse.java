package fr.club.plongee.securite.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Demande de reinitialisation de mot de passe : mot de passe oublie par un
 * utilisateur, ou invitation d'un moniteur cree par un ADMIN. On ne stocke
 * jamais le jeton en clair, seulement son empreinte SHA-256, comme pour
 * {@link RefreshToken}.
 */
@Entity
public class ReinitialisationMotDePasse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Column(nullable = false, unique = true)
    private String jetonHash;

    @Column(nullable = false)
    private Instant demandeeLe = Instant.now();

    @Column(nullable = false)
    private Instant expireLe;

    private Instant utiliseeLe;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public String getJetonHash() {
        return jetonHash;
    }

    public void setJetonHash(String jetonHash) {
        this.jetonHash = jetonHash;
    }

    public Instant getDemandeeLe() {
        return demandeeLe;
    }

    public void setDemandeeLe(Instant demandeeLe) {
        this.demandeeLe = demandeeLe;
    }

    public Instant getExpireLe() {
        return expireLe;
    }

    public void setExpireLe(Instant expireLe) {
        this.expireLe = expireLe;
    }

    public Instant getUtiliseeLe() {
        return utiliseeLe;
    }

    public void setUtiliseeLe(Instant utiliseeLe) {
        this.utiliseeLe = utiliseeLe;
    }
}
