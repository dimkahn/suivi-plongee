package fr.club.plongee.formation.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

/**
 * Un plongeur au sein d'une {@link Palanquee}. Peut référencer un
 * {@link Eleve} ou un {@link Utilisateur} (encadrant) du club, pour
 * pré-remplir aptitude et qualification préparée depuis leur dossier — mais
 * {@code eleve}/{@code utilisateur} restent facultatifs et mutuellement
 * exclusifs : la fiche doit aussi pouvoir citer quelqu'un hors du système
 * (adhérent sans cursus, invité d'un autre club...). {@code nom}/{@code
 * prenom}/{@code aptitude}/{@code qualificationPreparee} sont pré-remplis à
 * la sélection puis restent des instantanés éditables, pas une jointure
 * vive : la fiche fige la situation du jour, comme un Cursus fige son
 * référentiel à l'inscription (voir la note du projet à ce sujet).
 */
@Entity
public class MembrePalanquee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "palanquee_id")
    private Palanquee palanquee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eleve_id")
    private Eleve eleve;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String prenom;

    /** Brevet ou qualification, en pratique le plus souvent le niveau de plongée. Texte libre. */
    private String aptitude;

    /** Niveau en cours de formation (N1/N2/N3) si le plongeur lié est un élève avec un cursus EN_COURS. */
    private String qualificationPreparee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FonctionPalanquee fonction = FonctionPalanquee.PLONGEUR;

    private String gaz;
    private String moyenDesaturation;

    @Column(columnDefinition = "text")
    private String observations;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Palanquee getPalanquee() {
        return palanquee;
    }

    public void setPalanquee(Palanquee palanquee) {
        this.palanquee = palanquee;
    }

    public Eleve getEleve() {
        return eleve;
    }

    public void setEleve(Eleve eleve) {
        this.eleve = eleve;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getPrenom() {
        return prenom;
    }

    public void setPrenom(String prenom) {
        this.prenom = prenom;
    }

    public String getAptitude() {
        return aptitude;
    }

    public void setAptitude(String aptitude) {
        this.aptitude = aptitude;
    }

    public String getQualificationPreparee() {
        return qualificationPreparee;
    }

    public void setQualificationPreparee(String qualificationPreparee) {
        this.qualificationPreparee = qualificationPreparee;
    }

    public FonctionPalanquee getFonction() {
        return fonction;
    }

    public void setFonction(FonctionPalanquee fonction) {
        this.fonction = fonction;
    }

    public String getGaz() {
        return gaz;
    }

    public void setGaz(String gaz) {
        this.gaz = gaz;
    }

    public String getMoyenDesaturation() {
        return moyenDesaturation;
    }

    public void setMoyenDesaturation(String moyenDesaturation) {
        this.moyenDesaturation = moyenDesaturation;
    }

    public String getObservations() {
        return observations;
    }

    public void setObservations(String observations) {
        this.observations = observations;
    }
}
