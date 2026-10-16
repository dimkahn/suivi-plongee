package fr.club.plongee.sejour.domaine.port;

import fr.club.plongee.sejour.domaine.Affaire;
import fr.club.plongee.sejour.domaine.Evenement;
import fr.club.plongee.sejour.domaine.FicheAffaire;
import fr.club.plongee.sejour.domaine.FicheEvenement;
import fr.club.plongee.sejour.domaine.GroupePropose;
import fr.club.plongee.sejour.domaine.Organisateur;
import fr.club.plongee.sejour.domaine.ResumeSejour;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * Le séjour lui-même : sa ligne (créateur, infos pratiques), ses
 * organisateurs, ses affaires à prévoir et son programme, et les groupes de
 * plongeurs de sa saison.
 */
public interface Sejours {

    /** {@code toutes} faux : seulement ceux qui finissent après {@code depuis}. Du plus récent au plus ancien. */
    List<ResumeSejour> resumes(Long moi, LocalDate depuis, boolean toutes);

    /** Null si rien n'est saisi. */
    String infosPratiques(Long sortieId);

    void definirInfos(Long sortieId, String infos);

    // Créateur et organisateurs

    boolean organise(Long sortieId, Long utilisateurId);

    boolean estCreateur(Long sortieId, Long utilisateurId);

    /** Le créateur (marqué) et les organisateurs désignés, sans ordre. */
    List<Organisateur> organisateurs(Long sortieId);

    List<Long> createur(Long sortieId);

    void noterCreateur(Long sortieId, Long utilisateurId);

    /** Parmi ces comptes, ceux d'encadrants actifs (moniteur, admin ou directeur technique). */
    List<Long> encadrantsActifs(Collection<Long> utilisateurIds);

    void remplacerOrganisateurs(Long sortieId, Collection<Long> utilisateurIds);

    // Affaires et programme

    List<Affaire> affaires(Long sortieId);

    void remplacerAffaires(Long sortieId, List<FicheAffaire> affaires);

    /** Sans ordre. */
    List<Evenement> evenements(Long sortieId);

    boolean evenementDuSejour(Long sortieId, Long evenementId);

    void creerEvenement(Long sortieId, FicheEvenement evenement);

    void modifierEvenement(Long evenementId, FicheEvenement evenement);

    void supprimerEvenement(Long evenementId);

    // Groupes de plongeurs

    /** Les groupes de la saison qui contient ce jour, avec leurs plongeurs. */
    List<GroupePropose> groupesDeLaSaison(LocalDate jour);
}
