package fr.club.plongee.planning.domain;

import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Réponse d'un encadrant pour une soirée : présent ou absent. Pas de ligne =
 * pas encore répondu. {@code saisiPar} garde qui a saisi, l'encadrant
 * lui-même ou un admin prévenu par téléphone.
 */
@Entity
public class DisponibiliteEncadrant {

    public enum Reponse { PRESENT, ABSENT }

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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Reponse reponse;

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

    public Reponse getReponse() {
        return reponse;
    }

    public void setReponse(Reponse reponse) {
        this.reponse = reponse;
    }

    public Utilisateur getSaisiPar() {
        return saisiPar;
    }

    public void setSaisiPar(Utilisateur saisiPar) {
        this.saisiPar = saisiPar;
    }
}
