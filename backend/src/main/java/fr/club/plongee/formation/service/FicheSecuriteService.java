package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.securite.domain.NiveauEncadrement;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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

    /**
     * Niveau d'encadrement minimal du directeur de plongée, quel que soit le
     * milieu (choix du club, 2026 : E3 ou E4, y compris en piscine et en
     * fosse). Règle de sécurité générale, pas du MFT d'un niveau : elle vit
     * ici plutôt que dans le référentiel.
     */
    public static final NiveauEncadrement NIVEAU_DP_MINIMUM = NiveauEncadrement.E3;

    /**
     * Un plongeur, tel que soumis par le formulaire d'établissement : voir
     * {@link MembrePalanquee}. {@code eleveId}/{@code utilisateurId} sont
     * facultatifs et mutuellement exclusifs — ils ne font que pré-remplir
     * nom/prenom/aptitude/qualificationPreparee côté formulaire, la fiche
     * garde ensuite ces valeurs comme un instantané, pas une jointure vive.
     */
    public record Plongeur(Long eleveId, Long utilisateurId, String nom, String prenom, String aptitude,
                           String aptitudeDonneeParDp, String qualificationPreparee, FonctionPalanquee fonction,
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

    /** Voir {@link #dupliquer} ; {@code palanquees} : numéros des palanquées à déplacer vers la copie. */
    public record Duplication(Long dpId, Integer ordre, String info, String infoOrigine, List<Integer> palanquees) {}

    /** La séance créée par {@link #dupliquer}, et son n° de plongée. */
    public record SeanceDupliqueeVue(Long seanceId, int ordre) {}

    public record PlongeurVue(Long eleveId, Long utilisateurId, String nom, String prenom, String aptitude,
                              String aptitudeDonneeParDp, String qualificationPreparee, String fonction,
                              String gaz, String moyenDesaturation, String observations) {}

    public record PalanqueeVue(int numero, Integer profondeurPrevue, Integer dureePrevue,
                               Integer profondeurRealisee, Integer dureeRealisee, String paliers,
                               LocalTime heureImmersion, LocalTime heureSortie,
                               List<PlongeurVue> membres) {}

    public record FicheSecuriteVue(Long id, Long dpId, String dp, String meteo, String etatMer,
                                   String visibilite, String courant, String maree,
                                   String temperatureEau, String securiteSurface,
                                   String planSecours, String observations,
                                   List<PalanqueeVue> palanquees, List<SeanceLieeVue> seancesLiees,
                                   SortieFicheVue sortie) {}

    /** La sortie (séjour) dont fait partie la séance, pour imprimer toutes ses fiches d'un coup ; null sinon. */
    public record SortieFicheVue(Long id, String nom) {}

    /** Un plongeur déjà placé sur la fiche d'une séance liée, et dans quelle palanquée. */
    public record PlongeurPlaceVue(Long eleveId, Long utilisateurId, String nom, String prenom, int palanquee) {}

    /**
     * Une séance liée (voir {@link LiaisonSeances}) et les plongeurs déjà
     * placés sur sa fiche : le formulaire les retire du groupe proposé.
     */
    public record SeanceLieeVue(Long seanceId, LocalDate date, Integer ordre, String lieu, String site,
                                boolean ficheEtablie, List<PlongeurPlaceVue> plongeursPlaces) {}

    private final FicheSecuriteRepository fiches;
    private final SeanceRepository seances;
    private final UtilisateurRepository utilisateurs;
    private final EleveRepository eleves;
    private final FicheSecuritePdfService pdfService;
    private final FicheSecuriteExcelService excelService;
    private final LiaisonSeancesRepository liaisons;
    private final SortieRepository sorties;

    public FicheSecuriteService(FicheSecuriteRepository fiches, SeanceRepository seances,
                                UtilisateurRepository utilisateurs, EleveRepository eleves,
                                FicheSecuritePdfService pdfService, FicheSecuriteExcelService excelService,
                                LiaisonSeancesRepository liaisons, SortieRepository sorties) {
        this.sorties = sorties;
        this.fiches = fiches;
        this.seances = seances;
        this.utilisateurs = utilisateurs;
        this.eleves = eleves;
        this.pdfService = pdfService;
        this.excelService = excelService;
        this.liaisons = liaisons;
    }

    /** Sans fiche, une vue vide plutôt qu'une 404 (avec ses séances liées) pour amorcer le formulaire. */
    @Transactional(readOnly = true)
    public FicheSecuriteVue consulter(Long seanceId) {
        return fiches.findBySeanceId(seanceId).map(this::vue).orElseGet(() -> new FicheSecuriteVue(
                null, null, null, null, null, null, null, null, null, null, null, null,
                List.of(), seancesLiees(seanceId), sortie(seanceId)));
    }

    private SortieFicheVue sortie(Long seanceId) {
        return sorties.contenant(List.of(seanceId)).stream().findFirst()
                .map(s -> new SortieFicheVue(s.getId(), s.getNom())).orElse(null);
    }

    /**
     * Lie la séance à une autre du même jour (deux bateaux, deux sites à la
     * même heure) qui se partagent les plongeurs d'un groupe. Si l'une des
     * deux est déjà liée à d'autres, toutes se retrouvent dans la même liaison.
     */
    @Transactional
    public FicheSecuriteVue lier(Long seanceId, Long autreSeanceId) {
        Seance seance = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable"));
        Seance autre = seances.findById(autreSeanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance à lier introuvable"));
        if (seance.getId().equals(autre.getId())) {
            throw new RegleMetierException("Une séance ne peut pas être liée à elle-même.");
        }
        if (!seance.getDateSeance().equals(autre.getDateSeance())) {
            throw new RegleMetierException("Seules deux séances du même jour peuvent être liées.");
        }

        LiaisonSeances liaison = liaisons.findBySeancesId(seanceId).orElse(null);
        LiaisonSeances liaisonAutre = liaisons.findBySeancesId(autreSeanceId).orElse(null);
        if (liaison == null && liaisonAutre == null) {
            liaison = new LiaisonSeances();
            liaison.getSeances().add(seance);
            liaison.getSeances().add(autre);
            liaisons.save(liaison);
        } else if (liaison == null) {
            liaisonAutre.getSeances().add(seance);
        } else if (liaisonAutre == null) {
            liaison.getSeances().add(autre);
        } else if (!liaison.getId().equals(liaisonAutre.getId())) {
            // Vider l'autre liaison avant d'en reprendre les séances : une séance n'est que dans une liaison.
            List<Seance> reprises = List.copyOf(liaisonAutre.getSeances());
            liaisonAutre.getSeances().clear();
            liaisons.delete(liaisonAutre);
            liaisons.flush();
            liaison.getSeances().addAll(reprises);
        }
        liaisons.flush();
        return consulter(seanceId);
    }

    /** Retire la séance de sa liaison ; une liaison qui ne garde qu'une séance disparaît. */
    @Transactional
    public FicheSecuriteVue delier(Long seanceId) {
        liaisons.findBySeancesId(seanceId).ifPresent(liaison -> {
            liaison.getSeances().removeIf(s -> s.getId().equals(seanceId));
            if (liaison.getSeances().size() < 2) {
                liaisons.delete(liaison);
            }
            liaisons.flush();
        });
        return consulter(seanceId);
    }

    /** Les autres séances de la liaison, et les plongeurs déjà placés sur leurs fiches. */
    private List<SeanceLieeVue> seancesLiees(Long seanceId) {
        return liaisons.findBySeancesId(seanceId).stream()
                .flatMap(l -> l.getSeances().stream())
                .filter(s -> !s.getId().equals(seanceId))
                .sorted(Comparator.comparing(Seance::getDateSeance)
                        .thenComparing(s -> s.getOrdre() == null ? 1 : s.getOrdre())
                        .thenComparing(Seance::getId))
                .map(s -> {
                    var fiche = fiches.findBySeanceId(s.getId());
                    List<PlongeurPlaceVue> places = fiche.stream()
                            .flatMap(f -> f.getPalanquees().stream())
                            .flatMap(p -> p.getMembres().stream().map(m -> new PlongeurPlaceVue(
                                    m.getEleve() == null ? null : m.getEleve().getId(),
                                    m.getUtilisateur() == null ? null : m.getUtilisateur().getId(),
                                    m.getNom(), m.getPrenom(), p.getNumero())))
                            .toList();
                    return new SeanceLieeVue(s.getId(), s.getDateSeance(), s.getOrdre(), s.getLieu(),
                            s.getSite(), fiche.isPresent(), places);
                })
                .toList();
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
        Utilisateur dp = directeurDePlongee(saisie.dpId());

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
                if (p.eleveId() != null && p.utilisateurId() != null) {
                    throw new RegleMetierException(
                            "Un plongeur ne peut pas être à la fois un élève et un encadrant du club.");
                }
                MembrePalanquee membre = new MembrePalanquee();
                membre.setPalanquee(palanquee);
                if (p.eleveId() != null) {
                    membre.setEleve(eleves.findById(p.eleveId())
                            .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable")));
                }
                if (p.utilisateurId() != null) {
                    membre.setUtilisateur(utilisateurs.findById(p.utilisateurId())
                            .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable")));
                }
                membre.setNom(p.nom());
                membre.setPrenom(p.prenom());
                membre.setAptitude(p.aptitude());
                membre.setAptitudeDonneeParDp(p.aptitudeDonneeParDp());
                membre.setQualificationPreparee(p.qualificationPreparee());
                membre.setFonction(p.fonction() == null ? FonctionPalanquee.PLONGEUR : p.fonction());
                membre.setGaz(p.gaz());
                membre.setMoyenDesaturation(p.moyenDesaturation());
                membre.setObservations(p.observations());
                palanquee.getMembres().add(membre);
            }
        }

        return vue(fiches.save(fiche));
    }

    /** Le DP choisi, refusé s'il n'est pas un moniteur actif d'au moins {@link #NIVEAU_DP_MINIMUM}. */
    private Utilisateur directeurDePlongee(Long dpId) {
        Utilisateur dp = utilisateurs.findById(dpId)
                .orElseThrow(() -> new RessourceIntrouvableException("Directeur de plongée introuvable"));
        if (!dp.estMoniteur()) {
            throw new RegleMetierException(
                    "Le directeur de plongée doit être un moniteur actif avec un niveau d'encadrement.");
        }
        if (!dp.getNiveauEncadrement().auMoins(NIVEAU_DP_MINIMUM)) {
            throw new RegleMetierException("Le directeur de plongée doit être au moins "
                    + NIVEAU_DP_MINIMUM + " ; " + dp.nomComplet() + " est " + dp.getNiveauEncadrement() + ".");
        }
        return dp;
    }

    /**
     * Duplique la séance le même jour (un second bateau, une seconde
     * rotation) et lie les deux : même lieu, site, milieu, profondeur et
     * séjour ; n° de plongée suivant du jour sauf choix contraire. La copie
     * reçoit sa fiche de sécurité, avec son propre DP, les conditions de
     * l'originale et les palanquées choisies, retirées de l'originale ; de
     * chaque côté les palanquées sont renumérotées à partir de 1, dans
     * l'ordre. Tout ou rien.
     */
    @Transactional
    public SeanceDupliqueeVue dupliquer(Long seanceId, Duplication demande) {
        Seance origine = seances.findById(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Séance introuvable"));
        Utilisateur dp = directeurDePlongee(demande.dpId());
        FicheSecurite ficheOrigine = fiches.findBySeanceId(seanceId).orElse(null);

        List<Palanquee> aDeplacer = new ArrayList<>();
        for (Integer numero : new LinkedHashSet<>(demande.palanquees())) {
            aDeplacer.add((ficheOrigine == null ? Stream.<Palanquee>empty() : ficheOrigine.getPalanquees().stream())
                    .filter(p -> p.getNumero() == numero).findFirst()
                    .orElseThrow(() -> new RegleMetierException(
                            "La palanquée %d n'existe pas sur cette fiche.".formatted(numero))));
        }
        aDeplacer.sort(Comparator.comparingInt(Palanquee::getNumero));

        Seance copie = new Seance();
        copie.setSaison(origine.getSaison());
        copie.setDateSeance(origine.getDateSeance());
        copie.setOrdre(demande.ordre() != null ? demande.ordre() : numeroSuivant(origine.getDateSeance()));
        copie.setMilieu(origine.getMilieu());
        copie.setLieu(origine.getLieu());
        copie.setSite(origine.getSite());
        copie.setProfondeurMax(origine.getProfondeurMax());
        copie.setCommentaire(texteOuNull(demande.info()));
        seances.save(copie);
        if (demande.infoOrigine() != null) {
            origine.setCommentaire(texteOuNull(demande.infoOrigine()));
        }
        sorties.contenant(List.of(seanceId)).forEach(s -> s.getSeances().add(copie));

        FicheSecurite fiche = new FicheSecurite();
        fiche.setSeance(copie);
        fiche.setDp(dp);
        if (ficheOrigine != null) {
            fiche.setMeteo(ficheOrigine.getMeteo());
            fiche.setEtatMer(ficheOrigine.getEtatMer());
            fiche.setVisibilite(ficheOrigine.getVisibilite());
            fiche.setCourant(ficheOrigine.getCourant());
            fiche.setMaree(ficheOrigine.getMaree());
            fiche.setTemperatureEau(ficheOrigine.getTemperatureEau());
            fiche.setSecuriteSurface(ficheOrigine.getSecuriteSurface());
            fiche.setPlanSecours(ficheOrigine.getPlanSecours());
            fiche.setObservations(ficheOrigine.getObservations());
        }
        int numero = 1;
        for (Palanquee p : aDeplacer) {
            fiche.getPalanquees().add(copier(p, fiche, numero++));
        }
        fiches.save(fiche);

        if (ficheOrigine != null && !aDeplacer.isEmpty()) {
            ficheOrigine.getPalanquees().removeAll(aDeplacer);
            List<Palanquee> restantes = ficheOrigine.getPalanquees().stream()
                    .sorted(Comparator.comparingInt(Palanquee::getNumero)).toList();
            for (int i = 0; i < restantes.size(); i++) {
                restantes.get(i).setNumero(i + 1);
            }
        }

        lier(seanceId, copie.getId());
        return new SeanceDupliqueeVue(copie.getId(), copie.getOrdre());
    }

    /** Le n° de plongée suivant le dernier de la journée. */
    private int numeroSuivant(LocalDate jour) {
        return seances.findByDateSeanceBetweenOrderByDateSeanceAscOrdreAsc(jour, jour).stream()
                .mapToInt(s -> s.getOrdre() == null ? 1 : s.getOrdre())
                .max().orElse(0) + 1;
    }

    private static String texteOuNull(String texte) {
        return texte == null || texte.isBlank() ? null : texte.trim();
    }

    /** Une palanquée recopiée sur une autre fiche : profils prévu et réalisé, et ses plongeurs. */
    private static Palanquee copier(Palanquee source, FicheSecurite fiche, int numero) {
        Palanquee p = new Palanquee();
        p.setFicheSecurite(fiche);
        p.setNumero(numero);
        p.setProfondeurPrevue(source.getProfondeurPrevue());
        p.setDureePrevue(source.getDureePrevue());
        p.setProfondeurRealisee(source.getProfondeurRealisee());
        p.setDureeRealisee(source.getDureeRealisee());
        p.setPaliers(source.getPaliers());
        p.setHeureImmersion(source.getHeureImmersion());
        p.setHeureSortie(source.getHeureSortie());
        for (MembrePalanquee m : source.getMembres()) {
            MembrePalanquee membre = new MembrePalanquee();
            membre.setPalanquee(p);
            membre.setEleve(m.getEleve());
            membre.setUtilisateur(m.getUtilisateur());
            membre.setNom(m.getNom());
            membre.setPrenom(m.getPrenom());
            membre.setAptitude(m.getAptitude());
            membre.setAptitudeDonneeParDp(m.getAptitudeDonneeParDp());
            membre.setQualificationPreparee(m.getQualificationPreparee());
            membre.setFonction(m.getFonction());
            membre.setGaz(m.getGaz());
            membre.setMoyenDesaturation(m.getMoyenDesaturation());
            membre.setObservations(m.getObservations());
            p.getMembres().add(membre);
        }
        return p;
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
        fiche.getSeance().verifierQueLaSeanceAEuLieu("saisir le profil réalisé");

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

    /**
     * Les fiches de toutes les plongées d'une sortie, dans un seul PDF, dans
     * l'ordre des plongées. Les plongées sans fiche sont sautées ; aucune
     * fiche du tout = refus explicite plutôt qu'un PDF vide.
     */
    @Transactional(readOnly = true)
    public FicheSecuritePdfService.FichePdf genererPdfSortie(Long sortieId) {
        Sortie sortie = sorties.findById(sortieId)
                .orElseThrow(() -> new RessourceIntrouvableException("Sortie introuvable"));
        List<FicheSecurite> liste = sortie.getSeances().stream()
                .sorted(Comparator.comparing(Seance::getDateSeance)
                        .thenComparing(s -> s.getOrdre() == null ? 0 : s.getOrdre())
                        .thenComparing(Seance::getId))
                .flatMap(s -> fiches.findBySeanceId(s.getId()).stream())
                .toList();
        if (liste.isEmpty()) {
            throw new RegleMetierException(
                    "Aucune fiche de sécurité n'est encore établie pour les plongées de cette sortie.");
        }
        return pdfService.genererPlusieurs(liste,
                "fiches-securite-%s.pdf".formatted(sortie.getDateDebut()));
    }

    /**
     * Les fiches de toutes les séances d'une journée (plusieurs plongées,
     * plusieurs bateaux…), dans un seul PDF, dans l'ordre des plongées. Même
     * contrat que {@link #genererPdfSortie} : séances sans fiche sautées,
     * aucune fiche du tout = refus explicite.
     */
    @Transactional(readOnly = true)
    public FicheSecuritePdfService.FichePdf genererPdfJour(LocalDate jour) {
        List<FicheSecurite> liste = seances.findByDateSeanceBetweenOrderByDateSeanceAscOrdreAsc(jour, jour).stream()
                .sorted(Comparator.comparing((Seance s) -> s.getOrdre() == null ? 0 : s.getOrdre())
                        .thenComparing(Seance::getId))
                .flatMap(s -> fiches.findBySeanceId(s.getId()).stream())
                .toList();
        if (liste.isEmpty()) {
            throw new RegleMetierException("Aucune fiche de sécurité n'est encore établie pour les séances de ce jour.");
        }
        return pdfService.genererPlusieurs(liste, "fiches-securite-%s.pdf".formatted(jour));
    }

    /** Même contrat que {@link #genererPdf} : le rendu doit rester dans la transaction. */
    @Transactional(readOnly = true)
    public FicheSecuriteExcelService.FicheExcel genererExcel(Long seanceId) {
        FicheSecurite fiche = fiches.findBySeanceId(seanceId)
                .orElseThrow(() -> new RessourceIntrouvableException("Cette séance n'a pas encore de fiche de sécurité"));
        return excelService.generer(fiche);
    }

    private FicheSecuriteVue vue(FicheSecurite f) {
        List<PalanqueeVue> palanquees = f.getPalanquees().stream()
                .sorted((a, b) -> Integer.compare(a.getNumero(), b.getNumero()))
                .map(this::vue)
                .toList();
        return new FicheSecuriteVue(f.getId(), f.getDp().getId(), f.getDp().nomComplet(),
                f.getMeteo(), f.getEtatMer(), f.getVisibilite(), f.getCourant(), f.getMaree(),
                f.getTemperatureEau(), f.getSecuriteSurface(), f.getPlanSecours(), f.getObservations(),
                palanquees, seancesLiees(f.getSeance().getId()), sortie(f.getSeance().getId()));
    }

    private PalanqueeVue vue(Palanquee p) {
        return new PalanqueeVue(p.getNumero(), p.getProfondeurPrevue(), p.getDureePrevue(),
                p.getProfondeurRealisee(), p.getDureeRealisee(), p.getPaliers(),
                p.getHeureImmersion(), p.getHeureSortie(),
                p.getMembres().stream().map(this::vue).toList());
    }

    private PlongeurVue vue(MembrePalanquee m) {
        return new PlongeurVue(
                m.getEleve() == null ? null : m.getEleve().getId(),
                m.getUtilisateur() == null ? null : m.getUtilisateur().getId(),
                m.getNom(), m.getPrenom(), m.getAptitude(), m.getAptitudeDonneeParDp(), m.getQualificationPreparee(),
                m.getFonction().name(), m.getGaz(), m.getMoyenDesaturation(), m.getObservations());
    }
}
