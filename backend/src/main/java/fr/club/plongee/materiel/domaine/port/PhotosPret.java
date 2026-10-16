package fr.club.plongee.materiel.domaine.port;

import fr.club.plongee.materiel.domaine.PhotoPret;
import fr.club.plongee.materiel.domaine.PhotoPretResume;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Les photos avant/après des prêts. */
public interface PhotosPret {

    /** Sans leur contenu, dans l'ordre de prise. */
    List<PhotoPretResume> resumes(Long pretId);

    /** Lignes [id du prêt, moment, nombre]. */
    List<Object[]> compter(Collection<Long> pretIds);

    long countByPretIdAndMoment(Long pretId, PhotoPret.Moment moment);

    Optional<PhotoPret> findById(Long id);

    <S extends PhotoPret> S save(S photo);

    void delete(PhotoPret photo);
}
