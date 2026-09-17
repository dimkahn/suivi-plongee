package fr.club.plongee.formation.domain;

import jakarta.persistence.*;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Un groupe de plongeurs au sein d'une {@link FicheSecurite}, numéroté sur la
 * fiche. Les paramètres de plongée (profondeur, durée, paliers, heures) sont
 * portés ici : c'est la palanquée qui plonge ensemble sur un même profil, pas
 * chaque plongeur individuellement. Seuls le gaz et le moyen de désaturation
 * varient d'un plongeur à l'autre, voir {@link MembrePalanquee}.
 *
 * <p>Prévu et réalisé sont saisis à deux moments distincts : prévu à
 * l'établissement de la fiche avant la mise à l'eau, réalisé au retour de
 * plongée (voir {@code FicheSecuriteController#enregistrerRealise}).
 */
@Entity
public class Palanquee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "fiche_securite_id")
    private FicheSecurite ficheSecurite;

    @Column(nullable = false)
    private int numero;

    private Integer profondeurPrevue;
    private Integer dureePrevue;

    private Integer profondeurRealisee;
    private Integer dureeRealisee;
    private String paliers;
    private LocalTime heureImmersion;
    private LocalTime heureSortie;

    @OneToMany(mappedBy = "palanquee", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MembrePalanquee> membres = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public FicheSecurite getFicheSecurite() {
        return ficheSecurite;
    }

    public void setFicheSecurite(FicheSecurite ficheSecurite) {
        this.ficheSecurite = ficheSecurite;
    }

    public int getNumero() {
        return numero;
    }

    public void setNumero(int numero) {
        this.numero = numero;
    }

    public Integer getProfondeurPrevue() {
        return profondeurPrevue;
    }

    public void setProfondeurPrevue(Integer profondeurPrevue) {
        this.profondeurPrevue = profondeurPrevue;
    }

    public Integer getDureePrevue() {
        return dureePrevue;
    }

    public void setDureePrevue(Integer dureePrevue) {
        this.dureePrevue = dureePrevue;
    }

    public Integer getProfondeurRealisee() {
        return profondeurRealisee;
    }

    public void setProfondeurRealisee(Integer profondeurRealisee) {
        this.profondeurRealisee = profondeurRealisee;
    }

    public Integer getDureeRealisee() {
        return dureeRealisee;
    }

    public void setDureeRealisee(Integer dureeRealisee) {
        this.dureeRealisee = dureeRealisee;
    }

    public String getPaliers() {
        return paliers;
    }

    public void setPaliers(String paliers) {
        this.paliers = paliers;
    }

    public LocalTime getHeureImmersion() {
        return heureImmersion;
    }

    public void setHeureImmersion(LocalTime heureImmersion) {
        this.heureImmersion = heureImmersion;
    }

    public LocalTime getHeureSortie() {
        return heureSortie;
    }

    public void setHeureSortie(LocalTime heureSortie) {
        this.heureSortie = heureSortie;
    }

    public List<MembrePalanquee> getMembres() {
        return membres;
    }
}
