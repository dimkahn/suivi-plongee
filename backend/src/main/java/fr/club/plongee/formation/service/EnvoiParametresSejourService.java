package fr.club.plongee.formation.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.FicheSecuriteRepository;
import fr.club.plongee.formation.repository.GroupePlongeursRepository;
import fr.club.plongee.formation.repository.SortieRepository;
import fr.club.plongee.notification.service.ServiceNotification;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;

/**
 * En fin de séjour, envoie à chaque plongeur d'un {@link GroupePlongeurs}
 * les paramètres des plongées de la sortie où il figure, et seulement
 * celles-là : date, site, profondeur, durée, heures, paliers et les autres
 * membres de sa palanquée, lus sur les fiches de sécurité.
 *
 * <p>Un plongeur du groupe est retrouvé dans une palanquée par son dossier
 * (élève ou encadrant), sinon par ses nom et prénom (invité saisi à la main).
 * Rien n'est mémorisé de l'envoi : le refaire renvoie les mêmes courriels.
 */
@Service
public class EnvoiParametresSejourService {

    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH:mm");

    /** Ce qui est parti, et pour qui rien n'est parti (pour que le moniteur complète). */
    public record BilanEnvoi(List<DestinataireVue> envoyes, List<String> sansEmail,
                             List<String> sansPlongee, List<String> echecs) {}

    public record DestinataireVue(String nom, String email, int nombrePlongees) {}

    /** Un courriel prêt à partir. */
    public record Courriel(String adresse, String sujet, String corps) {}

    private final GroupePlongeursRepository groupes;
    private final SortieRepository sorties;
    private final FicheSecuriteRepository fiches;
    private final ServiceNotification notification;
    private final String nomClub;

    public EnvoiParametresSejourService(GroupePlongeursRepository groupes, SortieRepository sorties,
                                        FicheSecuriteRepository fiches, ServiceNotification notification,
                                        @Value("${app.club.nom}") String nomClub) {
        this.groupes = groupes;
        this.sorties = sorties;
        this.fiches = fiches;
        this.notification = notification;
        this.nomClub = nomClub;
    }

    @Transactional(readOnly = true)
    public BilanEnvoi envoyer(Long groupeId, Long sortieId) {
        GroupePlongeurs groupe = groupes.findById(groupeId)
                .orElseThrow(() -> new RessourceIntrouvableException("Groupe de plongeurs introuvable"));
        Sortie sortie = sorties.findById(sortieId)
                .orElseThrow(() -> new RessourceIntrouvableException("Sortie introuvable"));

        List<FicheSecurite> fichesSortie = sortie.getSeances().stream()
                .sorted(Comparator.comparing(Seance::getDateSeance)
                        .thenComparing(s -> s.getOrdre() == null ? 0 : s.getOrdre())
                        .thenComparing(Seance::getId))
                .flatMap(s -> fiches.findBySeanceId(s.getId()).stream())
                .toList();
        if (fichesSortie.isEmpty()) {
            throw new RegleMetierException("Aucune fiche de sécurité n'est établie pour les plongées de « "
                    + sortie.getNom() + " » : rien à envoyer.");
        }

        List<DestinataireVue> envoyes = new ArrayList<>();
        List<String> sansEmail = new ArrayList<>();
        List<String> sansPlongee = new ArrayList<>();
        List<String> echecs = new ArrayList<>();
        for (MembreGroupePlongeurs membre : groupe.getMembres()) {
            String nom = membre.getPrenom() + " " + membre.getNom();
            Optional<Courriel> courriel = composer(membre, sortie, fichesSortie);
            if (courriel.isEmpty()) {
                sansPlongee.add(nom);
                continue;
            }
            String adresse = membre.emailEffectif();
            if (adresse == null) {
                sansEmail.add(nom);
                continue;
            }
            Courriel c = courriel.get();
            if (notification.envoyerCourriel(adresse, c.sujet(), c.corps())) {
                envoyes.add(new DestinataireVue(nom, adresse, nombrePlongees(membre, fichesSortie)));
            } else {
                echecs.add(nom);
            }
        }
        return new BilanEnvoi(envoyes, sansEmail, sansPlongee, echecs);
    }

    /** Le courriel d'un plongeur, vide s'il ne figure dans aucune palanquée de la sortie. */
    public Optional<Courriel> composer(MembreGroupePlongeurs membre, Sortie sortie, List<FicheSecurite> fichesSortie) {
        StringBuilder corps = new StringBuilder();
        int nombre = 0;
        for (FicheSecurite fiche : fichesSortie) {
            for (Palanquee p : palanqueesTriees(fiche)) {
                if (p.getMembres().stream().noneMatch(m -> correspond(membre, m))) continue;
                nombre++;
                corps.append("\n").append(plongee(fiche.getSeance(), p, membre));
            }
        }
        if (nombre == 0) return Optional.empty();

        String entete = "Bonjour " + membre.getPrenom() + ",\n\n"
                + "Voici les paramètres de vos plongées lors de « " + sortie.getNom() + " »"
                + (sortie.getLieu() == null ? "" : " (" + sortie.getLieu() + ")")
                + ", relevés sur les fiches de sécurité, pour votre carnet de plongée.\n";
        String pied = "\nBonnes bulles,\n" + nomClub + "\n";
        return Optional.of(new Courriel(membre.emailEffectif(),
                "Vos plongées — " + sortie.getNom(), entete + corps + pied));
    }

