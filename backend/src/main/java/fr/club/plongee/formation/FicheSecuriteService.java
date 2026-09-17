package fr.club.plongee.formation;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.securite.Utilisateur;
import fr.club.plongee.securite.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Toute lecture ou écriture d'une {@link FicheSecurite} passe par ici, y
 * compris l'assemblage des vues et la génération du PDF : {@code dp},
 * {@code seance}, {@code palanquees} et {@code membres} sont chargés à la
 * demande (lazy), donc à parcourir uniquement pendant que la transaction est
 * ouverte. Le contrôleur ne reçoit que des DTO déjà entièrement assemblés,
 * jamais l'entité elle-même.
 */
@Service
public class FicheSecuriteService {

    /** Un plongeur, tel que soumis par le formulaire d'établissement : voir {@link MembrePalanquee}. */
    public record Plongeur(String nom, String prenom, String aptitude, FonctionPalanquee fonction,
                           String gaz, String moyenDesaturation, String observations) {}

    /** Une palanquée à l'établissement : numéro, profil prévu et sa liste de plongeurs. */
    public record GroupePlongeurs(int numero, Integer profondeurPrevue, Integer dureePrevue,
                                  List<Plongeur> membres) {}

    public record Saisie(Long dpId, String meteo, String etatMer, String visibilite, String courant,
                         String maree, String temperatureEau, String securiteSurface,
                         String planSecours, String observations, List<GroupePlongeurs> palanquees) {}

    /** Le profil réellement plongé par une palanquée, saisi après le retour. */
    public record ProfilRealise(int numero, Integer profondeurRealisee, Integer dureeRealisee,
                                String paliers, LocalTime heureImmersion, LocalTime heureSortie) {}

    public record PlongeurVue(String nom, String prenom, String aptitude, String fonction,
                              String gaz, String moyenDesaturation, String observations) {}

    public record PalanqueeVue(int numero, Integer profondeurPrevue, Integer dureePrevue,
                               Integer profondeurRealisee, Integer dureeRealisee, String paliers,
                               LocalTime heureImmersion, LocalTime heureSortie,
                               List<PlongeurVue> membres) {}

    public record FicheSecuriteVue(Long id, Long dpId, String dp, String meteo, String etatMer,
                                   String visibilite, String courant, String maree,
                                   String temperatureEau, String securiteSurface,
                                   String planSecours, String observations,
                                   List<PalanqueeVue> palanquees) {}

    private static final FicheSecuriteVue VUE_VIDE = new FicheSecuriteVue(null, null, null, null,
            null, null, null, null, null, null, null, null, List.of());

    private final FicheSecuriteRepository fiches;
    private final SeanceRepository seances;
    private final UtilisateurRepository utilisateurs;
    private final FicheSecuritePdfService pdfService;

    public FicheSecuriteService(FicheSecuriteRepository fiches, SeanceRepository seances,
                                UtilisateurRepository utilisateurs, FicheSecuritePdfService pdfService) {
        this.fiches = fiches;
        this.seances = seances;
        this.utilisateurs = utilisateurs;
        this.pdfService = pdfService;
    }

    @Transactional(readOnly = true)
    public FicheSecuriteVue consulter(Long seanceId) {
        return fiches.findBySeanceId(seanceId).map(this::vue).orElse(VUE_VIDE);
    }

    /**
     * Établit ou modifie la fiche : DP, conditions et, pour chaque palanquée,
     * son profil prévu et la liste de ses plongeurs. Les palanquées sont
     * réconciliées par numéro plutôt que remplacées en bloc, pour ne pas
     * effacer un profil déjà réalisé (voir {@link #enregistrerRealise}) si le
     * DP retouche la fiche après la plongée.
     */
    @Transactional
    public FicheSecuriteVue enregistrer(Long seanceId, Saisie saisie) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable"));
        Utilisateur dp = utilisateurs.findById(saisie.dpId())
                .orElseThrow(() -> new RessourceIntrouvableException("Directeur de plongée introuvable"));
        if (!dp.estMoniteur()) {
            throw new RegleMetierException(
                    "Le directeur de plongée doit être un moniteur actif avec un niveau d'encadrement.");
        }

        FicheSecurite fiche = fiches.findBySeanceId(seanceId).orElseGet(() -> {
            FicheSecurite f = new FicheSecurite();
            f.setSeance(seance);
            return f;
        });
        fiche.setDp(dp);
        fiche.setMeteo(saisie.meteo());
        fiche.setEtatMer(saisie.etatMer());
        fiche.setVisibilite(saisie.visibilite());
        fiche.setCourant(saisie.courant());
        fiche.setMaree(saisie.maree());
        fiche.setTemperatureEau(saisie.temperatureEau());
        fiche.setSecuriteSurface(saisie.securiteSurface());
        fiche.setPlanSecours(saisie.planSecours());
        fiche.setObservations(saisie.observations());

