package fr.club.plongee.securite.domain;

/**
 * DIRECTEUR_TECHNIQUE : gère le matériel du club et les prêts
 * ({@code fr.club.plongee.materiel}). Se cumule avec MONITEUR, comme ADMIN.
 * TIV : technicien en inspection visuelle ; remplit les fiches d'inspection
 * des blocs et consulte le matériel, sans gérer l'inventaire ni les prêts.
 * Se cumule avec MONITEUR lui aussi.
 */
public enum RoleNom { ADMIN, MONITEUR, ELEVE, DIRECTEUR_TECHNIQUE, TIV }
