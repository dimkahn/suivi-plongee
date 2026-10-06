package fr.club.plongee.formation.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Cases cochées du CACI rangées dans une seule colonne (« APNEE,LOISIR ») :
 * une colonne simple que Envers historise comme les autres champs de l'élève,
 * sans table d'association à auditer. Une valeur inconnue (case retirée
 * depuis) est ignorée à la lecture.
 */
@Converter
public class ConvertisseurActivitesCaci implements AttributeConverter<Set<ActiviteCaci>, String> {

    @Override
    public String convertToDatabaseColumn(Set<ActiviteCaci> activites) {
        if (activites == null || activites.isEmpty()) return null;
        return EnumSet.copyOf(activites).stream().map(Enum::name).collect(Collectors.joining(","));
    }

    @Override
    public Set<ActiviteCaci> convertToEntityAttribute(String colonne) {
        EnumSet<ActiviteCaci> activites = EnumSet.noneOf(ActiviteCaci.class);
        if (colonne == null || colonne.isBlank()) return activites;
        Arrays.stream(colonne.split(",")).map(String::trim).forEach(code -> {
            try {
                activites.add(ActiviteCaci.valueOf(code));
            } catch (IllegalArgumentException inconnue) {
                // case retirée de la liste : on l'oublie
            }
        });
        return activites;
    }
}
