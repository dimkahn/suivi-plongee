package fr.club.plongee.planning.domain;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Écart d'un groupe à sa ligne attitrée pour une soirée : autre espace
 * (ligne ou fosse, éventuellement limitée en profondeur), activité (baptêmes)
 * ou absence. Sans ligne ici, le groupe est à sa ligne attitrée.
 */
@Entity
public class AffectationGroupe {

    public enum Type { ESPACE, ACTIVITE, ABSENT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_id")
    private GroupeEntrainement groupe;

    @Column(nullable = false)
    private LocalDate dateSoiree;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "espace_id")
    private EspaceBassin espace;

    /** Fosse limitée (F6 = 6 m) ; null = profondeur de l'espace. */
    private Integer profondeurLimitee;

    @Column(length = 80)
    private String activite;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public GroupeEntrainement getGroupe() {
        return groupe;
    }

    public void setGroupe(GroupeEntrainement groupe) {
        this.groupe = groupe;
    }

    public LocalDate getDateSoiree() {
        return dateSoiree;
    }

    public void setDateSoiree(LocalDate dateSoiree) {
        this.dateSoiree = dateSoiree;
    }

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public EspaceBassin getEspace() {
        return espace;
    }

    public void setEspace(EspaceBassin espace) {
        this.espace = espace;
    }

    public Integer getProfondeurLimitee() {
        return profondeurLimitee;
    }

    public void setProfondeurLimitee(Integer profondeurLimitee) {
        this.profondeurLimitee = profondeurLimitee;
    }

    public String getActivite() {
        return activite;
    }

    public void setActivite(String activite) {
        this.activite = activite;
    }
}
