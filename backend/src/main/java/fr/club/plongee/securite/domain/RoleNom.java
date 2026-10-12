package fr.club.plongee.securite.domain;

/**
 * DIRECTEUR_TECHNIQUE : gère le matériel du club et les prêts
 * ({@code fr.club.plongee.materiel}). Se cumule avec MONITEUR, comme ADMIN.
 * TIV : technicien en inspection visuelle ; remplit les fiches d'inspection
 * des blocs et consulte le matériel, sans gérer l'inventaire ni les prêts.
 * Se cumule avec MONITEUR lui aussi.
 * FICHE_SECURITE : un moniteur qui n'est pas E3 ni E4 peut quand même
 * établir et modifier les fiches de sécurité (choix du club, 2026 ; sans
 * ce droit, c'est réservé aux E3, E4 et administrateurs). Cumulé avec
 * MONITEUR ; ne fait pas de lui un directeur de plongée possible.
 * SECURITE_SURFACE : compte qui n'est pas moniteur du club (sécurité
 * surface d'une sortie) ; ne fait que compléter les fiches de sécurité au
 * retour de plongée. Jamais cumulé avec MONITEUR.
 */
public enum RoleNom { ADMIN, MONITEUR, ELEVE, DIRECTEUR_TECHNIQUE, TIV, FICHE_SECURITE, SECURITE_SURFACE }