        Map<Integer, Palanquee> existantes = fiche.getPalanquees().stream()
                .collect(Collectors.toMap(Palanquee::getNumero, Function.identity()));

        fiche.getPalanquees().removeIf(p -> saisie.palanquees().stream().noneMatch(g -> g.numero() == p.getNumero()));

        for (GroupePlongeurs g : saisie.palanquees()) {
            Palanquee palanquee = existantes.get(g.numero());
            if (palanquee == null) {
                palanquee = new Palanquee();
                palanquee.setFicheSecurite(fiche);
                palanquee.setNumero(g.numero());
                fiche.getPalanquees().add(palanquee);
            }
            palanquee.setProfondeurPrevue(g.profondeurPrevue());
            palanquee.setDureePrevue(g.dureePrevue());

            palanquee.getMembres().clear();
            for (Plongeur p : g.membres()) {
                MembrePalanquee membre = new MembrePalanquee();
                membre.setPalanquee(palanquee);
                membre.setNom(p.nom());
                membre.setPrenom(p.prenom());
                membre.setAptitude(p.aptitude());
                membre.setFonction(p.fonction() == null ? FonctionPalanquee.PLONGEUR : p.fonction());
                membre.setGaz(p.gaz());
                membre.setMoyenDesaturation(p.moyenDesaturation());
                membre.setObservations(p.observations());
                palanquee.getMembres().add(membre);
            }
        }

        return vue(fiches.save(fiche));
    }

    /**
     * Complète, palanquée par palanquée, le profil réellement plongé : saisi
     * au retour, sans repasser par la liste des plongeurs ni les conditions.
     */
    @Transactional
    public FicheSecuriteVue enregistrerRealise(Long seanceId, List<ProfilRealise> profils) {
        FicheSecurite fiche = fiches.findBySeanceId(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Cette séance n'a pas encore de fiche de sécurité établie"));

        Map<Integer, Palanquee> parNumero = fiche.getPalanquees().stream()
                .collect(Collectors.toMap(Palanquee::getNumero, Function.identity()));

        for (ProfilRealise p : profils) {
            Palanquee palanquee = parNumero.get(p.numero());
            if (palanquee == null) {
                throw new RegleMetierException(
                        "La palanquée %d n'existe pas sur cette fiche.".formatted(p.numero()));
            }
            palanquee.setProfondeurRealisee(p.profondeurRealisee());
            palanquee.setDureeRealisee(p.dureeRealisee());
            palanquee.setPaliers(p.paliers());
            palanquee.setHeureImmersion(p.heureImmersion());
            palanquee.setHeureSortie(p.heureSortie());
        }

        return vue(fiches.save(fiche));
    }

    @Transactional
    public void supprimer(Long seanceId) {
        FicheSecurite fiche = fiches.findBySeanceId(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Fiche de sécurité introuvable"));
        fiches.delete(fiche);
    }

    /** Le rendu PDF doit rester dans la transaction : il parcourt dp, seance, palanquees et membres. */
    @Transactional(readOnly = true)
    public FicheSecuritePdfService.FichePdf genererPdf(Long seanceId) {
        FicheSecurite fiche = fiches.findBySeanceId(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cette séance n'a pas encore de fiche de sécurité"));
        return pdfService.generer(fiche);
    }

    private FicheSecuriteVue vue(FicheSecurite f) {
        List<PalanqueeVue> palanquees = f.getPalanquees().stream()
                .sorted((a, b) -> Integer.compare(a.getNumero(), b.getNumero()))
                .map(this::vue)
                .toList();
        return new FicheSecuriteVue(f.getId(), f.getDp().getId(), f.getDp().nomComplet(),
                f.getMeteo(), f.getEtatMer(), f.getVisibilite(), f.getCourant(), f.getMaree(),
                f.getTemperatureEau(), f.getSecuriteSurface(), f.getPlanSecours(), f.getObservations(),
                palanquees);
    }

    private PalanqueeVue vue(Palanquee p) {
        return new PalanqueeVue(p.getNumero(), p.getProfondeurPrevue(), p.getDureePrevue(),
                p.getProfondeurRealisee(), p.getDureeRealisee(), p.getPaliers(),
                p.getHeureImmersion(), p.getHeureSortie(),
                p.getMembres().stream().map(this::vue).toList());
    }

    private PlongeurVue vue(MembrePalanquee m) {
        return new PlongeurVue(m.getNom(), m.getPrenom(), m.getAptitude(), m.getFonction().name(),
                m.getGaz(), m.getMoyenDesaturation(), m.getObservations());
    }
}
