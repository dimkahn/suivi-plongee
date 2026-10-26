package fr.club.plongee.notification.push;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * La paire de clés VAPID du serveur, tirée au premier besoin et gardée en
 * base (table {@code cle_vapid}, une ligne) : aucune variable à régler au
 * déploiement. La changer désabonnerait tous les téléphones : elle ne
 * change jamais.
 */
@Service
public class ServiceClesVapid {

    private final JdbcTemplate jdbc;
    private volatile ClesVapid cles;

    public ServiceClesVapid(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public synchronized ClesVapid cles() {
        if (cles != null) return cles;
        List<ClesVapid> lues = jdbc.query("SELECT cle_publique, cle_privee FROM cle_vapid WHERE id = 1",
                (rs, i) -> new ClesVapid(rs.getString(1), rs.getString(2)));
        if (lues.isEmpty()) {
            ClesVapid neuves = ClesVapid.generer();
            jdbc.update("INSERT INTO cle_vapid (id, cle_publique, cle_privee) VALUES (1, ?, ?)",
                    neuves.publique(), neuves.privee());
            cles = neuves;
        } else {
            cles = lues.getFirst();
        }
        return cles;
    }
}
