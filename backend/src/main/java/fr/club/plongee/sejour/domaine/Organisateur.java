package fr.club.plongee.sejour.domaine;

/** Un compte qui modifie le séjour : son créateur ou un organisateur qu'il a désigné. */
public record Organisateur(Long id, String nomComplet, boolean createur) {}
