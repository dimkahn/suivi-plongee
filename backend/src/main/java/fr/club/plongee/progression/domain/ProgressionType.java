package fr.club.plongee.progression.domain;

import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.referentiel.domain.Referentiel;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * L'annee de formation type d'un niveau, decoupee en periodes (plages de
 * mois) avec les blocs travailles dans chacune. Rattachee a une version du
 * referentiel et non au niveau : les blocs changent d'une revision du MFT a
 * l'autre. Exprimee en mois plutot qu'en dates pour resservir d'une saison a
 * l'autre.
 */
@Entity
public class ProgressionType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "referentiel_id")
    private Referentiel referentiel;

    @Column(nullable = false, length = 120)
    private String nom;

    @Column(columnDefinition = "text")
    private String description;

    @OneToMany(mappedBy = "progression", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("rang")
    private List<PeriodeProgression> periodes = new ArrayList<>();

    /** Saisons qui suivent cette progression (au plus une progression par referentiel et par saison). */
    @ManyToMany
    @JoinTable(name = "progression_saison",
            joinColumns = @JoinColumn(name = "progression_id"),
            inverseJoinColumns = @JoinColumn(name = "saison_id"))
    private Set<Saison> saisons = new HashSet<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Referentiel getReferentiel() {
        return referentiel;
    }

    public void setReferentiel(Referentiel referentiel) {
        this.referentiel = referentiel;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<PeriodeProgression> getPeriodes() {
        return periodes;
    }

    public void setPeriodes(List<PeriodeProgression> periodes) {
        this.periodes = periodes;
    }

    public Set<Saison> getSaisons() {
        return saisons;
    }

    public void setSaisons(Set<Saison> saisons) {
        this.saisons = saisons;
    }
}
