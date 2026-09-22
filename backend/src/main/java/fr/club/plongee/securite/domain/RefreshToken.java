package fr.club.plongee.securite.domain;

import jakarta.persistence.*;

import java.time.Instant;

/** On ne stocke jamais le jeton en clair, seulement son empreinte SHA-256. */
@Entity
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Column(nullable = false, unique = true)
    private String empreinte;

    @Column(nullable = false)
    private Instant expireLe;

    @Column(nullable = false)
    private boolean revoque = false;

    /** « Se souvenir de moi » : conservé à la rotation du jeton. */
    @Column(nullable = false)
    private boolean persistant = true;

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

    public String getEmpreinte() {
        return empreinte;
    }

    public void setEmpreinte(String empreinte) {
        this.empreinte = empreinte;
    }

    public Instant getExpireLe() {
        return expireLe;
    }

    public void setExpireLe(Instant expireLe) {
        this.expireLe = expireLe;
    }

    public boolean isRevoque() {
        return revoque;
    }

    public void setRevoque(boolean revoque) {
        this.revoque = revoque;
    }

    public boolean isPersistant() {
        return persistant;
    }

    public void setPersistant(boolean persistant) {
        this.persistant = persistant;
    }
}