    private int nombrePlongees(MembreGroupePlongeurs membre, List<FicheSecurite> fichesSortie) {
        int n = 0;
        for (FicheSecurite f : fichesSortie) {
            for (Palanquee p : f.getPalanquees()) {
                if (p.getMembres().stream().anyMatch(m -> correspond(membre, m))) n++;
            }
        }
        return n;
    }

    private List<Palanquee> palanqueesTriees(FicheSecurite fiche) {
        return fiche.getPalanquees().stream().sorted(Comparator.comparingInt(Palanquee::getNumero)).toList();
    }

    private String plongee(Seance s, Palanquee p, MembreGroupePlongeurs membre) {
        StringBuilder texte = new StringBuilder();
        String jour = s.getDateSeance().getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.FRENCH);
        texte.append("— ").append(majuscule(jour)).append(" ").append(s.getDateSeance().format(Calendrier.DATE_FR));
        if (s.getOrdre() != null) texte.append(", plongée n° ").append(s.getOrdre());
        texte.append("\n");

        String lieu = s.getLieu() == null ? "" : s.getLieu();
        if (s.getSite() != null && !s.getSite().isBlank()) lieu += (lieu.isEmpty() ? "" : " — ") + s.getSite();
        if (!lieu.isEmpty()) texte.append("  Site : ").append(lieu).append("\n");

        boolean realise = p.getProfondeurRealisee() != null || p.getDureeRealisee() != null;
        Integer profondeur = realise ? p.getProfondeurRealisee() : p.getProfondeurPrevue();
        Integer duree = realise ? p.getDureeRealisee() : p.getDureePrevue();
        String suffixe = realise ? "" : " (prévue)";
        if (profondeur != null) texte.append("  Profondeur : ").append(profondeur).append(" m").append(suffixe).append("\n");
        if (duree != null) texte.append("  Durée : ").append(duree).append(" min").append(suffixe).append("\n");
        if (p.getHeureImmersion() != null || p.getHeureSortie() != null) {
            texte.append("  Immersion : ").append(heure(p.getHeureImmersion()))
                    .append(" — sortie : ").append(heure(p.getHeureSortie())).append("\n");
        }
        if (p.getPaliers() != null && !p.getPaliers().isBlank()) {
            texte.append("  Paliers : ").append(p.getPaliers()).append("\n");
        }

        List<String> autres = p.getMembres().stream()
                .filter(m -> !correspond(membre, m))
                .map(this::coequipier)
                .toList();
        texte.append("  Palanquée n° ").append(p.getNumero()).append(" : ")
                .append(autres.isEmpty() ? "seul(e) inscrit(e)" : "avec " + String.join(", ", autres))
                .append("\n");
        return texte.toString();
    }

    private String coequipier(MembrePalanquee m) {
        String nom = m.getPrenom() + " " + m.getNom();
        List<String> precisions = new ArrayList<>();
        if (m.getAptitude() != null && !m.getAptitude().isBlank()) precisions.add(m.getAptitude());
        if (m.getFonction() == FonctionPalanquee.GUIDE_PALANQUEE) precisions.add("guide de palanquée");
        if (m.getFonction() == FonctionPalanquee.ENCADRANT) precisions.add("encadrant");
        return precisions.isEmpty() ? nom : nom + " (" + String.join(", ", precisions) + ")";
    }

    /** Même dossier (élève ou encadrant), sinon mêmes nom et prénom, sans tenir compte des accents ni de la casse. */
    static boolean correspond(MembreGroupePlongeurs g, MembrePalanquee m) {
        if (g.getEleve() != null && m.getEleve() != null) return g.getEleve().getId().equals(m.getEleve().getId());
        if (g.getUtilisateur() != null && m.getUtilisateur() != null) {
            return g.getUtilisateur().getId().equals(m.getUtilisateur().getId());
        }
        return normaliser(g.getNom()).equals(normaliser(m.getNom()))
                && normaliser(g.getPrenom()).equals(normaliser(m.getPrenom()));
    }

    private static String normaliser(String texte) {
        if (texte == null) return "";
        return Normalizer.normalize(texte, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).trim();
    }

    private static String heure(LocalTime t) {
        return t == null ? "?" : t.format(HEURE);
    }

    private static String majuscule(String texte) {
        return texte.isEmpty() ? texte : Character.toUpperCase(texte.charAt(0)) + texte.substring(1);
    }
}
