package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.materiel.domain.ConstatTiv;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.InspectionTiv;
import fr.club.plongee.materiel.domain.InspectionTiv.Decision;
import fr.club.plongee.materiel.domain.InspectionTiv.Motif;
import fr.club.plongee.materiel.domain.InterventionEquipement;
import fr.club.plongee.materiel.domain.InterventionEquipement.Resultat;
import fr.club.plongee.materiel.domain.PointInspectionTiv;
import fr.club.plongee.materiel.domain.PointInspectionTiv.Section;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;
import fr.club.plongee.materiel.repository.InspectionTivRepository;
import fr.club.plongee.materiel.repository.InterventionEquipementRepository;
import fr.club.plongee.materiel.service.EcheancesEquipement.Etat;
import fr.club.plongee.materiel.service.MaterielService.DemandeRebut;
import fr.club.plongee.materiel.service.MaterielService.EquipementVue;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * La fiche d'évaluation et de suivi d'une bouteille, remplie par le TIV à
 * chaque inspection visuelle. Elle s'inscrit au journal du bloc comme une
 * INSPECTION_VISUELLE : conforme si l'avis est favorable, non conforme
 * sinon (ce qui bloque les prêts, voir {@link EcheancesEquipement}) ; le
 * rebut met en plus le bloc au rebut.
 *
 * <p>Règles tenues ici, pas seulement à l'écran : toutes les questions qui
 * concernent le bloc ont une réponse, un défaut qui impose le rejet
 * (filets actifs détériorés, corrosion feuilletante...) interdit l'avis
 * favorable, et un avis défavorable ou un rebut est motivé.
 */
@Service
public class InspectionTivService {

    public record PointVue(PointInspectionTiv code, String libelle, boolean reponseNormale, String actionProposee,
                           boolean interditAvisFavorable) {}

    public record SectionVue(Section code, String libelle, List<PointVue> points) {}

    /** De quoi préparer la saisie : les questions qui concernent ce bloc et ce qu'on peut pré-remplir. */
    public record ModeleInspectionVue(EquipementVue bloc, List<SectionVue> sections, String tivNom, String tivNumero,
                                      String filetageBouteille, String filetageRobinet) {}

    public record DemandeConstat(@NotNull PointInspectionTiv point, @NotNull Boolean reponse,
                                 @Size(max = 255) String decision, @Size(max = 255) String precisions,
                                 LocalDate realiseLe) {}

    public record DemandeInspectionTiv(@NotNull LocalDate dateInspection, @NotNull Motif motif,
                                       @NotBlank @Size(max = 120) String tivNom,
                                       @NotBlank @Size(max = 30) String tivNumero,
                                       @Size(max = 30) String filetageBouteille,
                                       @Size(max = 30) String filetageRobinet,
                                       @Size(max = 80) String marquageRequalification,
                                       @NotNull Decision decision, String observations,
                                       @NotNull List<@Valid @NotNull DemandeConstat> constats) {}

    public record ConstatVue(PointInspectionTiv point, String libelle, boolean reponse, boolean defaut,
                             String decision, String precisions, LocalDate realiseLe) {}

    public record SectionConstatsVue(Section code, String libelle, List<ConstatVue> constats) {}

    /**
     * Le compte rendu d'inspection : {@code numero} en est l'identification
     * unique, {@code club} la structure émettrice.
     */
    public record InspectionTivVue(Long id, String numero, String club, EquipementVue bloc,
                                   LocalDate dateInspection, Motif motif, String motifLibelle,
                                   String tivNom, String tivNumero, String proprietaire,
                                   String filetageBouteille, String filetageRobinet, String marquageRequalification,
                                   Decision decision, String decisionLibelle, String observations,
                                   LocalDate prochaineInspection, LocalDate prochaineRequalification,
                                   String saisiPar, Instant saisiLe, List<SectionConstatsVue> sections) {}

    private final MaterielService materiel;
    private final InspectionTivRepository inspections;
    private final InterventionEquipementRepository interventions;
    private final UtilisateurRepository utilisateurs;
    private final String nomClub;

    public InspectionTivService(MaterielService materiel, InspectionTivRepository inspections,
                                InterventionEquipementRepository interventions, UtilisateurRepository utilisateurs,
                                @Value("${app.club.nom}") String nomClub) {
        this.materiel = materiel;
        this.inspections = inspections;
        this.interventions = interventions;
        this.utilisateurs = utilisateurs;
        this.nomClub = nomClub;
    }

