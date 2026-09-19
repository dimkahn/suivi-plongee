package fr.club.plongee.formation.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

/**
 * Un plongeur au sein d'un {@link GroupePlongeurs}. Même logique
 * d'instantané éditable qu'un {@link MembrePalanquee} : {@code eleve}/{@code
 * utilisateur} pré-remplissent nom/prénom/aptitude à la sélection, mais
 * restent facultatifs et le nom/prénom saisis peuvent diverger ensuite (un
 * invité d'un autre club, par exemple). Ni fonction, ni gaz, ni
 * désaturation : ces paramètres varient d'une palanquée à l'autre, pas du
 * groupe dans son ensemble.
 */
@Entity
public class MembreGroupePlongeurs {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_id")
    private GroupePlongeurs groupe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String prenom;

    private String aptitude;
    private String qualificationPreparee;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public GroupePlongeurs getGroupe() {
        return groupe;
    }

    public void setGroupe(GroupePlongeurs groupe) {
        this.groupe = groupe;
    }

    public Eleve getEleve() {
        return eleve;
    }

    public void setEleve(Eleve eleve) {
        this.eleve = eleve;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getPrenom() {
        return prenom;
    }

    public void setPrenom(String prenom) {
        this.prenom = prenom;
    }

    public String getAptitude() {
        return aptitude;
    }

    public void setAptitude(String aptitude) {
        this.aptitude = aptitude;
    }

    public String getQualificationPreparee() {
        return qualificationPreparee;
    }

    public void setQualificationPreparee(String qualificationPreparee) {
        this.qualificationPreparee = qualificationPreparee;
    }
}
