package fr.club.plongee.planning.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Écart d'un groupe à sa ligne attitrée pour une soirée : autre espace
 * (une ou plusieurs lignes, ou la fosse, éventuellement limitée en
 * profondeur), activité (baptêmes)
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

    /** Lignes d'eau occupées en plus de {@link #espace} (un groupe sur les lignes 5 et 6). */
    @ManyToMany
    @JoinTable(name = "affectation_groupe_ligne",
            joinColumns = @JoinColumn(name = "affectation_id"),
            inverseJoinColumns = @JoinColumn(name = "espace_id"))
    private Set<EspaceBassin> lignesSupplementaires = new LinkedHashSet<>();

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

    public Set<EspaceBassin> getLignesSupplementaires() {
        return lignesSupplementaires;
    }

    public void setLignesSupplementaires(Set<EspaceBassin> lignesSupplementaires) {
        this.lignesSupplementaires = lignesSupplementaires;
    }

    /** Tous les espaces de la consigne, dans l'ordre du bassin ; vide hors consigne « espace ». */
    public List<EspaceBassin> espacesOrdonnes() {
        List<EspaceBassin> liste = new ArrayList<>();
        if (espace != null) liste.add(espace);
        lignesSupplementaires.stream().filter(e -> !e.equals(espace)).forEach(liste::add);
        liste.sort(Comparator.comparingInt(EspaceBassin::getOrdre).thenComparing(EspaceBassin::getId));
        return liste;
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