    @Transactional(readOnly = true)
    public ModeleInspectionVue modele(Long equipementId, Long auteurId) {
        Equipement bloc = blocInspectable(equipementId);
        List<SectionVue> sections = new ArrayList<>();
        for (Section s : Section.values()) {
            if (!s.concerne(bloc)) continue;
            sections.add(new SectionVue(s, s.libelle(), Arrays.stream(PointInspectionTiv.values())
                    .filter(p -> p.section() == s)
                    .map(p -> new PointVue(p, p.libelle(), p.reponseNormale(), p.actionProposee(),
                            p.interditAvisFavorable()))
                    .toList()));
        }
        Optional<InspectionTiv> precedenteDuTiv = inspections.findFirstByInterventionSaisiParIdOrderByIdDesc(auteurId);
        Optional<InspectionTiv> precedenteDuBloc = inspections.findFirstByInterventionEquipementIdOrderByIdDesc(equipementId);
        return new ModeleInspectionVue(materiel.lire(equipementId, false), sections,
                precedenteDuTiv.map(InspectionTiv::getTivNom)
                        .orElseGet(() -> utilisateurs.findById(auteurId).map(Utilisateur::nomComplet).orElse(null)),
                precedenteDuTiv.map(InspectionTiv::getTivNumero).orElse(null),
                precedenteDuBloc.map(InspectionTiv::getFiletageBouteille).orElse(null),
                precedenteDuBloc.map(InspectionTiv::getFiletageRobinet).orElse(null));
    }

    @Transactional
    public InspectionTivVue enregistrer(Long equipementId, DemandeInspectionTiv d, Long auteurId) {
        Equipement bloc = blocInspectable(equipementId);
        if (d.dateInspection().isAfter(Calendrier.aujourdhui())) {
            throw new RegleMetierException("La date de l'inspection ne peut pas être dans le futur.");
        }
        List<ConstatTiv> constats = constats(bloc, d);
        if (d.decision() == Decision.FAVORABLE) {
            List<String> rejets = constats.stream()
                    .filter(c -> c.estUnDefaut() && c.getPoint().interditAvisFavorable())
                    .map(c -> "« " + c.getPoint().libelle() + " »")
                    .toList();
            if (!rejets.isEmpty()) {
                throw new RegleMetierException("Avis favorable impossible : " + String.join(", ", rejets)
                        + (rejets.size() > 1 ? " imposent" : " impose")
                        + " un avis défavorable ou le rebut de la bouteille.");
            }
        } else if (vide(d.observations())) {
            throw new RegleMetierException(d.decision() == Decision.REBUT
                    ? "Indiquez dans les observations le motif du rebut."
                    : "Indiquez dans les observations ce qui motive l'avis défavorable.");
        }

        Utilisateur auteur = utilisateurs.getReferenceById(auteurId);
        String tivNom = d.tivNom().trim();
        String tivNumero = d.tivNumero().trim();
        InterventionEquipement intervention = materiel.journaliser(bloc, TypeIntervention.INSPECTION_VISUELLE,
                d.dateInspection(), d.decision() == Decision.FAVORABLE ? Resultat.CONFORME : Resultat.NON_CONFORME,
                d.observations(), null, auteur, tivNom + " (TIV n° " + tivNumero + ")");

        InspectionTiv t = new InspectionTiv();
        t.setIntervention(intervention);
        t.setMotif(d.motif());
        t.setTivNom(tivNom);
        t.setTivNumero(tivNumero);
        t.setProprietaire(bloc.getProprietaire());
        t.setFiletageBouteille(nettoyer(d.filetageBouteille()));
        t.setFiletageRobinet(nettoyer(d.filetageRobinet()));
        t.setMarquageRequalification(nettoyer(d.marquageRequalification()));
        t.setDecision(d.decision());
        t.getConstats().addAll(constats);
        if (d.decision() != Decision.REBUT) {
            // Le journal vient de recevoir cette inspection : les échéances en tiennent compte.
            Etat etat = EcheancesEquipement.calculer(bloc, interventions.parEquipement(equipementId));
            if (d.decision() == Decision.FAVORABLE) t.setProchaineInspection(etat.prochaineInspection());
            t.setProchaineRequalification(etat.prochaineRequalification());
        }
        inspections.save(t);

        if (d.decision() == Decision.REBUT) {
            String motif = "Rebutée par le TIV " + tivNom + " : " + d.observations().trim();
            materiel.mettreAuRebut(equipementId, new DemandeRebut(d.dateInspection(),
                    motif.length() > 255 ? motif.substring(0, 254) + "…" : motif));
        }
        return vue(t, bloc);
    }

