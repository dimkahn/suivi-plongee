package fr.club.plongee.materiel.domain;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Une ligne de la fiche d'inspection : le constat (oui/non), la décision
 * prise et sa réalisation, comme les trois colonnes de la fiche papier.
 */
@Embeddable
public class ConstatTiv {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PointInspectionTiv point;

    @Column(nullable = false)
    private boolean reponse;

    /** La décision quand la réponse révèle un défaut (« À nettoyer », « Rejet »...). */
    @Column(length = 255)
    private String decision;

    /** Localisation, mesures, nature des résidus, entreprise ou produits utilisés. */
    @Column(length = 255)
    private String precisions;

    /** Date à laquelle la décision a été réalisée, si elle l'est déjà. */
    private LocalDate realiseLe;

    protected ConstatTiv() {}

    public ConstatTiv(PointInspectionTiv point, boolean reponse, String decision, String precisions,
                      LocalDate realiseLe) {
        this.point = point;
        this.reponse = reponse;
        this.decision = decision;
        this.precisions = precisions;
        this.realiseLe = realiseLe;
    }

    public PointInspectionTiv getPoint() {
        return point;
    }

    public boolean isReponse() {
        return reponse;
    }

    public boolean estUnDefaut() {
        return reponse != point.reponseNormale();
    }

    public String getDecision() {
        return decision;
    }

    public String getPrecisions() {
        return precisions;
    }

    public LocalDate getRealiseLe() {
        return realiseLe;
    }
}
