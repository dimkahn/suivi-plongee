package fr.club.plongee.formation.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;
import org.hibernate.envers.RelationTargetAuditMode;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Fiche de sécurité d'une séance (A322-72 du Code du sport) : conditions du
 * jour, sécurité surface, plan de secours, et le détail par palanquée porté
 * par {@link Palanquee}. Le nom de la structure, le DP, la date et le lieu ne
 * sont pas dupliqués ici : le DP est propre à la fiche (voir {@link #dp}),
 * date et lieu restent portés par {@link Seance}. Modifiable jusqu'à sa
 * signature par le DP ({@link #signataire}), figée ensuite ; historisée via
 * Envers (voir fr.club.plongee.audit). Les palanquées et leurs membres ne le
 * sont pas, comme {@link Participation} : ce sont des lignes remplacées en
 * bloc à chaque enregistrement, pas des décisions qu'on a besoin de tracer
 * individuellement dans le temps.
 */
@Entity
@Audited
public class FicheSecurite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED)
    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id", unique = true)
    private Seance seance;

    /** Établit et signe la fiche : peut différer du champ dp, encore non exploité, de Seance. */
    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED)
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "dp_id")
    private Utilisateur dp;

    private String meteo;
    private String etatMer;
    private String visibilite;
    private String courant;
    private String maree;
    private String temperatureEau;

    @Column(columnDefinition = "text")
    private String securiteSurface;

    @Column(columnDefinition = "text")
    private String planSecours;

    @Column(columnDefinition = "text")
    private String observations;

    @NotAudited
    @OneToMany(mappedBy = "ficheSecurite", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("numero")
    private List<Palanquee> palanquees = new ArrayList<>();

    /** Le DP qui a signé la fiche ; null tant qu'elle n'est pas signée. Signée, elle ne se modifie plus. */
    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signataire_id")
    private Utilisateur signataire;

    private Instant signeeLe;

    /** Empreinte scellée du contenu signé : voir {@code EmpreinteFicheSecurite}. */
    private String empreinte;

    public boolean estSignee() {
        return signeeLe != null;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Seance getSeance() {
        return seance;
    }

    public void setSeance(Seance seance) {
        this.seance = seance;
    }

    public Utilisateur getDp() {
        return dp;
    }

    public void setDp(Utilisateur dp) {
        this.dp = dp;
    }

    public String getMeteo() {
        return meteo;
    }

    public void setMeteo(String meteo) {
        this.meteo = meteo;
    }

    public String getEtatMer() {
        return etatMer;
    }

    public void setEtatMer(String etatMer) {
        this.etatMer = etatMer;
    }

    public String getVisibilite() {
        return visibilite;
    }

    public void setVisibilite(String visibilite) {
        this.visibilite = visibilite;
    }

    public String getCourant() {
        return courant;
    }

    public void setCourant(String courant) {
        this.courant = courant;
    }

    public String getMaree() {
        return maree;
    }

    public void setMaree(String maree) {
        this.maree = maree;
    }

    public String getTemperatureEau() {
        return temperatureEau;
    }

    public void setTemperatureEau(String temperatureEau) {
        this.temperatureEau = temperatureEau;
    }

    public String getSecuriteSurface() {
        return securiteSurface;
    }

    public void setSecuriteSurface(String securiteSurface) {
        this.securiteSurface = securiteSurface;
    }

    public String getPlanSecours() {
        return planSecours;
    }

    public void setPlanSecours(String planSecours) {
        this.planSecours = planSecours;
    }

    public String getObservations() {
        return observations;
    }

    public void setObservations(String observations) {
        this.observations = observations;
    }

    public List<Palanquee> getPalanquees() {
        return palanquees;
    }

    public Utilisateur getSignataire() {
        return signataire;
    }

    public void setSignataire(Utilisateur signataire) {
        this.signataire = signataire;
    }

    public Instant getSigneeLe() {
        return signeeLe;
    }

    public void setSigneeLe(Instant signeeLe) {
        this.signeeLe = signeeLe;
    }

    public String getEmpreinte() {
        return empreinte;
    }

    public void setEmpreinte(String empreinte) {
        this.empreinte = empreinte;
    }
}