    @Transactional(readOnly = true)
    public InspectionTivVue lire(Long id) {
        InspectionTiv t = inspections.detail(id)
                .orElseThrow(() -> new RessourceIntrouvableException("Fiche d'inspection introuvable"));
        return vue(t, t.getIntervention().getEquipement());
    }

    /** Une réponse par question qui concerne ce bloc, ni plus ni moins, dans l'ordre de la fiche. */
    private static List<ConstatTiv> constats(Equipement bloc, DemandeInspectionTiv d) {
        Map<PointInspectionTiv, DemandeConstat> parPoint = new EnumMap<>(PointInspectionTiv.class);
        for (DemandeConstat c : d.constats()) {
            if (!c.point().concerne(bloc)) {
                throw new RegleMetierException("« " + c.point().libelle() + " » ne concerne pas ce bloc.");
            }
            if (parPoint.put(c.point(), c) != null) {
                throw new RegleMetierException("« " + c.point().libelle() + " » a reçu deux réponses.");
            }
        }
        List<String> manquants = Arrays.stream(PointInspectionTiv.values())
                .filter(p -> p.concerne(bloc) && !parPoint.containsKey(p))
                .map(p -> "« " + p.libelle() + " »")
                .toList();
        if (!manquants.isEmpty()) {
            throw new RegleMetierException("Fiche incomplète, répondez aussi à : " + String.join(", ", manquants) + ".");
        }
        List<ConstatTiv> constats = new ArrayList<>();
        for (Map.Entry<PointInspectionTiv, DemandeConstat> e : parPoint.entrySet()) {
            PointInspectionTiv p = e.getKey();
            DemandeConstat c = e.getValue();
            if (c.realiseLe() != null && c.realiseLe().isBefore(d.dateInspection())) {
                throw new RegleMetierException("« " + p.libelle() + " » : la réalisation ne peut pas précéder "
                        + "l'inspection.");
            }
            boolean defaut = c.reponse() != p.reponseNormale();
            // Sans défaut, il n'y a rien à décider : la colonne reste vide, comme sur la fiche papier.
            String decision = !defaut ? null : vide(c.decision()) ? p.actionProposee() : c.decision().trim();
            constats.add(new ConstatTiv(p, c.reponse(), decision, nettoyer(c.precisions()),
                    defaut ? c.realiseLe() : null));
        }
        return constats;
    }

    private Equipement blocInspectable(Long equipementId) {
        Equipement e = materiel.equipement(equipementId);
        if (e.getType() != TypeEquipement.BLOC) {
            throw new RegleMetierException("La fiche d'inspection TIV ne concerne que les blocs.");
        }
        if (e.estRebute()) {
            throw new RegleMetierException("Ce bloc est au rebut : remettez-le en stock avant de l'inspecter.");
        }
        return e;
    }

    private InspectionTivVue vue(InspectionTiv t, Equipement bloc) {
        InterventionEquipement i = t.getIntervention();
        List<SectionConstatsVue> sections = new ArrayList<>();
        for (Section s : Section.values()) {
            List<ConstatVue> constats = t.getConstats().stream()
                    .filter(c -> c.getPoint().section() == s)
                    .map(c -> new ConstatVue(c.getPoint(), c.getPoint().libelle(), c.isReponse(), c.estUnDefaut(),
                            c.getDecision(), c.getPrecisions(), c.getRealiseLe()))
                    .toList();
            if (!constats.isEmpty()) sections.add(new SectionConstatsVue(s, s.libelle(), constats));
        }
        // Le compte rendu se lit aussi par un TIV : pas de nom d'emprunteur.
        return new InspectionTivVue(t.getId(), numero(t), nomClub, materiel.lire(bloc.getId(), false),
                i.getDateIntervention(), t.getMotif(), t.getMotif().libelle(),
                t.getTivNom(), t.getTivNumero(), t.getProprietaire(),
                t.getFiletageBouteille(), t.getFiletageRobinet(), t.getMarquageRequalification(),
                t.getDecision(), t.getDecision().libelle(), i.getDescription(),
                t.getProchaineInspection(), t.getProchaineRequalification(),
                i.getSaisiPar() == null ? null : i.getSaisiPar().nomComplet(), i.getSaisiLe(), sections);
    }

    /** « TIV-2026-0042 » : l'année de l'inspection et l'identifiant, unique. */
    private static String numero(InspectionTiv t) {
        return "TIV-%d-%04d".formatted(t.getIntervention().getDateIntervention().getYear(), t.getId());
    }

    private static String nettoyer(String s) {
        return vide(s) ? null : s.trim();
    }

    private static boolean vide(String s) {
        return s == null || s.isBlank();
    }
}
