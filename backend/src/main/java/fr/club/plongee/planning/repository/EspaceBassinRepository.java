package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.EspaceBassin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EspaceBassinRepository extends JpaRepository<EspaceBassin, Long> {

    List<EspaceBassin> findAllByOrderByOrdreAscIdAsc();
}
