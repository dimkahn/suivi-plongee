package fr.club.plongee.materiel.domaine.port;

import fr.club.plongee.materiel.domaine.InterventionEquipement;

import java.util.Collection;
import java.util.List;

/** Le journal des équipements, en ajout seul : ni modification ni suppression ici. */
public interface Interventions {

    /** Du plus récent au plus ancien. */
    List<InterventionEquipement> parEquipement(Long equipementId);

    List<InterventionEquipement> parEquipements(Collection<Long> ids);

    boolean existsByEquipementId(Long equipementId);

    <S extends InterventionEquipement> S save(S intervention);
}
