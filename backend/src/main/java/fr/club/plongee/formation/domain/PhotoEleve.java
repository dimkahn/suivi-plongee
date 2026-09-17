package fr.club.plongee.formation.domain;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;

/**
 * Table séparée de {@link Eleve} : la photo (potentiellement volumineuse) ne
 * doit jamais alourdir les lectures courantes d'un élève (jointures cursus,
 * roster...). N'existe que si une photo a été déposée ; le consentement
 * ({@code Eleve.autorisationImage}) est vérifié séparément avant tout envoi.
 *
 * <p>L'identifiant est repris de l'élève ({@code @MapsId}), jamais généré :
 * sans {@link Persistable}, Spring Data voit un id déjà renseigné dès
 * {@link #setEleve} et en déduit à tort que la ligne existe déjà, appelant
 * {@code merge()} au lieu de {@code persist()} pour une photo neuve — ce qui
 * fait échouer Hibernate sur l'association {@code @MapsId} (identifiant nul
 * inattendu lors de la résolution de l'association).
 */
@Entity
@Table(name = "photo_eleve")
public class PhotoEleve implements Persistable<Long> {

    @Id
    @Column(name = "eleve_id")
    private Long eleveId;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

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
        return eleveId;
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

    public Long getEleveId() {
        return eleveId;
    }

    public Eleve getEleve() {
        return eleve;
    }

    public void setEleve(Eleve eleve) {
        this.eleve = eleve;
        this.eleveId = eleve == null ? null : eleve.getId();
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
