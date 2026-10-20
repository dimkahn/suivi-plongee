package fr.club.plongee.evaluation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.service.FicheSecuriteService;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Habilitations metier, evaluees par @PreAuthorize.
 *
 * Le role seul ne suffit pas : le MFT exige un niveau d'encadrement minimum
 * qui depend du brevet prepare (E1 pour le N1, E2 pour le N2, E3 pour le N3).
 */
@Component("habilitation")
public class HabilitationService {

    private final CursusRepository cursusRepository;
    private final UtilisateurRepository utilisateurs;

    public HabilitationService(CursusRepository cursusRepository, UtilisateurRepository utilisateurs) {
        this.cursusRepository = cursusRepository;
        this.utilisateurs = utilisateurs;
    }

    /** Droit de saisir une evaluation sur ce cursus. */
    @Transactional(readOnly = true)
    public boolean peutEvaluer(Long cursusId, Authentication authentication) {
        UtilisateurPrincipal p = principal(authentication);
        if (p == null || !p.actif() || !aLeRole(authentication, RoleNom.MONITEUR)) return false;

        Cursus cursus = cursusRepository.chargerComplet(cursusId).orElse(null);
        return cursus != null && peutEvaluer(p, cursus);
    }

    /** Même règle, pour un cursus déjà chargé (notation groupée des présents d'une séance). */
    public boolean peutEvaluer(UtilisateurPrincipal p, Cursus cursus) {
        if (p == null || !p.actif() || !cursus.modifiable()) return false;
        NiveauEncadrement requis = cursus.getReferentiel().getNiveauEncadrantValidation();
        return p.niveauEncadrement() != null && p.niveauEncadrement().auMoins(requis);
    }

    /** Droit de consulter un cursus : encadrants et administratifs, ou l'eleve lui-meme. */
    @Transactional(readOnly = true)
    public boolean peutConsulter(Long cursusId, Authentication authentication) {
        UtilisateurPrincipal p = principal(authentication);
        if (p == null || !p.actif()) return false;
        if (aLeRole(authentication, RoleNom.MONITEUR) || aLeRole(authentication, RoleNom.ADMIN)) {
            return cursusRepository.existsById(cursusId);
        }
        return cursusRepository.idsDeLEleve(p.id()).contains(cursusId);
    }

    /** Droit de valider un bloc de competences entier. */
    public boolean peutValiderBloc(UtilisateurPrincipal p, BlocCompetence bloc) {
        NiveauEncadrement requis = bloc.getReferentiel().getNiveauEncadrantValidation();
        return p != null && p.actif() && p.niveauEncadrement() != null
                && p.niveauEncadrement().auMoins(requis);
    }

    /**
     * Droit d'établir ou de modifier une fiche de sécurité (choix du club,
     * 2026) : un moniteur E3 ou E4 (le niveau d'un directeur de plongée), un
     * administrateur, ou un moniteur qui a reçu le rôle FICHE_SECURITE. Le
     * complément au retour de plongée reste ouvert à tous les moniteurs et à
     * la sécurité surface : voir {@code FicheSecuriteController}.
     */
    public boolean peutEtablirFicheSecurite(Authentication authentication) {
        UtilisateurPrincipal p = principal(authentication);
        if (p == null || !p.actif()) return false;
        if (aLeRole(authentication, RoleNom.ADMIN)) return true;
        if (!aLeRole(authentication, RoleNom.MONITEUR)) return false;
        return aLeRole(authentication, RoleNom.FICHE_SECURITE)
                || (p.niveauEncadrement() != null
                    && p.niveauEncadrement().auMoins(FicheSecuriteService.NIVEAU_DP_MINIMUM));
    }

    /** Même règle, avec un refus lisible par le moniteur (422) plutôt qu'un simple « accès refusé ». */
    public void verifierEtablissementFicheSecurite(Authentication authentication) {
        if (!peutEtablirFicheSecurite(authentication)) {
            throw new RegleMetierException("Seuls les moniteurs " + FicheSecuriteService.NIVEAU_DP_MINIMUM
                    + " ou E4, ou ceux qui en ont reçu le droit (écran Moniteurs), peuvent établir ou modifier "
                    + "une fiche de sécurité. Vous pouvez la compléter au retour de plongée.");
        }
    }

    /**
     * Un compte de sécurité surface (ni moniteur ni administrateur) ne lit et
     * ne complète que les fiches des séances qui lui ont été confiées (choix
     * du club, 2026) ; les autres comptes ne sont pas concernés.
     */
    @Transactional(readOnly = true)
    public void verifierAccesSeance(Long seanceId, Authentication authentication) {
        UtilisateurPrincipal p = principal(authentication);
        if (p == null || !p.limiteAuxSeancesConfiees()) return;
        if (!utilisateurs.seanceConfiee(p.id(), seanceId)) {
            throw new RegleMetierException("Cette séance ne fait pas partie de celles qui vous ont été confiées. "
                    + "Voyez l'administrateur du club.");
        }
    }

    public static UtilisateurPrincipal principal(Authentication authentication) {
        if (authentication == null) return null;
        Object p = authentication.getPrincipal();
        return p instanceof UtilisateurPrincipal up ? up : null;
    }

    private static boolean aLeRole(Authentication authentication, RoleNom role) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + role.name()));
    }
}
