package fr.club.plongee.evaluation.service;

import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.referentiel.domain.BlocCompetence;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.UtilisateurPrincipal;
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

    public HabilitationService(CursusRepository cursusRepository) {
        this.cursusRepository = cursusRepository;
    }

    /** Droit de saisir une evaluation sur ce cursus. */
    @Transactional(readOnly = true)
    public boolean peutEvaluer(Long cursusId, Authentication authentication) {
        UtilisateurPrincipal p = principal(authentication);
        if (p == null || !p.actif() || !aLeRole(authentication, RoleNom.MONITEUR)) return false;

        Cursus cursus = cursusRepository.chargerComplet(cursusId).orElse(null);
        if (cursus == null || !cursus.modifiable()) return false;

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
