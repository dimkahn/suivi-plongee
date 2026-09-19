package fr.club.plongee.formation.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Groupe nommé et réutilisable de plongeurs, typiquement constitué une fois
 * pour un séjour puis glissé-déposé dans les palanquées de plusieurs fiches
 * de sécurité successives, sans ressaisir le roster à chaque plongée. Ne
 * porte aucun lien vers {@link Seance} ou {@link FicheSecurite} : composer
 * une palanquée à partir d'un groupe recopie ses membres dans la fiche (voir
 * {@code GroupePlongeursService}), le groupe reste indépendant ensuite.
 * Rattaché à une {@link Saison} pour ne pas s'accumuler indéfiniment dans les
 * écrans d'administration.
 */
@Entity
public class GroupePlongeurs {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    @Column(nullable = false)
    private LocalDate dateCreation = LocalDate.now();

    @OneToMany(mappedBy = "groupe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MembreGroupePlongeurs> membres = new ArrayList<>();

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

    public Saison getSaison() {
        return saison;
    }

    public void setSaison(Saison saison) {
        this.saison = saison;
    }

    public LocalDate getDateCreation() {
        return dateCreation;
    }

    public void setDateCreation(LocalDate dateCreation) {
        this.dateCreation = dateCreation;
    }

    public List<MembreGroupePlongeurs> getMembres() {
        return membres;
    }
}
