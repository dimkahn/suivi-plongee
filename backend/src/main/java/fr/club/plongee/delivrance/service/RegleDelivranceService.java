package fr.club.plongee.delivrance.service;

import fr.club.plongee.delivrance.domain.Delivrance;
import fr.club.plongee.delivrance.repository.DelivranceRepository;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.evaluation.repository.ValidationCompetenceRepository;
import fr.club.plongee.formation.*;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.referentiel.domain.Referentiel;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Controles prealables a la delivrance d'un brevet. Toutes les valeurs
 * comparees viennent du referentiel en base : une evolution du MFT se charge,
 * elle ne se recompile pas.
 */
@Service
public class RegleDelivranceService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record Controle(String code, String libelle, boolean satisfait, String detail) {}

    public record Eligibilite(boolean eligible, List<Controle> controles) {}

    private final CursusRepository cursusRepository;
    private final QualificationRepository qualifications;
    private final ValidationCompetenceRepository validations;
    private final ParticipationRepository participations;
    private final DelivranceRepository delivrances;
    private final UtilisateurRepository utilisateurs;

    public RegleDelivranceService(CursusRepository cursusRepository,
                                  QualificationRepository qualifications,
                                  ValidationCompetenceRepository validations,
                                  ParticipationRepository participations,
                                  DelivranceRepository delivrances,
                                  UtilisateurRepository utilisateurs) {
        this.cursusRepository = cursusRepository;
        this.qualifications = qualifications;
        this.validations = validations;
        this.participations = participations;
        this.delivrances = delivrances;
        this.utilisateurs = utilisateurs;
    }

    @Transactional(readOnly = true)
    public Eligibilite eligibilite(Long cursusId) {
        Cursus cursus = cursusRepository.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
        return eligibilite(cursus, LocalDate.now());
    }

    private Eligibilite eligibilite(Cursus cursus, LocalDate date) {
        Referentiel ref = cursus.getReferentiel();
        Eleve eleve = cursus.getEleve();
        List<Controle> controles = new ArrayList<>();

        Integer age = eleve.ageAu(date);
        controles.add(new Controle("AGE_MINIMUM",
                "Age minimum de " + ref.getAgeMinimum() + " ans a la delivrance",
                age != null && age >= ref.getAgeMinimum(),
                age == null ? "Date de naissance manquante" : age + " ans"));

        if (age != null && age < 18) {
            controles.add(new Controle("AUTORISATION_LEGALE",
                    "Autorisation du responsable legal",
                    eleve.isAutorisationLegale(),
                    eleve.isAutorisationLegale() ? "Recueillie" : "A recueillir"));
        }

        controles.add(new Controle("CERTIFICAT_MEDICAL",
                "Certificat medical en cours de validite",
                eleve.certificatValideAu(date),
                eleve.getCertificatValideJusquAu() == null
                        ? "Aucune date enregistree"
                        : "Valide jusqu'au " + eleve.getCertificatValideJusquAu().format(DATE)));

        if (ref.getNiveauPrerequis() != null) {
            String prerequis = ref.getNiveauPrerequis().name();
            boolean detenu = qualifications
                    .findByEleveIdAndTypeIgnoreCase(eleve.getId(), prerequis)
                    .isPresent();
            controles.add(new Controle("NIVEAU_PREREQUIS",
                    "Brevet " + prerequis + " ou equivalence",
                    detenu, detenu ? "Detenu" : "Non enregistre"));
        }

        if (ref.getQualificationRequise() != null) {
            String requise = ref.getQualificationRequise();
            boolean valide = qualifications
                    .findByEleveIdAndTypeIgnoreCase(eleve.getId(), requise)
                    .map(q -> q.valideAu(date))
                    .orElse(false);
            controles.add(new Controle("QUALIFICATION_REQUISE",
                    requise + " valide a la date de delivrance",
                    valide, valide ? "A jour" : "Manquant ou expire"));
        }

        List<BlocCompetence> blocs = ref.getBlocs();
        long valides = validations.findByCursusId(cursus.getId()).size();
        controles.add(new Controle("COMPETENCES",
                "Toutes les competences validees",
                valides >= blocs.size(),
                valides + " / " + blocs.size()));

        boolean eligible = controles.stream().allMatch(Controle::satisfait);
        return new Eligibilite(eligible, controles);
    }

    @Transactional
    public Delivrance delivrer(Long cursusId, String numeroBrevet, UtilisateurPrincipal auteur) {
        Cursus cursus = cursusRepository.chargerComplet(cursusId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cursus introuvable"));
        Referentiel ref = cursus.getReferentiel();
        LocalDate aujourdHui = LocalDate.now();

        if (auteur.niveauEncadrement() == null
                || !auteur.niveauEncadrement().auMoins(ref.getNiveauEncadrantDelivrance())) {
            throw new RegleMetierException("La delivrance du " + ref.getNiveau()
                    + " est reservee aux encadrants " + ref.getNiveauEncadrantDelivrance()
                    + " et au-dela, sous la responsabilite du president du club.");
        }
        if (delivrances.findByCursusId(cursusId).isPresent()) {
            throw new RegleMetierException("Ce brevet a deja ete delivre.");
        }

        Eligibilite bilan = eligibilite(cursus, aujourdHui);
        if (!bilan.eligible()) {
            String manquants = bilan.controles().stream()
                    .filter(c -> !c.satisfait())
                    .map(Controle::libelle)
                    .reduce((a, b) -> a + " ; " + b).orElse("");
            throw new RegleMetierException("Conditions non remplies : " + manquants);
        }

        Delivrance d = new Delivrance();
        d.setCursus(cursus);
        d.setDelivrePar(utilisateur(auteur));
        d.setDateDelivrance(aujourdHui);
        d.setNumeroBrevet(numeroBrevet);

        // N1 certifie sans aucune seance en milieu naturel : 4 plongees a attester
        // sur le carnet dans les douze mois.
        if (ref.getNiveau().name().equals("N1") && !aPlongeEnMilieuNaturel(cursusId)) {
            d.setPlongeesMilieuNaturelAFaire(4);
            d.setEcheancePlongees(aujourdHui.plusMonths(12));
        }

        cursus.setStatut(Cursus.Statut.DELIVRE);
        cursus.getEleve().enregistrerBrevet(ref.getNiveau().name());

        Qualification q = new Qualification();
        q.setEleve(cursus.getEleve());
        q.setType(ref.getNiveau().name());
        q.setDateObtention(aujourdHui);
        qualifications.save(q);

        return delivrances.save(d);
    }

    private boolean aPlongeEnMilieuNaturel(Long cursusId) {
        return participations.findByCursusId(cursusId).stream()
                .anyMatch(p -> p.getStatut() == Participation.Statut.PRESENT
                        && p.getSeance().getMilieu() == Milieu.NATUREL);
    }

    private Utilisateur utilisateur(UtilisateurPrincipal p) {
        return utilisateurs.findById(p.id()).orElseThrow();
    }
}
