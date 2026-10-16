package fr.club.plongee.sejour.application;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.formation.service.SortieService.SortieVue;
import fr.club.plongee.securite.UtilisateurPrincipal;
import fr.club.plongee.sejour.domaine.*;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour.Inscrit;
import fr.club.plongee.sejour.domaine.port.Sejours;
import fr.club.plongee.sejour.domaine.port.VoituresEtChambres;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

import static fr.club.plongee.sejour.domaine.Textes.blanc;
import static fr.club.plongee.sejour.domaine.Textes.nettoyer;

/**
 * Le séjour d'une sortie (V75) : participants et leurs trajets, voitures,
 * logements et chambres, affaires à prévoir, programme et infos pratiques.
 * Tables lues et écrites en SQL (pas d'entité, comme l'identité de la
 * structure), derrière les ports {@link Sejours}, {@link ParticipantsSejour}
 * et {@link VoituresEtChambres} : tout dépend de la sortie et disparaît avec elle.
 * <p>
 * Modifié par son créateur et les organisateurs qu'il a désignés
 * ({@link DroitsSejour}, V80) ; lu en entier par les encadrants. Un participant qui a un compte (son dossier
 * élève ou son compte d'encadrant) lit le « carnet » : les mêmes données
 * sans les coordonnées, régimes et personnes à prévenir des autres.
 * <p>
 * Aucune donnée de santé (règle du club) : le régime alimentaire est une
 * liste de cases ({@link RegimeAlimentaire}) et une précision pour la
 * cuisine.
 * <p>
 * Les avertissements (voiture ou chambre trop pleine, participant sans
 * chambre...) sont calculés ici et ne bloquent jamais : l'organisateur
 * peut avoir ses raisons. Seule exception : une personne n'est que dans
 * une seule voiture, conducteur ou passager (refus à l'enregistrement) ;
 * l'avertissement « plusieurs voitures » ne sert plus qu'aux séjours
 * saisis avant cette règle.
 * <p>
 * Un participant qui plonge peut être lié à un plongeur d'un groupe de
 * plongeurs de la saison (V79) : deux fiches, mais nom, prénom et e-mail
 * suivent de l'une à l'autre. Un accompagnant n'a pas de lien.
 */
@Service
public class SejourService {

    /** Un rendez-vous du programme peut tomber un peu avant ou après la sortie (voyage). */
    static final int JOURS_AUTOUR_DU_PROGRAMME = 7;
    static final int AFFAIRES_MAX = 200;
    /** Une adresse plausible : quelque chose, une arobase, un domaine avec un point. */
    private static final java.util.regex.Pattern EMAIL = java.util.regex.Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    /**
     * {@code moi} : ce participant est le compte connecté. Dans le carnet
     * d'un participant, coordonnées, régimes, personne à prévenir et
     * remarques des autres sont vides. {@code membreGroupeId} : le plongeur
     * d'un groupe de plongeurs qu'il est aussi (V79), {@code groupe} le nom
     * de ce groupe ; null pour un accompagnant ou un plongeur hors groupe.
     */
    public record ParticipantVue(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                                 boolean plongeur, String telephone, String email,
                                 Set<RegimeAlimentaire> regimes, String regimePrecision,
                                 String urgenceNom, String urgenceTelephone,
                                 Trajet arrivee, Trajet depart, String remarques, boolean moi,
                                 Long membreGroupeId, String groupe) {

        static ParticipantVue de(Participant p, boolean moi) {
            return new ParticipantVue(p.id(), p.eleveId(), p.utilisateurId(), p.nom(), p.prenom(), p.plongeur(),
                    p.telephone(), p.email(), p.regimes(), p.regimePrecision(), p.urgenceNom(), p.urgenceTelephone(),
                    p.arrivee(), p.depart(), p.remarques(), moi, p.membreGroupeId(), p.groupe());
        }

        ParticipantVue commeMoi() {
            return new ParticipantVue(id, eleveId, utilisateurId, nom, prenom, plongeur, telephone, email, regimes,
                    regimePrecision, urgenceNom, urgenceTelephone, arrivee, depart, remarques, true, membreGroupeId,
                    groupe);
        }
    }

    /**
     * Ce qu'un participant renseigne lui-même, par le lien reçu par e-mail
     * ou par « Mon séjour » dans l'appli : ses coordonnées, son voyage, ses
     * repas, la personne à prévenir. Ni nom, ni rôle de plongeur, ni dossier :
     * cela reste à l'organisateur.
     */
    public record DemandeMesInformations(@Size(max = 30) String telephone, Set<RegimeAlimentaire> regimes,
                                         @Size(max = 300) String regimePrecision,
                                         @Size(max = 120) String urgenceNom, @Size(max = 30) String urgenceTelephone,
                                         @Valid Trajet arrivee, @Valid Trajet depart, String remarques) {}

