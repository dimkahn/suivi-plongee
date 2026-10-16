package fr.club.plongee.materiel.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.Instant;

/**
 * Photo du matériel à la remise (AVANT) ou au retour (APRES) d'un prêt.
 * Table séparée de {@link Pret} : les listes ne lisent jamais le contenu
 * (voir {@code PhotoPretRepository.resumes}).
 */
@Entity
public class PhotoPret {

    public enum Moment { AVANT, APRES }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "pret_id")
    private Pret pret;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private Moment moment;

    /** Null : la photo montre tout le lot. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipement_id")
    private Equipement equipement;

    @Column(length = 120)
    private String legende;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] contenu;

    @Column(name = "type_contenu", nullable = false, length = 30)
    private String typeContenu;

    @Column(nullable = false)
    private Instant priseLe = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prise_par_id")
    private Utilisateur prisePar;

    public Long getId() {
        return id;
    }

    public Pret getPret() {
        return pret;
    }

    public void setPret(Pret pret) {
        this.pret = pret;
    }

    public Moment getMoment() {
        return moment;
    }

    public void setMoment(Moment moment) {
        this.moment = moment;
    }

    public Equipement getEquipement() {
        return equipement;
    }

    public void setEquipement(Equipement equipement) {
        this.equipement = equipement;
    }

    public String getLegende() {
        return legende;
    }

    public void setLegende(String legende) {
        this.legende = legende;
    }

    public byte[] getContenu() {
        return contenu;
    }

    public void setContenu(byte[] contenu) {
        this.contenu = contenu;
    }

    public String getTypeContenu() {
        return typeContenu;
    }

    public void setTypeContenu(String typeContenu) {
        this.typeContenu = typeContenu;
    }

    public Instant getPriseLe() {
        return priseLe;
    }

    public Utilisateur getPrisePar() {
        return prisePar;
    }

    public void setPrisePar(Utilisateur prisePar) {
        this.prisePar = prisePar;
    }
}
