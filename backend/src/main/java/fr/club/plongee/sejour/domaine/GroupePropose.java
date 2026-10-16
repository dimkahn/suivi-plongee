package fr.club.plongee.sejour.domaine;

import java.util.List;

/**
 * Un groupe de plongeurs de la saison de la sortie, pour en inscrire tous
 * les membres d'un coup, ou lier un participant à l'un d'eux.
 */
public record GroupePropose(Long id, String nom, int membres, List<PlongeurGroupe> plongeurs) {}
