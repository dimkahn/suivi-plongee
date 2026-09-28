package fr.club.plongee.materiel.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Ce qui s'inscrit au journal d'un équipement : le contenu de la fiche de
 * gestion d'un EPI d'occasion (Code du sport, annexe III-27) et, pour les
 * blocs, le suivi en service des équipements sous pression.
 */
public enum TypeIntervention {
    INSPECTION_VISUELLE("Inspection visuelle (TIV)", EnumSet.of(TypeEquipement.BLOC)),
    REQUALIFICATION("Requalification (épreuve hydraulique)", EnumSet.of(TypeEquipement.BLOC)),
    REVISION("Révision", EnumSet.allOf(TypeEquipement.class)),
    REPARATION("Réparation", EnumSet.allOf(TypeEquipement.class)),
    REMPLACEMENT_PIECE("Remplacement d'une pièce", EnumSet.allOf(TypeEquipement.class)),
    CONTROLE("Contrôle", EnumSet.allOf(TypeEquipement.class)),
    DESINFECTION("Désinfection", EnumSet.allOf(TypeEquipement.class)),
    INCIDENT("Incident", EnumSet.allOf(TypeEquipement.class));

    private final String libelle;
    private final Set<TypeEquipement> types;

    TypeIntervention(String libelle, Set<TypeEquipement> types) {
        this.libelle = libelle;
        this.types = types;
    }

    public String libelle() {
        return libelle;
    }

    public boolean concerne(TypeEquipement type) {
        return types.contains(type);
    }
}
