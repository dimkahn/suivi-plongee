package fr.club.plongee.planning.domain;

import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Un soir donné, un encadrant encadre un autre groupe que ses groupes
 * attitrés (remplacer un collègue absent, renforcer un groupe). Pas de ligne
 * = il est avec ses groupes attitrés. {@code saisiPar} garde qui a fait le
 * changement.
 */
@Entity
public class AffectationEncadrant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "saison_id")
    private Saison saison;

    @Column(nullable = false)
    private LocalDate dateSoiree;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_id")
    private GroupeEntrainement groupe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisi_par_id")
    private Utilisateur saisiPar;

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

    public LocalDate getDateSoiree() {
        return dateSoiree;
    }

    public void setDateSoiree(LocalDate dateSoiree) {
        this.dateSoiree = dateSoiree;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public GroupeEntrainement getGroupe() {
        return groupe;
    }

    public void setGroupe(GroupeEntrainement groupe) {
        this.groupe = groupe;
    }

    public Utilisateur getSaisiPar() {
        return saisiPar;
    }

    public void setSaisiPar(Utilisateur saisiPar) {
        this.saisiPar = saisiPar;
    }
}
