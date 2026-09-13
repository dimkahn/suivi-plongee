package fr.club.plongee.formation;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Table séparée de {@link Eleve} : la photo (potentiellement volumineuse) ne
 * doit jamais alourdir les lectures courantes d'un élève (jointures cursus,
 * roster...). N'existe que si une photo a été déposée ; le consentement
 * ({@code Eleve.autorisationImage}) est vérifié séparément avant tout envoi.
 */
@Entity
@Table(name = "photo_eleve")
public class PhotoEleve {

    @Id
    @Column(name = "eleve_id")
    private Long eleveId;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] contenu;

    @Column(name = "type_contenu", nullable = false)
    private String typeContenu;

    @Column(name = "mise_a_jour_le", nullable = false)
    private Instant miseAJourLe = Instant.now();

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
