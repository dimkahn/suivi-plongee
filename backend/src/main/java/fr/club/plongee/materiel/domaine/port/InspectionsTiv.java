package fr.club.plongee.materiel.domaine.port;

import fr.club.plongee.materiel.domaine.InspectionTiv;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Les fiches d'inspection TIV, en ajout seul comme le journal. */
public interface InspectionsTiv {

    /** Avec son intervention, son bloc et son auteur. */
    Optional<InspectionTiv> detail(Long id);

    List<InspectionTiv> parInterventions(Collection<Long> interventionIds);

    /** La plus récente de ce bloc : on en reprend les filetages, qui ne changent pas d'une année à l'autre. */
    Optional<InspectionTiv> findFirstByInterventionEquipementIdOrderByIdDesc(Long equipementId);

    /** La plus récente saisie par ce compte : on en reprend le nom et le n° de TIV. */
    Optional<InspectionTiv> findFirstByInterventionSaisiParIdOrderByIdDesc(Long utilisateurId);

    <S extends InspectionTiv> S save(S inspection);
}
