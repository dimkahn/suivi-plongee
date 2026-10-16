package fr.club.plongee.materiel.repository;

import fr.club.plongee.materiel.domain.Pret;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PretRepository extends JpaRepository<Pret, Long> {

    @Query("""
           select distinct p from Pret p
             left join fetch p.equipements
             left join fetch p.sortie
            where p.dateRetour is null
            order by p.datePret desc, p.id desc
           """)
    List<Pret> enCours();

    @Query("""
           select distinct p from Pret p
             left join fetch p.equipements
             left join fetch p.sortie
            where p.dateRetour is not null
            order by p.dateRetour desc, p.id desc
           """)
    List<Pret> rendus();

    @Query("""
           select distinct p from Pret p
             left join fetch p.equipements
             left join fetch p.sortie
            where exists (select 1 from Pret q join q.equipements e where q = p and e.id = :equipementId)
            order by p.datePret desc, p.id desc
           """)
    List<Pret> parEquipement(@Param("equipementId") Long equipementId);

    boolean existsBySortieId(Long sortieId);

    @Query("select count(p) > 0 from Pret p join p.equipements e where e.id = :equipementId")
    boolean existsParEquipement(@Param("equipementId") Long equipementId);
}
