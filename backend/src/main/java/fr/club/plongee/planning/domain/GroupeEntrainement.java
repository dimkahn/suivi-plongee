package fr.club.plongee.planning.domain;

import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Groupe d'entraînement d'une saison (Débutants, Perfect N1, Prépa N2...) :
 * ses encadrants attitrés, sa ligne d'eau attitrée et ses élèves, rangés par
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "espace_attitre_id")
    private EspaceBassin espaceAttitre;

    @ManyToMany
    @JoinTable(name = "groupe_entrainement_encadrant",
            joinColumns = @JoinColumn(name = "groupe_id"),
            inverseJoinColumns = @JoinColumn(name = "utilisateur_id"))
    private Set<Utilisateur> encadrants = new LinkedHashSet<>();

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

    public EspaceBassin getEspaceAttitre() {
        return espaceAttitre;
    }

    public void setEspaceAttitre(EspaceBassin espaceAttitre) {
        this.espaceAttitre = espaceAttitre;
    }

    public Set<Utilisateur> getEncadrants() {
        return encadrants;
    }

    public void setEncadrants(Set<Utilisateur> encadrants) {
        this.encadrants = encadrants;
    }

    public Set<Eleve> getEleves() {
        return eleves;
    }

    public void setEleves(Set<Eleve> eleves) {
        this.eleves = eleves;
    }
}