    /**
     * {@code gere} : le compte peut modifier le séjour (créateur ou
     * organisateur) ; {@code encadrant} : il voit tout (sinon, c'est le
     * carnet d'un participant) ; {@code peutDesigner} : il choisit les
     * organisateurs (le créateur, ou un ADMIN). {@code palanquees} : celles
     * des plongées de la sortie, toutes pour un encadrant, la sienne seulement
     * pour un participant.
     */
    public record SejourVue(SortieVue sortie, boolean gere, boolean encadrant, String infosPratiques,
                            List<ParticipantVue> participants, List<Voiture> voitures,
                            List<Logement> logements, List<Affaire> affaires,
                            List<Evenement> evenements, FraisService.FraisVue frais, List<String> avertissements,
                            List<GroupePropose> groupesProposes, List<Organisateur> organisateurs,
                            boolean peutDesigner, List<PalanqueesSejourService.PalanqueeVue> palanquees) {}

    /**
     * Le programme (rendez-vous et plongées de la sortie) et les affaires à
     * prévoir, pour la page du participant entré par le lien : son encart
     * « Aujourd'hui ». Rien de personnel, hormis sa palanquée.
     */
    public record ProgrammeVue(List<Evenement> evenements, List<SortieService.SeanceSortieVue> plongees,
                               List<Affaire> affaires, List<PalanqueesSejourService.PalanqueeVue> palanquees) {}

    /** Le même vol (ou train) pour plusieurs participants : arrivée ou départ, sans rien recopier. */
    public record DemandeTrajetCommun(@NotNull SensTrajet sens, @Valid Trajet trajet, @NotNull List<Long> participantIds) {}

    private final Sejours sejours;
    private final ParticipantsSejour participants;
    private final VoituresEtChambres voituresEtChambres;
    private final SortieService sorties;
    private final FraisService frais;
    private final DroitsSejour droits;
    private final PalanqueesSejourService palanquees;

    public SejourService(Sejours sejours, ParticipantsSejour participants, VoituresEtChambres voituresEtChambres,
                         SortieService sorties, FraisService frais, DroitsSejour droits,
                         PalanqueesSejourService palanquees) {
        this.sejours = sejours;
        this.participants = participants;
        this.voituresEtChambres = voituresEtChambres;
        this.sorties = sorties;
        this.frais = frais;
        this.droits = droits;
        this.palanquees = palanquees;
    }

    // ------------------------------------------------------------------
    //  Droits
    // ------------------------------------------------------------------

    public static boolean encadrant(UtilisateurPrincipal p) {
        return aRole(p, "MONITEUR") || aRole(p, "ADMIN") || aRole(p, "DIRECTEUR_TECHNIQUE");
    }

    private static boolean aRole(UtilisateurPrincipal p, String role) {
        return p.getAuthorities().stream().anyMatch(a -> ("ROLE_" + role).equals(a.getAuthority()));
    }

    // ------------------------------------------------------------------
    //  Lecture
    // ------------------------------------------------------------------

    /**
     * Encadrants : les séjours à venir ou finis depuis peu (ou tous) ; les
     * autres comptes : ceux où ils sont inscrits, quelle que soit la date.
     */
    @Transactional(readOnly = true)
    public List<ResumeSejour> lister(boolean toutes, UtilisateurPrincipal principal) {
        boolean encadrant = encadrant(principal);
        List<ResumeSejour> liste = sejours.resumes(principal.id(),
                Calendrier.aujourdhui().minusDays(SortieService.JOURS_SORTIES_RECENTES), toutes || !encadrant);
        if (!encadrant) return liste.stream().filter(ResumeSejour::jeParticipe).toList();
        if (toutes) return liste;
        // À venir : du plus proche au plus lointain.
        List<ResumeSejour> aVenir = new ArrayList<>(liste);
        Collections.reverse(aVenir);
        return aVenir;
    }

    @Transactional(readOnly = true)
    public SejourVue lire(Long sortieId, UtilisateurPrincipal principal) {
        boolean encadrant = encadrant(principal);
        boolean gere = encadrant && droits.organise(sortieId, principal.id());
        SejourVue complet = vueComplete(sortieId, principal.id(), gere, encadrant);
        complet = avecFrais(complet, frais.lire(sortieId, frais.acteur(sortieId, principal)));
        if (encadrant) return avecDesignation(complet, droits.peutDesigner(sortieId, principal));
        if (complet.participants().stream().noneMatch(ParticipantVue::moi)) {
            throw new AccessDeniedException("Ce séjour n'est ouvert qu'à ses participants et aux encadrants.");
        }
        return carnet(complet);
    }

