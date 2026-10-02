package fr.club.plongee.planning.domain;

import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Groupe d'entraînement d'une saison (Débutants, Perfect N1, Prépa N2...) :
 * ses encadrants attitrés (dont ses référents), ses lignes d'eau attitrées et ses élèves, rangés par
 * l'admin. Sans rapport avec {@code GroupePlongeurs}, qui compose les
 * palanquées d'un séjour. Un élève est dans au plus un groupe par saison
 * (règle tenue par {@code GroupeEntrainementService}).
 */
@Entity
public class GroupeEntrainement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    @Column(nullable = false, length = 80)
    private String nom;

    @Column(nullable = false)
    private int ordre;

    /** N1/N2/N3 : sert à suggérer ce groupe aux élèves qui préparent ce niveau ; null sinon. */
    @Column(length = 2)
    private String niveauPrepare;

    /**
     * Lignes d'eau (ou fosse) attitrées : un groupe nombreux peut en occuper
     * plusieurs. L'ancienne colonne {@code espace_attitre_id} reste en base,
     * inutilisée (voir V37).
     */
    @ManyToMany
    @JoinTable(name = "groupe_entrainement_espace",
            joinColumns = @JoinColumn(name = "groupe_id"),
            inverseJoinColumns = @JoinColumn(name = "espace_id"))
    @OrderBy("ordre ASC, id ASC")
    private Set<EspaceBassin> espacesAttitres = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(name = "groupe_entrainement_encadrant",
            joinColumns = @JoinColumn(name = "groupe_id"),
            inverseJoinColumns = @JoinColumn(name = "utilisateur_id"))
    private Set<Utilisateur> encadrants = new LinkedHashSet<>();

    /** Référents du groupe : toujours aussi dans {@link #encadrants} (règle du service). */
    @ManyToMany
    @JoinTable(name = "groupe_entrainement_referent",
            joinColumns = @JoinColumn(name = "groupe_id"),
            inverseJoinColumns = @JoinColumn(name = "utilisateur_id"))
    private Set<Utilisateur> referents = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(name = "groupe_entrainement_eleve",
            joinColumns = @JoinColumn(name = "groupe_id"),
            inverseJoinColumns = @JoinColumn(name = "eleve_id"))
    private Set<Eleve> eleves = new LinkedHashSet<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Saison getSaison() {
        return saison;
    }

    public void setSaison(Saison saison) {
        this.saison = saison;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public int getOrdre() {
        return ordre;
    }

    public void setOrdre(int ordre) {
        this.ordre = ordre;
    }

    public String getNiveauPrepare() {
        return niveauPrepare;
    }

    public void setNiveauPrepare(String niveauPrepare) {
        this.niveauPrepare = niveauPrepare;
    }

    public Set<EspaceBassin> getEspacesAttitres() {
        return espacesAttitres;
    }

    public void setEspacesAttitres(Set<EspaceBassin> espacesAttitres) {
        this.espacesAttitres = espacesAttitres;
    }

    /** Lignes attitrées dans l'ordre du bassin (ligne 1, ligne 2... puis la fosse). */
    public List<EspaceBassin> espacesAttitresOrdonnes() {
        return espacesAttitres.stream()
                .sorted(java.util.Comparator.comparingInt(EspaceBassin::getOrdre).thenComparing(EspaceBassin::getId))
                .toList();
    }

    /** « Ligne 5 + Ligne 6 » ; null sans ligne attitrée. */
    public String libelleEspacesAttitres() {
        List<EspaceBassin> liste = espacesAttitresOrdonnes();
        return liste.isEmpty() ? null
                : liste.stream().map(EspaceBassin::getNom).collect(java.util.stream.Collectors.joining(" + "));
    }

    public Set<Utilisateur> getEncadrants() {
        return encadrants;
    }

    public void setEncadrants(Set<Utilisateur> encadrants) {
        this.encadrants = encadrants;
    }

    public Set<Utilisateur> getReferents() {
        return referents;
    }

    public void setReferents(Set<Utilisateur> referents) {
        this.referents = referents;
    }

    public boolean estReferent(Utilisateur u) {
        return referents.stream().anyMatch(r -> r.getId().equals(u.getId()));
    }

    public Set<Eleve> getEleves() {
        return eleves;
    }

    public void setEleves(Set<Eleve> eleves) {
        this.eleves = eleves;
    }
}
