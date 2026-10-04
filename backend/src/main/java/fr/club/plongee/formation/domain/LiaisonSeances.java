package fr.club.plongee.formation.domain;

import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Séances d'un même jour (deux bateaux, deux sites à la même heure...) qui
 * se partagent les plongeurs d'un groupe : sur la fiche de sécurité de l'une,
 * le groupe ne propose plus les plongeurs déjà placés dans une palanquée des
 * autres. Une séance appartient au plus à une liaison (contrainte en base).
 * Pas d'historique Envers : un simple rangement, comme les séances d'une
 * {@link Sortie}.
 */
@Entity
public class LiaisonSeances {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToMany
    @JoinTable(name = "liaison_seances_seance",
            joinColumns = @JoinColumn(name = "liaison_id"),
            inverseJoinColumns = @JoinColumn(name = "seance_id"))
    private Set<Seance> seances = new LinkedHashSet<>();

    public Long getId() {
        return id;
    }

    public Set<Seance> getSeances() {
        return seances;
    }
}