    /** Tout le séjour, sans filtre : pour les encadrants et pour l'envoi du carnet par e-mail. */
    @Transactional(readOnly = true)
    public SejourVue vueComplete(Long sortieId, Long moi, boolean gere, boolean encadrant) {
        SortieVue sortie = sorties.lire(sortieId);
        List<ParticipantVue> inscrits = participants.participants(sortieId).stream()
                .map(p -> ParticipantVue.de(p, p.estLeCompte(moi)))
                .sorted(Comparator.comparing((ParticipantVue p) -> p.nom().toLowerCase(Locale.ROOT))
                        .thenComparing(p -> p.prenom().toLowerCase(Locale.ROOT)))
                .toList();
        List<Voiture> voitures = voituresEtChambres.voitures(sortieId);
        List<Logement> logements = voituresEtChambres.logements(sortieId);
        List<GroupePropose> groupes = !gere ? List.of() : sejours.groupesDeLaSaison(sortie.dateDebut());
        Long monId = inscrits.stream().filter(ParticipantVue::moi).map(ParticipantVue::id).findFirst().orElse(null);

        return new SejourVue(sortie, gere, encadrant, sejours.infosPratiques(sortieId), inscrits,
                voitures, logements, sejours.affaires(sortieId), evenements(sortieId),
                frais.lire(sortieId, FraisService.ActeurFrais.LECTURE),
                avertissements(inscrits, voitures, logements), groupes, organisateurs(sortieId), false,
                palanquees.palanquees(sortieId, monId, encadrant));
    }

    /** Le créateur d'abord, puis les organisateurs qu'il a désignés. */
    private List<Organisateur> organisateurs(Long sortieId) {
        List<Organisateur> liste = new ArrayList<>(sejours.organisateurs(sortieId));
        liste.sort(Comparator.comparing((Organisateur o) -> !o.createur())
                .thenComparing(o -> o.nomComplet().toLowerCase(Locale.ROOT)));
        return liste;
    }

    /** Le compte qui crée la sortie devient le créateur de son séjour. */
    @Transactional
    public void noterCreateur(Long sortieId, Long utilisateurId) {
        sejours.noterCreateur(sortieId, utilisateurId);
    }

    /**
     * Les organisateurs désignés (le créateur n'y figure pas : il l'est
     * toujours). Seulement des comptes d'encadrant actifs : ils modifient le
     * séjour depuis l'appli.
     */
    @Transactional
    public void definirOrganisateurs(Long sortieId, List<Long> utilisateurIds) {
        sorties.lire(sortieId);
        Set<Long> choisis = new LinkedHashSet<>(utilisateurIds);
        choisis.removeAll(sejours.createur(sortieId));
        if (!choisis.isEmpty() && sejours.encadrantsActifs(choisis).size() != choisis.size()) {
            throw new RegleMetierException("Seul un encadrant qui a un compte actif peut organiser le séjour.");
        }
        sejours.remplacerOrganisateurs(sortieId, choisis);
    }

    @Transactional(readOnly = true)
    public ProgrammeVue programme(Long sortieId, Long participantId) {
        return new ProgrammeVue(evenements(sortieId), sorties.lire(sortieId).seances(), sejours.affaires(sortieId),
                palanquees.palanquees(sortieId, participantId, false));
    }

    private List<Evenement> evenements(Long sortieId) {
        return sejours.evenements(sortieId).stream()
                .sorted(Comparator.comparing(Evenement::jour)
                        .thenComparing(e -> e.heureDebut() == null ? LocalTime.MIN : e.heureDebut())
                        .thenComparing(Evenement::id))
                .toList();
    }

    /**
     * Le carnet d'un participant entré par le lien et le code (sans compte) :
     * le même que celui d'un participant connecté à l'appli, « moi » étant
     * repéré par sa ligne et non par un compte.
     */
    @Transactional(readOnly = true)
    public SejourVue carnetDuParticipant(Long sortieId, Long participantId) {
        SejourVue complet = vueComplete(sortieId, null, false, false);
        List<ParticipantVue> inscrits = complet.participants().stream()
                .map(p -> p.id().equals(participantId) ? p.commeMoi() : p)
                .toList();
        return carnet(new SejourVue(complet.sortie(), false, false, complet.infosPratiques(), inscrits,
                complet.voitures(), complet.logements(), complet.affaires(), complet.evenements(),
                frais.lire(sortieId, frais.acteurParticipant(participantId)), List.of(), List.of(),
                complet.organisateurs(), false, palanquees.palanquees(sortieId, participantId, false)));
    }

