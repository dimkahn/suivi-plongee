package fr.club.plongee.sejour.application;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.notification.service.ServiceNotification;
import fr.club.plongee.sejour.domaine.Textes;
import fr.club.plongee.sejour.domaine.port.AccesParLien;
import fr.club.plongee.sejour.domaine.port.AccesParLien.CodeEnBase;
import fr.club.plongee.sejour.domaine.port.AccesParLien.Destinataire;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Le séjour par un lien et un code reçu par e-mail (V77), pour tout
 * participant qui n'est pas encadrant (moniteur, admin, directeur
 * technique) : élève, invité, conjoint... qu'il ait un compte ou non. Il y
 * renseigne ses informations (voyage, repas, personne à prévenir) et
 * y voit et saisit les frais.
 * <p>
 * L'organisateur envoie la demande d'informations à chacun
 * ({@link #envoyerInvitations}) : l'encadrant reçoit l'adresse du séjour
 * dans l'appli, où il est connecté ; les autres l'adresse
 * {@code /sejour/{code}} ({@code sejour.code_frais}, secret, tiré au
 * hasard). Sur cette page on donne son e-mail et reçoit un code à usage
 * unique de 6 chiffres (10 minutes, 5 essais, un envoi par minute au
 * plus) ; le bon code ouvre un jeton, gardé par son navigateur, valable
 * jusqu'à 60 jours après la fin du séjour. En base, ni code ni jeton en
 * clair : leur empreinte SHA-256 seulement.
 * <p>
 * Les droits sur les frais sont ceux de {@link FraisService} (un élève
 * consulte seulement) ; ses informations, chacun les modifie. La réponse à
 * une demande de code est la même que l'e-mail soit connu ou non : la page
 * ne dit pas qui participe.
 */
@Service
public class AccesSejourService {

    static final int MINUTES_VALIDITE_CODE = 10;
    static final int ESSAIS_MAX = 5;
    static final int SECONDES_ENTRE_DEUX_ENVOIS = 60;
    static final int JOURS_APRES_LE_SEJOUR = 60;

    /** L'en-tête de la page publique : de quel séjour il s'agit. */
    public record EnteteVue(String nom, String lieu, LocalDate dateDebut, LocalDate dateFin) {}

    public record Connexion(String jeton, Long participantId, String prenom, String nom) {}

    public record ParticipantCourtVue(Long id, String prenom, String nom) {}

    /** Les frais vus par un participant entré par le lien. */
    public record FraisPublicVue(EnteteVue sejour, ParticipantCourtVue moi, List<ParticipantCourtVue> participants,
                                 FraisService.FraisVue frais) {}

    public record BilanEnvoiAcces(List<String> envoyes, List<String> sansEmail, List<String> echecs) {}

    /**
     * Ce que le participant entré par le lien renseigne lui-même, le séjour
     * dont il s'agit, et son programme (encart « Aujourd'hui »).
     */
    public record MesInformationsVue(EnteteVue sejour, SejourService.ParticipantVue moi,
                                     SejourService.ProgrammeVue programme) {}

    public record Acces(Long sortieId, Long participantId) {}

    private final AccesParLien acces;
    private final ParticipantsSejour participants;
    private final FraisService frais;
    private final SejourService sejours;
    private final ServiceNotification notification;
    private final IdentiteStructureService identite;
    private final String urlFrontend;
    private final SecureRandom hasard = new SecureRandom();

    public AccesSejourService(AccesParLien acces, ParticipantsSejour participants, FraisService frais,
                              SejourService sejours, ServiceNotification notification,
                              IdentiteStructureService identite, @Value("${app.frontend-url}") String urlFrontend) {
        this.acces = acces;
        this.participants = participants;
        this.frais = frais;
        this.sejours = sejours;
        this.notification = notification;
        this.identite = identite;
        this.urlFrontend = urlFrontend;
    }

    // ------------------------------------------------------------------
    //  Côté organisateur
    // ------------------------------------------------------------------

    /**
     * Demande à chaque participant qui a un e-mail de renseigner ses
     * informations pour le séjour et lui donne accès aux frais
     * ({@code participantIds} null : à tous ; sinon aux seuls participants
     * choisis, pour relancer ceux qui ne l'ont pas reçu). L'encadrant reçoit
     * le lien du séjour dans l'appli ; les autres le lien et la façon
     * d'entrer par code.
     */
    @Transactional
    public BilanEnvoiAcces envoyerInvitations(Long sortieId, Collection<Long> participantIds) {
        Set<Long> choisis = participantIds == null ? null : new HashSet<>(participantIds);
        if (choisis != null && choisis.isEmpty()) {
            throw new RegleMetierException("Choisissez au moins un participant.");
        }
        String code = codeFrais(sortieId);
        EnteteVue sejour = entete(code);
        List<Destinataire> destinataires = acces.destinataires(sortieId, choisis);
        if (choisis != null && destinataires.size() < choisis.size()) {
            throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
        List<String> envoyes = new ArrayList<>(), sansEmail = new ArrayList<>(), echecs = new ArrayList<>();
        for (Destinataire d : destinataires) {
            String nom = d.prenom() + " " + d.nom();
            String email = d.email();
            if (Textes.blanc(email)) {
                sansEmail.add(nom);
                continue;
            }
            String debut = "Bonjour " + d.prenom() + ",\n\n"
                    + "Pour préparer le séjour « " + sejour.nom() + " » (" + periode(sejour) + "), merci de "
                    + "renseigner vos informations : votre arrivée et votre départ (avec le numéro de vol ou de "
                    + "train), votre téléphone, vos repas (régime alimentaire) et la personne à prévenir en cas "
                    + "d'urgence. Vous y trouverez aussi les frais partagés du séjour : notez-y ce que vous payez, "
                    + "avec la photo de la note ; et déclarez-y le matériel du club que vous empruntez.\n\n";
            String corps = d.encadrant()
                    ? debut + "Dans l'appli, menu « Séjours », puis « Modifier mes informations » :\n"
                            + urlFrontend + "/sejours/" + sortieId + "\n\n"
                    : debut + urlFrontend + "/sejour/" + code + "\n\n"
                            + "Donnez-y cette adresse e-mail (" + email.trim() + ") : vous recevrez un code à "
                            + "6 chiffres pour entrer. Pas de compte ni de mot de passe à créer.\n\n";
            corps += "Bon séjour,\n" + identite.nom() + "\n";
            if (notification.envoyerCourriel(email.trim(), "Vos informations pour le séjour — " + sejour.nom(), corps)) {
                envoyes.add(nom);
            } else {
                echecs.add(nom);
            }
        }
        return new BilanEnvoiAcces(envoyes, sansEmail, echecs);
    }

    private static String periode(EnteteVue s) {
        return s.dateFin() == null || s.dateFin().equals(s.dateDebut())
                ? "le " + s.dateDebut().format(Calendrier.DATE_FR)
                : "du " + s.dateDebut().format(Calendrier.DATE_FR) + " au " + s.dateFin().format(Calendrier.DATE_FR);
    }

    /** Le code secret de l'adresse des frais, tiré au premier besoin. */
    @Transactional
    public String codeFrais(Long sortieId) {
        if (!acces.sortieExiste(sortieId)) throw new RessourceIntrouvableException("Sortie introuvable");
        return acces.codeFrais(sortieId).orElseGet(() -> {
            String code = aleatoire(24);
            acces.poserCodeFrais(sortieId, code);
            return code;
        });
    }

    // ------------------------------------------------------------------
    //  Côté participant, sans compte
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public EnteteVue entete(String code) {
        return acces.entete(code)
                .map(e -> new EnteteVue(e.nom(), e.lieu(), e.dateDebut(), e.dateFin()))
                .orElseThrow(() -> new RessourceIntrouvableException("Adresse inconnue : demandez-la à l'organisateur."));
    }

    /** Envoie un code à 6 chiffres si l'e-mail est celui d'un participant sans compte ; sinon, rien, sans le dire. */
    @Transactional
    public void demanderCode(String code, String email) {
        EnteteVue sejour = entete(code);
        Optional<Long> participant = participantPourLien(code, email);
        if (participant.isEmpty()) return;
        if (acces.codeEnvoyeDepuis(participant.get(), maintenant().minusSeconds(SECONDES_ENTRE_DEUX_ENVOIS))) {
            return;
        }
        String chiffres = String.format("%06d", hasard.nextInt(1_000_000));
        acces.remplacerCode(participant.get(), empreinte(chiffres),
                maintenant().plusMinutes(MINUTES_VALIDITE_CODE), maintenant());
        // À l'adresse enregistrée pour le participant, pas à celle tapée sur la page.
        String adresse = acces.email(participant.get());
        notification.envoyerCourriel(adresse.trim(), "Votre code — séjour " + sejour.nom(),
                "Votre code pour entrer dans le séjour « " + sejour.nom() + " » : " + chiffres + "\n\n"
                        + "Il est valable " + MINUTES_VALIDITE_CODE + " minutes. Si vous n'avez rien demandé, "
                        + "ignorez ce message.\n\n" + identite.nom() + "\n");
    }

    /** Le bon code ouvre un jeton ; un mauvais compte un essai. */
    @Transactional(noRollbackFor = RegleMetierException.class)
    public Connexion connecter(String code, String email, String saisie) {
        EnteteVue sejour = entete(code);
        Long participant = participantPourLien(code, email)
                .orElseThrow(() -> new RegleMetierException("Code incorrect ou expiré : demandez-en un nouveau."));
        List<CodeEnBase> codes = acces.codes(participant);
        if (codes.isEmpty()) throw new RegleMetierException("Code incorrect ou expiré : demandez-en un nouveau.");
        CodeEnBase c = codes.getFirst();
        if (c.expire().isBefore(maintenant()) || c.essais() >= ESSAIS_MAX) {
            throw new RegleMetierException("Code expiré ou trop d'essais : demandez-en un nouveau.");
        }
        String propre = saisie == null ? "" : saisie.replaceAll("\\s", "");
        if (!MessageDigest.isEqual(empreinte(propre).getBytes(StandardCharsets.US_ASCII),
                c.empreinte().getBytes(StandardCharsets.US_ASCII))) {
            acces.compterEssai(c.id());
            throw new RegleMetierException("Code incorrect" + (c.essais() + 1 >= ESSAIS_MAX
                    ? " : demandez-en un nouveau." : " : vérifiez les 6 chiffres reçus par e-mail."));
        }
        acces.effacerCodes(participant);
        String jeton = aleatoire(32);
        LocalDateTime fin = sejour.dateFin().plusDays(JOURS_APRES_LE_SEJOUR).atTime(23, 59);
        if (fin.isBefore(maintenant().plusDays(1))) fin = maintenant().plusDays(1);
        acces.creerJeton(participant, empreinte(jeton), fin, maintenant());
        var p = participants.participant(participant).orElseThrow();
        return new Connexion(jeton, participant, p.prenom(), p.nom());
    }

    @Transactional
    public void deconnecter(String jeton) {
        if (jeton == null) return;
        acces.effacerJeton(empreinte(jeton));
    }

    /** Le séjour et le participant d'un jeton valable pour cette adresse ; refus sinon. */
    @Transactional(readOnly = true)
    public Acces acces(String code, String jeton) {
        if (jeton == null || jeton.isBlank()) throw new AccessDeniedException("Connexion nécessaire");
        return acces.acces(code, empreinte(jeton), maintenant())
                .map(a -> new Acces(a.sortieId(), a.participantId()))
                .orElseThrow(() -> new AccessDeniedException("Connexion expirée"));
    }

    @Transactional(readOnly = true)
    public FraisPublicVue vue(String code, Acces a) {
        List<ParticipantCourtVue> inscrits = acces.participantsCourts(a.sortieId()).stream()
                .map(p -> new ParticipantCourtVue(p.id(), p.prenom(), p.nom())).toList();
        ParticipantCourtVue moi = inscrits.stream().filter(p -> p.id().equals(a.participantId())).findFirst()
                .orElseThrow(() -> new AccessDeniedException("Connexion expirée"));
        return new FraisPublicVue(entete(code), moi, inscrits,
                frais.lire(a.sortieId(), frais.acteurParticipant(a.participantId())));
    }

    @Transactional(readOnly = true)
    public MesInformationsVue mesInformations(String code, Acces a) {
        return new MesInformationsVue(entete(code), sejours.participant(a.participantId()),
                sejours.programme(a.sortieId(), a.participantId()));
    }

    /** Tout le séjour vu par ce participant : son carnet, sans les coordonnées ni les régimes des autres. */
    @Transactional(readOnly = true)
    public SejourService.SejourVue carnet(Acces a) {
        return sejours.carnetDuParticipant(a.sortieId(), a.participantId());
    }

    @Transactional
    public MesInformationsVue modifierMesInformations(String code, Acces a, SejourService.DemandeMesInformations d) {
        sejours.modifierMesInformations(a.participantId(), d);
        return mesInformations(code, a);
    }

    // ------------------------------------------------------------------
    //  Outils
    // ------------------------------------------------------------------

    /** Le participant de cet e-mail, s'il peut entrer par le lien : tout participant qui n'est pas encadrant. */
    private Optional<Long> participantPourLien(String code, String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        return acces.participantPourLien(code, email.trim().toLowerCase(Locale.ROOT));
    }

    private String aleatoire(int octets) {
        byte[] b = new byte[octets];
        hasard.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static String empreinte(String texte) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(texte.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static LocalDateTime maintenant() {
        return LocalDateTime.now(Calendrier.ZONE_CLUB);
    }
}
