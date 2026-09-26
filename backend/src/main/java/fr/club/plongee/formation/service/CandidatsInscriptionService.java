package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.AdhesionSaison;
import fr.club.plongee.formation.domain.Cursus;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.repository.AdhesionSaisonRepository;
import fr.club.plongee.formation.repository.CursusRepository;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.formation.repository.SaisonRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Élèves proposés à l'inscription sur une saison, avec de quoi choisir le
 * bon niveau sans ouvrir leur dossier : niveau actuel, saisons déjà passées
 * au club, inscriptions déjà faites sur cette saison, niveau suggéré.
 *
 * Niveau actuel : même règle que {@link PlongeurConnuService} — dernier
 * brevet délivré dans l'application, à défaut le niveau déclaratif de la
 * fiche élève (brevet obtenu ailleurs ou avant l'outil).
 */
@Service
public class CandidatsInscriptionService {

    /**
     * @param niveauActuel       null : aucun brevet connu (débutant)
     * @param niveauDeclare      true si le niveau actuel vient de la fiche élève, pas d'un brevet délivré ici
     * @param saisonsPrecedentes saisons antérieures à celle choisie avec un cursus ou une adhésion (0 = première saison)
     * @param derniereSaison     libellé de la plus récente d'entre elles, null si aucune
     * @param inscriptionsSaison niveaux déjà ouverts pour l'élève sur la saison choisie
     * @param niveauPropose      suggestion pour l'inscription ; null si rien à proposer (N3 acquis, niveau déclaré inconnu)
     * @param motifProposition   pourquoi ce niveau, en une phrase pour l'écran
     */
    public record CandidatVue(Long eleveId, String nom, String prenom, String niveauActuel, boolean niveauDeclare,
                              int saisonsPrecedentes, String derniereSaison, List<String> inscriptionsSaison,
                              boolean adhesionSaison, String niveauPropose, String motifProposition) {}

    private static final List<String> NIVEAUX = List.of("N1", "N2", "N3");

    private final EleveRepository eleves;
    private final CursusRepository cursus;
    private final AdhesionSaisonRepository adhesions;
    private final SaisonRepository saisons;

    public CandidatsInscriptionService(EleveRepository eleves, CursusRepository cursus,
                                       AdhesionSaisonRepository adhesions, SaisonRepository saisons) {
        this.eleves = eleves;
        this.cursus = cursus;
        this.adhesions = adhesions;
        this.saisons = saisons;
    }

    @Transactional(readOnly = true)
    public List<CandidatVue> candidats(Long saisonId) {
        Saison saison = saisonId != null
                ? saisons.findById(saisonId).orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"))
                : saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                    .orElseThrow(() -> new RessourceIntrouvableException("Aucune saison ouverte"));

        Map<Long, List<Cursus>> cursusParEleve = new HashMap<>();
        for (Cursus c : cursus.tousAvecEleveEtSaison()) {
            cursusParEleve.computeIfAbsent(c.getEleve().getId(), k -> new ArrayList<>()).add(c);
        }
        Map<Long, List<AdhesionSaison>> adhesionsParEleve = new HashMap<>();
        for (AdhesionSaison a : adhesions.toutesAvecEleveEtSaison()) {
            adhesionsParEleve.computeIfAbsent(a.getEleve().getId(), k -> new ArrayList<>()).add(a);
        }

        List<CandidatVue> resultat = new ArrayList<>();
        for (Eleve e : eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc()) {
            resultat.add(candidat(e, saison,
                    cursusParEleve.getOrDefault(e.getId(), List.of()),
                    adhesionsParEleve.getOrDefault(e.getId(), List.of())));
        }
        return resultat;
    }

    static CandidatVue candidat(Eleve e, Saison saison, List<Cursus> sesCursus, List<AdhesionSaison> sesAdhesions) {
        Comparator<Saison> plusRecenteDabord = Comparator.comparing(Saison::getDateDebut).reversed();

        // Parcours antérieur à la saison choisie : cursus et adhésions confondus.
        List<Cursus> cursusAnterieurs = sesCursus.stream()
                .filter(c -> c.getSaison().getDateDebut().isBefore(saison.getDateDebut()))
                .sorted(Comparator.comparing(Cursus::getSaison, plusRecenteDabord))
                .toList();
        SortedSet<Saison> saisonsAnterieures = new TreeSet<>(plusRecenteDabord);
        cursusAnterieurs.forEach(c -> saisonsAnterieures.add(c.getSaison()));
        sesAdhesions.stream().map(AdhesionSaison::getSaison)
                .filter(s -> s.getDateDebut().isBefore(saison.getDateDebut()))
                .forEach(saisonsAnterieures::add);

        // Le brevet le plus élevé délivré ici, tous cursus confondus (y compris sur la saison choisie).
        Optional<String> brevetDelivre = sesCursus.stream()
                .filter(c -> c.getStatut() == Cursus.Statut.DELIVRE)
                .map(c -> c.getReferentiel().getNiveau().name())
                .max(Comparator.naturalOrder());
        String niveauActuel = brevetDelivre.orElse(vide(e.getDernierNiveau()) ? null : e.getDernierNiveau().trim());
        boolean declare = brevetDelivre.isEmpty() && niveauActuel != null;

        List<String> inscriptionsSaison = sesCursus.stream()
                .filter(c -> c.getSaison().getId().equals(saison.getId()))
                .map(c -> c.getReferentiel().getNiveau().name())
                .sorted()
                .toList();
        boolean adhesionSaison = sesAdhesions.stream().anyMatch(a -> a.getSaison().getId().equals(saison.getId()));

        String propose;
        String motif;
        Cursus dernier = cursusAnterieurs.isEmpty() ? null : cursusAnterieurs.getFirst();
        if (!inscriptionsSaison.isEmpty()) {
            propose = null;
            motif = "Déjà inscrit en " + String.join(", ", inscriptionsSaison)
                    + " cette saison : une seconde formation reste possible, à choisir à la main.";
        } else if (dernier != null && poursuite(dernier, niveauActuel)) {
            propose = dernier.getReferentiel().getNiveau().name();
            motif = "Poursuite du " + propose + " commencé en " + dernier.getSaison().getLibelle() + ".";
        } else if (niveauActuel == null) {
            propose = "N1";
            motif = "Aucun brevet connu : première formation.";
        } else if (rang(niveauActuel) >= 0) {
            int rang = rang(niveauActuel);
            propose = rang + 1 < NIVEAUX.size() ? NIVEAUX.get(rang + 1) : null;
            motif = propose == null
                    ? "Déjà N3 : pas de formation plus haute suivie ici."
                    : "Niveau suivant après le " + niveauActuel + ".";
        } else {
            propose = null;
            motif = "Niveau déclaré « " + niveauActuel + " » : choisissez la formation à la main.";
        }

        return new CandidatVue(e.getId(), e.getNom(), e.getPrenom(), niveauActuel, declare,
                saisonsAnterieures.size(),
                saisonsAnterieures.isEmpty() ? null : saisonsAnterieures.first().getLibelle(),
                inscriptionsSaison, adhesionSaison, propose, motif);
    }

    /**
     * Formation de la saison précédente restée en cours (ou suspendue, ou
     * compétences validées sans délivrance) et pas dépassée par un brevet
     * plus élevé : on propose de la poursuivre plutôt que le niveau suivant.
     */
    private static boolean poursuite(Cursus dernier, String niveauActuel) {
        if (dernier.getStatut() == Cursus.Statut.DELIVRE || dernier.getStatut() == Cursus.Statut.ABANDON) return false;
        return rang(dernier.getReferentiel().getNiveau().name()) > rang(niveauActuel);
    }

    /** Position dans N1-N3 ; -1 pour un débutant ou un niveau déclaré hors de cette échelle. */
    private static int rang(String niveau) {
        return niveau == null ? -1 : NIVEAUX.indexOf(niveau);
    }

    private static boolean vide(String s) {
        return s == null || s.isBlank();
    }
}
