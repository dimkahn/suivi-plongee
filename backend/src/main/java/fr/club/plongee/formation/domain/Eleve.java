package fr.club.plongee.formation.domain;

import fr.club.plongee.commun.ActiviteCaci;
import fr.club.plongee.commun.Caci;
import fr.club.plongee.commun.ConvertisseurActivitesCaci;
import fr.club.plongee.commun.MedecinCaci;
import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;
import org.hibernate.envers.Audited;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.EnumSet;
import java.util.Set;

/** Dossier élève : historisé via Envers (voir fr.club.plongee.audit), y compris les consentements. */
@Entity
@Audited
public class Eleve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String prenom;

    private LocalDate dateNaissance;

    private String numeroLicence;

    /**
     * Fin de validite du CACI, deduite de la date de l'examen (voir
     * {@link Caci#finValidite}). Jamais le certificat medical lui-meme.
     */
    private LocalDate certificatValideJusquAu;

    /** Date de l'examen médical portée sur le CACI. */
    private LocalDate caciDateExamen;

    /** Qualité du médecin signataire du CACI. */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private MedecinCaci caciMedecin;

    /** Cases cochées sur le CACI FFESSM : ce que le certificat couvre, rien de plus. */
    @Convert(converter = ConvertisseurActivitesCaci.class)
    @Column(length = 400)
    private Set<ActiviteCaci> caciActivites = EnumSet.noneOf(ActiviteCaci.class);

    /**
     * Dernier niveau de plongée connu (ex. « N2 »), déclaratif : sert à
     * pré-remplir l'aptitude d'un membre de palanquée ou d'un groupe de
     * plongeurs (voir PlongeurConnuService) quand l'élève n'a pas encore de
     * {@link Cursus} DELIVRE dans l'application — typiquement un brevet
     * obtenu avant l'usage de l'outil ou dans un autre club. Mis à jour
     * quand un cursus passe à DELIVRE (voir {@link #enregistrerBrevet}),
     * pour que la fiche élève reste juste.
     */
    private String dernierNiveau;

    private String email;

    private String telephone;

    /** Personne à prévenir en cas d'urgence : nom et téléphone, jamais un contact médical. */
    private String contactUrgenceNom;

    private String contactUrgenceTelephone;

    /**
     * Tailles pour le prêt de matériel (gilet stabilisateur, combinaison),
     * en texte libre comme {@code equipement.taille} : S, M, T3, 12 ans...
     */
    @Column(length = 20)
    private String tailleGilet;

    @Column(length = 20)
    private String tailleCombinaison;

    @Column(nullable = false)
    private boolean autorisationLegale = false;

    /**
     * Droit à l'image : consentement distinct de autorisationLegale (qui ne
     * couvre que la pratique). Une photo n'est jamais affichée sans lui.
     */
    @Column(nullable = false)
    private boolean autorisationImage = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    private Instant archiveLe;

    public String nomComplet() {
        return prenom + " " + nom;
    }

    public Integer ageAu(LocalDate date) {
        return dateNaissance == null ? null : Period.between(dateNaissance, date).getYears();
    }

    public boolean certificatValideAu(LocalDate date) {
        return certificatValideJusquAu != null && !certificatValideJusquAu.isBefore(date);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public LocalDate getDateNaissance() {
        return dateNaissance;
    }

    public void setDateNaissance(LocalDate dateNaissance) {
        this.dateNaissance = dateNaissance;
    }

    public String getNumeroLicence() {
        return numeroLicence;
    }

    public void setNumeroLicence(String numeroLicence) {
        this.numeroLicence = numeroLicence;
    }

    public LocalDate getCertificatValideJusquAu() {
        return certificatValideJusquAu;
    }

    public void setCertificatValideJusquAu(LocalDate certificatValideJusquAu) {
        this.certificatValideJusquAu = certificatValideJusquAu;
    }

    public Caci getCaci() {
        return new Caci(caciDateExamen, caciMedecin, caciActivites);
    }

    /** Date de l'examen, médecin et cases, après vérification ; la fin de validité s'en déduit. */
    public void setCaci(Caci caci) {
        caci.verifier();
        this.certificatValideJusquAu = caci.finValidite();
        this.caciDateExamen = caci.dateExamen();
        this.caciMedecin = caci.medecin();
        setCaciActivites(caci.activites());
    }

    public LocalDate getCaciDateExamen() {
        return caciDateExamen;
    }

    public void setCaciDateExamen(LocalDate caciDateExamen) {
        this.caciDateExamen = caciDateExamen;
    }

    public MedecinCaci getCaciMedecin() {
        return caciMedecin;
    }

    public void setCaciMedecin(MedecinCaci caciMedecin) {
        this.caciMedecin = caciMedecin;
    }

    public Set<ActiviteCaci> getCaciActivites() {
        return caciActivites;
    }

    public void setCaciActivites(Set<ActiviteCaci> caciActivites) {
        this.caciActivites = caciActivites == null || caciActivites.isEmpty()
                ? EnumSet.noneOf(ActiviteCaci.class) : EnumSet.copyOf(caciActivites);
    }

    public String getDernierNiveau() {
        return dernierNiveau;
    }

    public void setDernierNiveau(String dernierNiveau) {
        this.dernierNiveau = dernierNiveau;
    }

    /**
     * Un brevet vient d'être délivré dans l'application : il devient le
     * dernier niveau connu, sauf si la fiche porte déjà un niveau N1-N5 plus
     * élevé (brevet obtenu ailleurs, correction tardive d'un ancien cursus).
     * Un niveau déclaré hors de cette échelle (« CMAS 2* ») est remplacé.
     */
    public void enregistrerBrevet(String niveau) {
        if (dernierNiveau != null && dernierNiveau.trim().matches("N[1-5]")
                && dernierNiveau.trim().compareTo(niveau) > 0) {
            return;
        }
        this.dernierNiveau = niveau;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getTelephone() {
        return telephone;
    }

    public void setTelephone(String telephone) {
        this.telephone = telephone;
    }

    public String getContactUrgenceNom() {
        return contactUrgenceNom;
    }

    public void setContactUrgenceNom(String contactUrgenceNom) {
        this.contactUrgenceNom = contactUrgenceNom;
    }

    public String getContactUrgenceTelephone() {
        return contactUrgenceTelephone;
    }

    public void setContactUrgenceTelephone(String contactUrgenceTelephone) {
        this.contactUrgenceTelephone = contactUrgenceTelephone;
    }

    public String getTailleGilet() {
        return tailleGilet;
    }

    public void setTailleGilet(String tailleGilet) {
        this.tailleGilet = tailleGilet;
    }

    public String getTailleCombinaison() {
        return tailleCombinaison;
    }

    public void setTailleCombinaison(String tailleCombinaison) {
        this.tailleCombinaison = tailleCombinaison;
    }

    public boolean isAutorisationLegale() {
        return autorisationLegale;
    }

    public void setAutorisationLegale(boolean autorisationLegale) {
        this.autorisationLegale = autorisationLegale;
    }

    public boolean isAutorisationImage() {
        return autorisationImage;
    }

    public void setAutorisationImage(boolean autorisationImage) {
        this.autorisationImage = autorisationImage;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public void setUtilisateur(Utilisateur utilisateur) {
        this.utilisateur = utilisateur;
    }

    public Instant getArchiveLe() {
        return archiveLe;
    }

    public void setArchiveLe(Instant archiveLe) {
        this.archiveLe = archiveLe;
    }
}
