package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Milieu;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Proposition automatique des palanquées d'une fiche de sécurité, en milieu
 * naturel seulement (choix du club, 2026) : le calcul est dans
 * {@link ProposeurPalanquees}, ce service résout les aptitudes et met le
 * résultat au format du formulaire de la fiche. Rien n'est enregistré : le
 * DP relit la proposition, la corrige et enregistre la fiche comme d'habitude.
 *
 * <p>L'aptitude d'un plongeur est celle saisie dans le groupe, complétée par
 * le dossier quand il est lié à un compte : niveau d'encadrement et niveau de
 * plongeur (un encadrant dont le groupe ne porte que « E2 » est bien vu
 * guide de palanquée). Un moniteur qui prépare le E3 encadre comme un E3
 * (stagiaire, voir {@link ProposeurPalanquees#NIVEAUX_STAGIAIRE_AUTORISES}).
 */
@Service
public class PropositionPalanqueesService {

    public record PlongeurPropose(Long eleveId, Long utilisateurId, String nom, String prenom, String aptitude,
                                  String qualificationPreparee, boolean encadrant) {}

    public record Demande(int profondeur, ProposeurPalanquees.TypePlongee type, int maxPlongeurs,
                          boolean autonomesEnsemble, boolean regrouperParNiveau,
                          List<PlongeurPropose> plongeurs, List<int[]> ensemble, List<int[]> separes) {}

    public record NonPlaceVue(String nom, String prenom, String raison) {}

    /** {@code palanquees} au format du formulaire de la fiche, prêtes à être retouchées puis enregistrées. */
    public record PropositionVue(List<FicheSecuriteService.PalanqueeVue> palanquees, List<NonPlaceVue> nonPlaces,
                                 List<String> encadrantsLibres, List<String> avertissements) {}

    private final SeanceRepository seances;
    private final UtilisateurRepository utilisateurs;
    private final EleveRepository eleves;

    public PropositionPalanqueesService(SeanceRepository seances, UtilisateurRepository utilisateurs,
                                        EleveRepository eleves) {
        this.seances = seances;
        this.utilisateurs = utilisateurs;
        this.eleves = eleves;
    }

    @Transactional(readOnly = true)
    public PropositionVue proposer(Long seanceId, Demande demande) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable"));
        if (seance.getMilieu() != Milieu.NATUREL) {
            throw new RegleMetierException(
                    "La proposition automatique des palanquées ne concerne que les plongées en milieu naturel.");
        }

        List<ProposeurPalanquees.Candidat> candidats = demande.plongeurs().stream()
                .map(p -> {
                    Utilisateur compte = compte(p);
                    NiveauEncadrement stagiaire = stagiaire(compte);
                    AptitudePlongeur aptitude = aptitude(p.aptitude(), compte);
                    if (stagiaire != null) aptitude = aptitude.avec(AptitudePlongeur.lire(stagiaire.name()));
                    return new ProposeurPalanquees.Candidat(p.eleveId(), p.utilisateurId(), p.nom(), p.prenom(),
                            p.aptitude(), p.qualificationPreparee(), aptitude, p.encadrant(), stagiaire);
                })
                .toList();
        ProposeurPalanquees.Proposition proposition = ProposeurPalanquees.proposer(candidats,
                new ProposeurPalanquees.Criteres(demande.profondeur(), demande.type(), demande.maxPlongeurs(),
                        demande.autonomesEnsemble(), demande.regrouperParNiveau(),
                        demande.ensemble(), demande.separes()));

        return new PropositionVue(
                proposition.palanquees().stream().map(p -> new FicheSecuriteService.PalanqueeVue(
                        p.numero(), demande.profondeur(), null, null, null, null, null, null,
                        p.membres().stream().map(m -> new FicheSecuriteService.PlongeurVue(
                                m.candidat().eleveId(), m.candidat().utilisateurId(), m.candidat().nom(),
                                m.candidat().prenom(), m.candidat().aptitudeTexte(), null,
                                m.candidat().qualificationPreparee(), m.fonction().name(),
                                null, null, p.autonome() ? "Palanquée autonome" : null)).toList()))
                        .toList(),
                proposition.nonPlaces().stream().map(n -> new NonPlaceVue(n.candidat().nom(),
                        n.candidat().prenom(), n.raison())).toList(),
                proposition.encadrantsLibres().stream().map(ProposeurPalanquees.Candidat::nomComplet).toList(),
                proposition.avertissements());
    }

    /** Le compte lié au plongeur : le sien d'encadrant, ou celui rattaché à son dossier d'élève. */
    private Utilisateur compte(PlongeurPropose p) {
        return p.utilisateurId() != null ? utilisateurs.findById(p.utilisateurId()).orElse(null)
                : p.eleveId() != null ? eleves.findById(p.eleveId()).map(e -> e.getUtilisateur()).orElse(null)
                : null;
    }

    /** Le niveau préparé d'un moniteur actif, s'il donne le droit d'encadrer comme acquis (stagiaire E3). */
    private static NiveauEncadrement stagiaire(Utilisateur compte) {
        if (compte == null || !compte.isActif() || !compte.estMoniteur()) return null;
        NiveauEncadrement prepare = compte.getNiveauEncadrementPrepare();
        return prepare != null && ProposeurPalanquees.NIVEAUX_STAGIAIRE_AUTORISES.contains(prepare)
                && !compte.getNiveauEncadrement().auMoins(prepare) ? prepare : null;
    }

    private static AptitudePlongeur aptitude(String texte, Utilisateur compte) {
        AptitudePlongeur a = AptitudePlongeur.lire(texte);
        if (compte != null) {
            a = a.avec(AptitudePlongeur.lire(compte.getNiveauPlongeur()));
            if (compte.isActif() && compte.estMoniteur()) {
                a = a.avec(AptitudePlongeur.lire(compte.getNiveauEncadrement().name()));
            }
        }
        return a;
    }
}