    /** Le même séjour, avec les frais vus par celui qui agit (ce qu'il peut saisir, modifier). */
    private static SejourVue avecFrais(SejourVue s, FraisService.FraisVue f) {
        return new SejourVue(s.sortie(), s.gere(), s.encadrant(), s.infosPratiques(), s.participants(), s.voitures(),
                s.logements(), s.affaires(), s.evenements(), f, s.avertissements(), s.groupesProposes(),
                s.organisateurs(), s.peutDesigner(), s.palanquees());
    }

    private static SejourVue avecDesignation(SejourVue s, boolean peutDesigner) {
        return new SejourVue(s.sortie(), s.gere(), s.encadrant(), s.infosPratiques(), s.participants(), s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.frais(), s.avertissements(), s.groupesProposes(),
                s.organisateurs(), peutDesigner, s.palanquees());
    }

    /** Le carnet d'un participant : ses propres données, et des autres seulement ce qui organise le séjour. */
    private static SejourVue carnet(SejourVue s) {
        List<ParticipantVue> inscrits = s.participants().stream()
                .map(p -> p.moi() ? p : new ParticipantVue(p.id(), null, null, p.nom(), p.prenom(), p.plongeur(),
                        null, null, Set.of(), null, null, null, p.arrivee(), p.depart(), null, false, null, null))
                .toList();
        return new SejourVue(s.sortie(), false, false, s.infosPratiques(), inscrits, s.voitures(),
                s.logements(), s.affaires(), s.evenements(), s.frais(), List.of(), List.of(),
                s.organisateurs(), false, s.palanquees());
    }

    // ------------------------------------------------------------------
    //  Avertissements
    // ------------------------------------------------------------------

    static List<String> avertissements(List<ParticipantVue> participants, List<Voiture> voitures,
                                       List<Logement> logements) {
        Map<Long, String> noms = participants.stream()
                .collect(Collectors.toMap(ParticipantVue::id, p -> p.prenom() + " " + p.nom()));
        List<String> resultat = new ArrayList<>();

        Map<Long, List<String>> voituresDe = new LinkedHashMap<>();
        for (Voiture v : voitures) {
            int aBord = v.passagerIds().size() + (v.conducteurId() == null ? 0 : 1);
            if (aBord > v.places()) {
                resultat.add("Voiture « " + v.nom() + " » : " + aBord + " personnes pour " + v.places() + " places.");
            }
            if (v.conducteurId() == null) {
                resultat.add("Voiture « " + v.nom() + " » : pas encore de conducteur.");
            } else {
                voituresDe.computeIfAbsent(v.conducteurId(), k -> new ArrayList<>()).add(v.nom());
            }
            v.passagerIds().forEach(p -> voituresDe.computeIfAbsent(p, k -> new ArrayList<>()).add(v.nom()));
        }
        voituresDe.forEach((p, liste) -> {
            if (liste.size() > 1) {
                resultat.add(noms.get(p) + " est dans plusieurs voitures (« " + String.join(" », « ", liste)
                        + " ») : retirez-le de l'une d'elles.");
            }
        });

        Set<Long> loges = new HashSet<>();
        for (Logement l : logements) {
            for (Chambre c : l.chambres()) {
                loges.addAll(c.occupantIds());
                if (c.occupantIds().size() > c.couchages()) {
                    resultat.add("Chambre « " + c.nom() + " » (" + l.nom() + ") : " + c.occupantIds().size()
                            + " occupants pour " + c.couchages() + " couchage" + (c.couchages() > 1 ? "s" : "") + ".");
                }
            }
        }
        if (!logements.isEmpty()) {
            List<String> sansChambre = participants.stream().filter(p -> !loges.contains(p.id()))
                    .map(p -> p.prenom() + " " + p.nom()).toList();
            if (!sansChambre.isEmpty()) {
                resultat.add("Sans chambre : " + String.join(", ", sansChambre) + ".");
            }
        }
        return resultat;
    }

    // ------------------------------------------------------------------
    //  Infos pratiques
    // ------------------------------------------------------------------

    @Transactional
    public void definirInfos(Long sortieId, String infos) {
        sorties.sortie(sortieId);
        sejours.definirInfos(sortieId, infos);
    }

