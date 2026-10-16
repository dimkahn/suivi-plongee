package fr.club.plongee.materiel.adaptateur.sortie.persistance;

import fr.club.plongee.materiel.domaine.PhotoPret;
import fr.club.plongee.materiel.domaine.PhotoPretResume;
import fr.club.plongee.materiel.domaine.port.PhotosPret;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

interface PhotosPretJpa extends JpaRepository<PhotoPret, Long>, PhotosPret {

    @Override
    @Query("""
           select new fr.club.plongee.materiel.domaine.PhotoPretResume(
                    p.id, p.pret.id, p.moment, e.id, e.reference, p.legende, p.priseLe, u.prenom, u.nom)
             from PhotoPret p
             left join p.equipement e
             left join p.prisePar u
            where p.pret.id = :pretId
            order by p.priseLe, p.id
           """)
    List<PhotoPretResume> resumes(@Param("pretId") Long pretId);

    @Override
    @Query("""
           select p.pret.id, p.moment, count(p) from PhotoPret p
            where p.pret.id in :pretIds
            group by p.pret.id, p.moment
           """)
    List<Object[]> compter(@Param("pretIds") Collection<Long> pretIds);

    @Override
    long countByPretIdAndMoment(Long pretId, PhotoPret.Moment moment);
}
