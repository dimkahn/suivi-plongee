package fr.club.plongee.materiel.adaptateur.sortie.persistance;

import fr.club.plongee.materiel.domaine.Pret;
import fr.club.plongee.materiel.domaine.port.Prets;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

interface PretsJpa extends JpaRepository<Pret, Long>, Prets {

    @Override
    @Query("""
           select distinct p from Pret p
             left join fetch p.equipements
             left join fetch p.sortie
            where p.dateRetour is null
            order by p.datePret desc, p.id desc
           """)
    List<Pret> enCours();

    @Override
    @Query("""
           select distinct p from Pret p
             left join fetch p.equipements
             left join fetch p.sortie
            where p.dateRetour is not null
            order by p.dateRetour desc, p.id desc
           """)
    List<Pret> rendus();

    @Override
    @Query("""
           select distinct p from Pret p
             left join fetch p.equipements
             left join fetch p.sortie
            where exists (select 1 from Pret q join q.equipements e where q = p and e.id = :equipementId)
            order by p.datePret desc, p.id desc
           """)
    List<Pret> parEquipement(@Param("equipementId") Long equipementId);

    @Override
    boolean existsBySortieId(Long sortieId);

    @Override
    @Query("select count(p) > 0 from Pret p join p.equipements e where e.id = :equipementId")
    boolean existsParEquipement(@Param("equipementId") Long equipementId);
}