    // ------------------------------------------------------------------
    //  Participants
    // ------------------------------------------------------------------

    @Transactional
    public void ajouterParticipant(Long sortieId, FicheParticipant d) {
        sorties.sortie(sortieId);
        verifier(sortieId, null, d);
        FicheParticipant complet = completerDuDossier(d);
        participants.ajouter(sortieId, complet);
        reporterSurLePlongeur(complet);
    }

    @Transactional
    public void modifierParticipant(Long sortieId, Long participantId, FicheParticipant d) {
        verifierParticipants(sortieId, List.of(participantId));
        verifier(sortieId, participantId, d);
        participants.modifier(participantId, d);
        reporterSurLePlongeur(d);
    }

    /**
     * Le participant est aussi un plongeur d'un groupe de plongeurs : nom,
     * prénom et e-mail suivent dans le groupe (l'inverse est fait par
     * {@code GroupePlongeursService}). Un e-mail vide laisse celui du groupe ;
     * celui du dossier de l'élève ou de l'encadrant vide l'e-mail du groupe,
     * qui suit alors le dossier (sinon une adresse changée plus tard dans le
     * dossier resterait l'ancienne dans le groupe).
     */
    private void reporterSurLePlongeur(FicheParticipant d) {
        if (d.membreGroupeId() == null) return;
        participants.emailsDuMembre(d.membreGroupeId()).ifPresent(membre -> {
            String email = nettoyer(d.email());
            String emailDossier = nettoyer(membre.emailDossier());
            String emailGroupe = email == null ? membre.email()
                    : email.equalsIgnoreCase(emailDossier == null ? "" : emailDossier) ? null : email;
            participants.reporterSurLeMembre(d.membreGroupeId(), d.nom().trim(), d.prenom().trim(), emailGroupe);
        });
    }

    /** Sa propre ligne, entière (il la voit et la complète lui-même). */
    @Transactional(readOnly = true)
    public ParticipantVue participant(Long participantId) {
        return ParticipantVue.de(participants.participant(participantId)
                .orElseThrow(() -> new RessourceIntrouvableException("Participant introuvable")), true);
    }

