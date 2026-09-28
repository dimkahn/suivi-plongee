package fr.club.plongee.securite.domain;

/**
 * DIRECTEUR_TECHNIQUE : gère le matériel du club et les prêts
 * ({@code fr.club.plongee.materiel}). Se cumule avec MONITEUR, comme ADMIN.
 *
 * <p>IA : pilote l'assistant de développement ({@code fr.club.plongee.ia}).
 * Réservé à un ADMIN : il ne se donne pas sans ce rôle et disparaît avec lui.
 */
public enum RoleNom { ADMIN, MONITEUR, ELEVE, DIRECTEUR_TECHNIQUE, IA }
