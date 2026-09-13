package fr.club.plongee.referentiel;

import fr.club.plongee.securite.NiveauEncadrement;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Un referentiel = un niveau de brevet + une version datee du MFT.
 * Un cursus est fige sur un referentiel : une revision du MFT ne modifie
 * jamais retroactivement une formation deja engagee.
 */
@Entity
public class Referentiel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Niveau niveau;

    @Column(nullable = false)
    private String versionMft;

    @Column(nullable = false)
    private LocalDate dateApplication;

    private String source;

    @Column(nullable = false)
    private boolean actif = true;

    // --- regles de delivrance, portees par la donnee et non par le code ---

    @Column(nullable = false)
    private int ageMinimum;

    @Enumerated(EnumType.STRING)
    private Niveau niveauPrerequis;

    /** Qualification exigee a la date de delivrance (RIFAP pour le N3). */
    private String qualificationRequise;

    /** N2 et N3 : competences a obtenir en milieu naturel, piscines et fosses exclues. */
    @Column(nullable = false)
    private boolean milieuNaturelExclusif;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NiveauEncadrement niveauEncadrantValidation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NiveauEncadrement niveauEncadrantDelivrance;

    @Column(nullable = false)
    private int profondeurMaxValidation;

    @Column(nullable = false)
    private int profondeurMaxFormation;

    @Column(nullable = false)
    private int prerogativeProfondeur;

    @OneToMany(mappedBy = "referentiel", fetch = FetchType.LAZY)
    @OrderBy("ordre")
    private List<BlocCompetence> blocs = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Niveau getNiveau() {
        return niveau;
    }

    public void setNiveau(Niveau niveau) {
        this.niveau = niveau;
    }

    public String getVersionMft() {
        return versionMft;
    }

    public void setVersionMft(String versionMft) {
        this.versionMft = versionMft;
    }

    public LocalDate getDateApplication() {
        return dateApplication;
    }

    public void setDateApplication(LocalDate dateApplication) {
        this.dateApplication = dateApplication;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public boolean isActif() {
        return actif;
    }

    public void setActif(boolean actif) {
        this.actif = actif;
    }

    public int getAgeMinimum() {
        return ageMinimum;
    }

    public void setAgeMinimum(int ageMinimum) {
        this.ageMinimum = ageMinimum;
    }

    public Niveau getNiveauPrerequis() {
        return niveauPrerequis;
    }

    public void setNiveauPrerequis(Niveau niveauPrerequis) {
        this.niveauPrerequis = niveauPrerequis;
    }

    public String getQualificationRequise() {
        return qualificationRequise;
    }

    public void setQualificationRequise(String qualificationRequise) {
        this.qualificationRequise = qualificationRequise;
    }

    public boolean isMilieuNaturelExclusif() {
        return milieuNaturelExclusif;
    }

    public void setMilieuNaturelExclusif(boolean milieuNaturelExclusif) {
        this.milieuNaturelExclusif = milieuNaturelExclusif;
    }

    public NiveauEncadrement getNiveauEncadrantValidation() {
        return niveauEncadrantValidation;
    }

    public void setNiveauEncadrantValidation(NiveauEncadrement niveauEncadrantValidation) {
        this.niveauEncadrantValidation = niveauEncadrantValidation;
    }

    public NiveauEncadrement getNiveauEncadrantDelivrance() {
        return niveauEncadrantDelivrance;
    }

    public void setNiveauEncadrantDelivrance(NiveauEncadrement niveauEncadrantDelivrance) {
        this.niveauEncadrantDelivrance = niveauEncadrantDelivrance;
    }

    public int getProfondeurMaxValidation() {
        return profondeurMaxValidation;
    }

    public void setProfondeurMaxValidation(int profondeurMaxValidation) {
        this.profondeurMaxValidation = profondeurMaxValidation;
    }

    public int getProfondeurMaxFormation() {
        return profondeurMaxFormation;
    }

    public void setProfondeurMaxFormation(int profondeurMaxFormation) {
        this.profondeurMaxFormation = profondeurMaxFormation;
    }

    public int getPrerogativeProfondeur() {
        return prerogativeProfondeur;
    }

    public void setPrerogativeProfondeur(int prerogativeProfondeur) {
        this.prerogativeProfondeur = prerogativeProfondeur;
    }

    public List<BlocCompetence> getBlocs() {
        return blocs;
    }

    public void setBlocs(List<BlocCompetence> blocs) {
        this.blocs = blocs;
    }
}
