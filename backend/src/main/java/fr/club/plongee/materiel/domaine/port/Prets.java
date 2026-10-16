package fr.club.plongee.materiel.domaine.port;

import fr.club.plongee.materiel.domaine.Pret;

import java.util.List;
import java.util.Optional;

/** Les prêts de matériel, avec leurs équipements et leur sortie. */
public interface Prets {

    /** Les plus récents d'abord. */
    List<Pret> enCours();

    /** Les derniers rendus d'abord. */
    List<Pret> rendus();

    List<Pret> parEquipement(Long equipementId);

    /** Les plus récents d'abord. */
    List<Pret> parSortie(Long sortieId);

    boolean existsBySortieId(Long sortieId);

    boolean existsParEquipement(Long equipementId);

    Optional<Pret> findById(Long id);

    <S extends Pret> S save(S pret);

    void delete(Pret pret);
}
