package fr.club.plongee.referentiel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CritereRepository extends JpaRepository<Critere, Long> {

    @Query("""
           select c from Critere c
             join fetch c.bloc b
            where b.referentiel.id = :referentielId
            order by b.ordre, c.ordre
           """)
    List<Critere> parReferentiel(Long referentielId);

    @Query("select count(c) from Critere c where c.bloc.id = :blocId")
    long compterParBloc(Long blocId);
}