    /** Le participant complète ses informations : le reste de sa ligne ne change pas. */
    @Transactional
    public void modifierMesInformations(Long participantId, DemandeMesInformations d) {
        ParticipantVue actuel = participant(participantId);
        LocalDateTime arrivee = Trajet.moment(d.arrivee());
        LocalDateTime depart = Trajet.moment(d.depart());
        if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
            throw new RegleMetierException("Votre départ est avant votre arrivée : vérifiez les dates.");
        }
        participants.modifierInformations(participantId, new FicheParticipant(actuel.eleveId(),
                actuel.utilisateurId(), actuel.nom(), actuel.prenom(), actuel.plongeur(), d.telephone(),
                actuel.email(), d.regimes(), d.regimePrecision(), d.urgenceNom(), d.urgenceTelephone(),
                d.arrivee(), d.depart(), d.remarques(), actuel.membreGroupeId()));
    }

    /**
     * Pose ce trajet sur chacun des participants donnés (les autres ne
     * changent pas). Refus, sans rien écrire, si l'un d'eux partirait avant
     * d'arriver.
     */
    @Transactional
    public void appliquerTrajet(Long sortieId, DemandeTrajetCommun d) {
        sorties.sortie(sortieId);
        List<Long> ids = d.participantIds().stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) throw new RegleMetierException("Cochez au moins un participant.");
        verifierParticipants(sortieId, ids);
        Trajet t = d.trajet() == null || d.trajet().vide() ? null : d.trajet();
        for (Long id : ids) {
            ParticipantVue p = participant(id);
            LocalDateTime arrivee = Trajet.moment(d.sens() == SensTrajet.ARRIVEE ? t : p.arrivee());
            LocalDateTime depart = Trajet.moment(d.sens() == SensTrajet.DEPART ? t : p.depart());
            if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
                throw new RegleMetierException("Le départ de " + p.prenom() + " " + p.nom()
                        + " serait avant son arrivée : vérifiez la date.");
            }
        }
        participants.poserTrajet(sortieId, ids, d.sens(), t);
    }

    /** Il quitte aussi sa voiture et sa chambre ; une voiture qu'il conduisait n'a plus de conducteur. */
    @Transactional
    public void supprimerParticipant(Long sortieId, Long participantId) {
        verifierParticipants(sortieId, List.of(participantId));
        if (participants.lignesDeFrais(participantId) > 0) {
            throw new RegleMetierException(nomDe(participantId) + " figure dans le partage des frais : "
                    + "retirez-le d'abord des dépenses et des remboursements, sinon les comptes seraient faux.");
        }
        participants.supprimer(participantId);
    }

    /**
     * Inscrit les membres d'un groupe de plongeurs qui ne sont pas déjà du
     * séjour, chacun lié à son plongeur du groupe ; celui qui était déjà
     * inscrit sans lien y est lié s'il a les mêmes nom, prénom et e-mail
     * (sinon l'écran le signale, à lier depuis sa fiche). Renvoie le nombre
     * d'inscrits.
     */
    @Transactional
    public int importerGroupe(Long sortieId, Long groupeId) {
        sorties.sortie(sortieId);
        if (!participants.groupeExiste(groupeId)) {
            throw new RessourceIntrouvableException("Groupe de plongeurs introuvable");
        }
        int ajoutes = 0;
        for (FicheParticipant m : participants.membresDuGroupe(groupeId)) {
            if (participants.membreInscrit(sortieId, m.membreGroupeId())) continue;
            Optional<Inscrit> deja = doublon(sortieId, null, m);
            if (deja.isPresent()) {
                if (memesCoordonnees(deja.get().id(), m)) {
                    participants.lierAuMembre(deja.get().id(), m.membreGroupeId());
                }
                continue;
            }
            participants.ajouter(sortieId, completerDuDossier(m));
            ajoutes++;
        }
        return ajoutes;
    }

    private void verifier(Long sortieId, Long participantId, FicheParticipant d) {
        doublon(sortieId, participantId, d).ifPresent(deja -> {
            throw new RegleMetierException("« " + deja.nom() + " » participe déjà au séjour.");
        });
        // Le carnet et la demande d'informations partent à cette adresse, et elle passe dans le groupe de plongeurs lié.
        if (!blanc(d.email()) && !EMAIL.matcher(d.email().trim()).matches()) {
            throw new RegleMetierException("L'e-mail « " + d.email().trim() + " » n'est pas valide : vérifiez-le.");
        }
        if (d.membreGroupeId() != null) {
            verifierPlongeurDuGroupe(sortieId, participantId, d.membreGroupeId());
        }
        if (d.eleveId() != null && !participants.eleveExiste(d.eleveId())) {
            throw new RessourceIntrouvableException("Élève introuvable");
        }
        if (d.utilisateurId() != null && !participants.compteExiste(d.utilisateurId())) {
            throw new RessourceIntrouvableException("Compte introuvable");
        }
        LocalDateTime arrivee = Trajet.moment(d.arrivee());
        LocalDateTime depart = Trajet.moment(d.depart());
        if (arrivee != null && depart != null && depart.isBefore(arrivee)) {
            throw new RegleMetierException("Le départ de " + d.prenom().trim() + " " + d.nom().trim()
                    + " est avant son arrivée : vérifiez les dates.");
        }
    }

    /**
     * Le participant déjà inscrit a les mêmes nom, prénom et e-mail que le
     * plongeur du groupe (un e-mail vide d'un côté ne compte pas). Sinon on ne
     * le lie pas tout seul : le report suivant écraserait ce qui a été saisi
     * dans le séjour sans que personne l'ait vu. L'organisateur le lie depuis
     * sa fiche, où il voit les deux.
     */
    private boolean memesCoordonnees(Long participantId, FicheParticipant membre) {
        Participant p = participants.participant(participantId).orElseThrow();
        String email = p.email();
        return membre.nom().trim().equalsIgnoreCase(p.nom().trim())
                && membre.prenom().trim().equalsIgnoreCase(p.prenom().trim())
                && (blanc(email) || blanc(membre.email()) || email.trim().equalsIgnoreCase(membre.email().trim()));
    }

    /** Un plongeur d'un groupe de la saison du séjour, qui n'est pas déjà lié à un autre participant. */
    private void verifierPlongeurDuGroupe(Long sortieId, Long participantId, Long membreId) {
        if (!participants.membreDeLaSaison(membreId, sorties.lire(sortieId).dateDebut())) {
            throw new RegleMetierException("Ce plongeur n'est dans aucun groupe de plongeurs de la saison du séjour.");
        }
        List<String> autres = participants.autresLiesAuMembre(sortieId, membreId, participantId);
        if (!autres.isEmpty()) {
            throw new RegleMetierException("Ce plongeur du groupe est déjà lié à « " + autres.getFirst()
                    + " » dans ce séjour.");
        }
    }

    /** Celui qui est déjà inscrit : même dossier, même compte, ou mêmes nom et prénom. */
    private Optional<Inscrit> doublon(Long sortieId, Long participantId, FicheParticipant d) {
        return participants.doublon(sortieId, participantId, d.eleveId(), d.utilisateurId(), d.nom(), d.prenom());
    }

    /** Coordonnées et personne à prévenir reprises du dossier élève (ou l'e-mail du compte) quand elles manquent. */
    private FicheParticipant completerDuDossier(FicheParticipant d) {
        String telephone = d.telephone();
        String email = d.email();
        String urgenceNom = d.urgenceNom();
        String urgenceTelephone = d.urgenceTelephone();
        if (d.eleveId() != null) {
            var dossier = participants.dossierEleve(d.eleveId()).orElseThrow();
            if (blanc(telephone)) telephone = dossier.telephone();
            if (blanc(email)) email = dossier.email();
            if (blanc(urgenceNom) && blanc(urgenceTelephone)) {
                urgenceNom = dossier.urgenceNom();
                urgenceTelephone = dossier.urgenceTelephone();
            }
        }
        if (blanc(email) && d.utilisateurId() != null) {
            email = participants.emailDuCompte(d.utilisateurId());
        }
        return new FicheParticipant(d.eleveId(), d.utilisateurId(), d.nom(), d.prenom(), d.plongeur(), telephone,
                email, d.regimes(), d.regimePrecision(), urgenceNom, urgenceTelephone, d.arrivee(), d.depart(),
                d.remarques(), d.membreGroupeId());
    }

    // ------------------------------------------------------------------
    //  Voitures
    // ------------------------------------------------------------------

    @Transactional
    public void creerVoiture(Long sortieId, FicheVoiture d) {
        sorties.sortie(sortieId);
        voituresEtChambres.creerVoiture(sortieId, d, verifier(sortieId, null, d));
    }

    @Transactional
    public void modifierVoiture(Long sortieId, Long voitureId, FicheVoiture d) {
        voitureDe(sortieId, voitureId);
        voituresEtChambres.modifierVoiture(voitureId, d, verifier(sortieId, voitureId, d));
    }

    @Transactional
    public void supprimerVoiture(Long sortieId, Long voitureId) {
        voitureDe(sortieId, voitureId);
        voituresEtChambres.supprimerVoiture(voitureId);
    }

    /**
     * Les passagers retenus : sans doublon, et sans le conducteur, qui ne se compte pas deux fois.
     * Chacun n'est que dans une seule voiture du séjour, conducteur ou passager (choix du club,
     * 2026) : un conducteur ne peut pas être passager d'une autre voiture.
     */
    private List<Long> verifier(Long sortieId, Long voitureId, FicheVoiture d) {
        if (d.places() < 1 || d.places() > 9) {
            throw new RegleMetierException("Une voiture compte de 1 à 9 places, conducteur compris.");
        }
        List<Long> passagers = d.passagerIds() == null ? List.of() : d.passagerIds().stream()
                .filter(Objects::nonNull).distinct().filter(p -> !p.equals(d.conducteurId())).toList();
        List<Long> tous = new ArrayList<>(passagers);
        if (d.conducteurId() != null) tous.add(d.conducteurId());
        verifierParticipants(sortieId, tous);
        List<String> dejaPris = voituresEtChambres.placesEnVoiture(sortieId, voitureId, tous).stream()
                .map(p -> p.qui() + " est déjà " + p.role() + " de la voiture « " + p.voiture() + " »")
                .toList();
        if (!dejaPris.isEmpty()) {
            throw new RegleMetierException(String.join(" ; ", dejaPris)
                    + ". Une personne ne peut être que dans une seule voiture : retirez-la d'abord de l'autre.");
        }
        return passagers;
    }

    private void voitureDe(Long sortieId, Long voitureId) {
        if (!voituresEtChambres.voitureDuSejour(sortieId, voitureId)) {
            throw new RessourceIntrouvableException("Voiture introuvable");
        }
    }

    // ------------------------------------------------------------------
    //  Logements et chambres
    // ------------------------------------------------------------------

    @Transactional
    public void creerLogement(Long sortieId, FicheLogement d) {
        sorties.sortie(sortieId);
        verifier(sortieId, null, d);
        voituresEtChambres.creerLogement(sortieId, d);
    }

    /** Les chambres sont remplacées d'un bloc, avec leurs occupants. */
    @Transactional
    public void modifierLogement(Long sortieId, Long logementId, FicheLogement d) {
        logementDe(sortieId, logementId);
        verifier(sortieId, logementId, d);
        voituresEtChambres.modifierLogement(logementId, d);
    }

    @Transactional
    public void supprimerLogement(Long sortieId, Long logementId) {
        logementDe(sortieId, logementId);
        voituresEtChambres.supprimerLogement(logementId);
    }

    /** Un participant dort dans une seule chambre de tout le séjour. */
    private void verifier(Long sortieId, Long logementId, FicheLogement d) {
        List<FicheChambre> chambres = d.chambres() == null ? List.of() : d.chambres();
        Map<Long, String> place = new HashMap<>();
        for (FicheChambre c : chambres) {
            if (c.couchages() < 1 || c.couchages() > 30) {
                throw new RegleMetierException("Chambre « " + c.nom().trim() + " » : de 1 à 30 couchages.");
            }
            for (Long o : c.occupantIds() == null ? List.<Long>of() : c.occupantIds()) {
                String autre = place.put(o, c.nom().trim());
                if (autre != null && !autre.equals(c.nom().trim())) {
                    throw new RegleMetierException(nomDe(o) + " est placé dans deux chambres (« " + autre
                            + " » et « " + c.nom().trim() + " »).");
                }
            }
        }
        verifierParticipants(sortieId, new ArrayList<>(place.keySet()));
        voituresEtChambres.couchages(sortieId, logementId, place.keySet()).stream().findFirst().ifPresent(c -> {
            throw new RegleMetierException(c.prenom() + " " + c.nom() + " dort déjà dans la chambre « "
                    + c.chambre() + " » (" + c.logement() + ") : retirez-l'en d'abord.");
        });
    }

    private void logementDe(Long sortieId, Long logementId) {
        if (!voituresEtChambres.logementDuSejour(sortieId, logementId)) {
            throw new RessourceIntrouvableException("Logement introuvable");
        }
    }

    // ------------------------------------------------------------------
    //  Affaires à prévoir
    // ------------------------------------------------------------------

    /** La liste entière est remplacée, dans l'ordre donné. */
    @Transactional
    public void definirAffaires(Long sortieId, List<FicheAffaire> affaires) {
        sorties.sortie(sortieId);
        if (affaires.size() > AFFAIRES_MAX) {
            throw new RegleMetierException("La liste des affaires est limitée à " + AFFAIRES_MAX + " lignes.");
        }
        sejours.remplacerAffaires(sortieId, affaires);
    }

    // ------------------------------------------------------------------
    //  Programme
    // ------------------------------------------------------------------

    @Transactional
    public void creerEvenement(Long sortieId, FicheEvenement d) {
        verifier(sortieId, d);
        sejours.creerEvenement(sortieId, d);
    }

    @Transactional
    public void modifierEvenement(Long sortieId, Long evenementId, FicheEvenement d) {
        evenementDe(sortieId, evenementId);
        verifier(sortieId, d);
        sejours.modifierEvenement(evenementId, d);
    }

    @Transactional
    public void supprimerEvenement(Long sortieId, Long evenementId) {
        evenementDe(sortieId, evenementId);
        sejours.supprimerEvenement(evenementId);
    }

    private void verifier(Long sortieId, FicheEvenement d) {
        SortieVue s = sorties.lire(sortieId);
        if (d.jour().isBefore(s.dateDebut().minusDays(JOURS_AUTOUR_DU_PROGRAMME))
                || d.jour().isAfter(s.dateFin().plusDays(JOURS_AUTOUR_DU_PROGRAMME))) {
            throw new RegleMetierException("Le " + d.jour().format(Calendrier.DATE_FR)
                    + " est loin des dates de la sortie : vérifiez le jour.");
        }
        if (d.heureDebut() != null && d.heureFin() != null && d.heureFin().isBefore(d.heureDebut())) {
            throw new RegleMetierException("L'heure de fin est avant l'heure de début.");
        }
    }

    private void evenementDe(Long sortieId, Long evenementId) {
        if (!sejours.evenementDuSejour(sortieId, evenementId)) {
            throw new RessourceIntrouvableException("Rendez-vous introuvable");
        }
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    /** Chacun des participants donnés est bien inscrit à ce séjour. */
    void verifierParticipants(Long sortieId, Collection<Long> ids) {
        if (ids.isEmpty()) return;
        Set<Long> distincts = new HashSet<>(ids);
        if (participants.compterDuSejour(sortieId, distincts) != distincts.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
    }

    private String nomDe(Long participantId) {
        return participants.participant(participantId).map(Participant::nomComplet).orElse("Un participant");
    }
}
