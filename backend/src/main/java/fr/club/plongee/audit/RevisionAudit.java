package fr.club.plongee.audit;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.envers.RevisionEntity;
import org.hibernate.envers.RevisionNumber;
import org.hibernate.envers.RevisionTimestamp;

/**
 * Une ligne par transaction ayant modifié une entité {@code @Audited}.
 * L'auteur vient toujours du SecurityContext (voir {@link EcouteurRevisionAudit}),
 * jamais du corps de la requête, comme pour {@code Evaluation.moniteur}.
 */
@Entity
@Table(name = "revision_audit")
@RevisionEntity(EcouteurRevisionAudit.class)
public class RevisionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @RevisionNumber
    private int id;

    @RevisionTimestamp
    private long horodatage;

    private String acteur;

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public long getHorodatage() {
        return horodatage;
    }

    public void setHorodatage(long horodatage) {
        this.horodatage = horodatage;
    }

    public String getActeur() {
        return acteur;
    }

    public void setActeur(String acteur) {
        this.acteur = acteur;
    }
}
