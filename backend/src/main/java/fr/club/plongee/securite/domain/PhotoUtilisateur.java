package fr.club.plongee.securite.domain;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;

/**
 * Photo d'un moniteur pour le trombinoscope. Table séparée de
 * {@link Utilisateur}, chargé à chaque requête authentifiée : la photo ne
 * doit jamais alourdir cette lecture. Le consentement
 * ({@code Utilisateur.autorisationImage}) est vérifié séparément avant tout
 * envoi. Même montage {@code @MapsId} + {@link Persistable} que
 * {@code PhotoEleve}, pour la même raison (voir sa documentation).
 */
@Entity
@Table(name = "photo_utilisateur")
public class PhotoUtilisateur implements Persistable<Long> {

    @Id
    @Column(name = "utilisateur_id")
    private Long utilisateurId;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Transient
    private boolean nouvelle = true;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] contenu;

    @Column(name = "type_contenu", nullable = false)
    private String typeContenu;

    @Column(name = "mise_a_jour_le", nullable = false)
    private Instant miseAJourLe = Instant.now();

    @Override
    public Long getId() {
        return utilisateurId;
    }

    @Override
    public boolean isNew() {
        return nouvelle;
    }

    @PostLoad
    @PostPersist
    void marquerExistante() {
        nouvelle = false;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
        this.utilisateurId = utilisateur == null ? null : utilisateur.getId();
    }

    public byte[] getContenu() {
        return contenu;
    }

    public void setContenu(byte[] contenu) {
        this.contenu = contenu;
    }

    public String getTypeContenu() {
        return typeContenu;
    }

    public void setTypeContenu(String typeContenu) {
        this.typeContenu = typeContenu;
    }

    public Instant getMiseAJourLe() {
        return miseAJourLe;
    }

    public void setMiseAJourLe(Instant miseAJourLe) {
        this.miseAJourLe = miseAJourLe;
    }
}
