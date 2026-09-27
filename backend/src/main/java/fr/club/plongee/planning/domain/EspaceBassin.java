package fr.club.plongee.planning.domain;

import jakarta.persistence.*;

/**
 * Un endroit du bassin où placer un groupe un soir d'entraînement : une
 * ligne d'eau de la piscine ou la fosse. Capacité et profondeur sont
 * indicatives (avertissements du planning), null si sans objet.
 */
@Entity
public class EspaceBassin {

    public enum Type { LIGNE, FOSSE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @Column(nullable = false)
    private int ordre;

    private Integer profondeurMax;

    /** Plongeurs admis en même temps, encadrants compris. */
    private Integer capacite;

    @Column(nullable = false)
    private boolean actif = true;

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

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public int getOrdre() {
        return ordre;
    }

    public void setOrdre(int ordre) {
        this.ordre = ordre;
    }

    public Integer getProfondeurMax() {
        return profondeurMax;
    }

    public void setProfondeurMax(Integer profondeurMax) {
        this.profondeurMax = profondeurMax;
    }

    public Integer getCapacite() {
        return capacite;
    }

    public void setCapacite(Integer capacite) {
        this.capacite = capacite;
    }

    public boolean isActif() {
        return actif;
    }

    public void setActif(boolean actif) {
        this.actif = actif;
    }
}
