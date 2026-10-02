package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.InterventionEquipement;
import fr.club.plongee.materiel.domain.InterventionEquipement.Resultat;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;
import fr.club.plongee.materiel.repository.EquipementRepository;
import fr.club.plongee.materiel.repository.InterventionEquipementRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * L'inventaire écrit au format du classeur du club (« Historique Blocs ») :
 * une feuille de blocs avec une colonne par année pour les requalifications
 * et pour les visites TIV, et une feuille « Stabs » pour les gilets. Mêmes
 * titres que ceux que lit {@link ImportMaterielService} : le fichier se
 * réimporte tel quel (dans une autre base, ou après l'avoir complété).
 *
 * <p>Seul ce que le classeur sait porter y figure : les blocs et les gilets,
 * les requalifications et visites TIV conformes. Une visite ou une
 * requalification non conforme, un bloc hors service sont notés dans
 * « Commentaires ». Un équipement au rebut est marqué « VENDU » ou
 * « REFORME » dans la colonne « Sortie », la date en tête du commentaire.
 */
@Service
public class ExportMaterielService {

    private static final DateTimeFormatter JJ_MM_AAAA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record ClasseurExcel(String nomFichier, byte[] contenu) {}

    private final EquipementRepository equipements;
    private final InterventionEquipementRepository interventions;

    public ExportMaterielService(EquipementRepository equipements, InterventionEquipementRepository interventions) {
        this.equipements = equipements;
        this.interventions = interventions;
    }

    @Transactional(readOnly = true)
    public ClasseurExcel exporter() {
        List<Equipement> tous = equipements.findAllByOrderByTypeAscReferenceAsc();
        List<Equipement> blocs = tous.stream().filter(e -> e.getType() == TypeEquipement.BLOC).toList();
        List<Equipement> gilets = tous.stream().filter(e -> e.getType() == TypeEquipement.GILET).toList();
        Map<Long, List<InterventionEquipement>> journal = blocs.isEmpty() ? Map.of()
                : interventions.parEquipements(blocs.stream().map(Equipement::getId).toList()).stream()
                        .sorted(Comparator.comparing(InterventionEquipement::getDateIntervention)
                                .thenComparing(InterventionEquipement::getId))
                        .collect(Collectors.groupingBy(i -> i.getEquipement().getId()));

        try (Workbook classeur = new XSSFWorkbook(); ByteArrayOutputStream sortie = new ByteArrayOutputStream()) {
            Styles styles = new Styles(classeur);
            ecrireBlocs(classeur.createSheet("Blocs"), styles, blocs, journal);
            ecrireGilets(classeur.createSheet("Stabs"), styles, gilets);
            classeur.write(sortie);
            return new ClasseurExcel("materiel-" + Calendrier.aujourdhui() + ".xlsx", sortie.toByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---------- feuille des blocs ----------

    /** Les visites ou requalifications conformes d'un bloc, par année. */
    private record Historique(SortedMap<Integer, List<InterventionEquipement>> requalifs,
                              SortedMap<Integer, List<InterventionEquipement>> visites,
                              List<String> nonConformes) {

        static Historique de(List<InterventionEquipement> journal) {
            Historique h = new Historique(new TreeMap<>(), new TreeMap<>(), new ArrayList<>());
            for (InterventionEquipement i : journal) {
                boolean requalif = i.getType() == TypeIntervention.REQUALIFICATION;
                if (!requalif && i.getType() != TypeIntervention.INSPECTION_VISUELLE) continue;
                if (i.getResultat() == Resultat.NON_CONFORME) {
                    h.nonConformes.add((requalif ? "Requalification" : "Visite TIV") + " non conforme le "
                            + JJ_MM_AAAA.format(i.getDateIntervention()));
                    continue;
                }
                (requalif ? h.requalifs : h.visites)
                        .computeIfAbsent(i.getDateIntervention().getYear(), a -> new ArrayList<>()).add(i);
            }
            return h;
        }

        LocalDate derniere(SortedMap<Integer, List<InterventionEquipement>> parAnnee) {
            return parAnnee.isEmpty() ? null : parAnnee.get(parAnnee.lastKey()).getLast().getDateIntervention();
        }
    }

    /**
     * Une colonne par année ; une deuxième (« Visite 2024 (2) ») si un bloc
     * a eu deux visites la même année, que l'import lit aussi.
     */
    private static List<String> colonnesAnnees(String prefixe, Collection<SortedMap<Integer, List<InterventionEquipement>>> tous) {
        SortedMap<Integer, Integer> maxParAnnee = new TreeMap<>();
        for (SortedMap<Integer, List<InterventionEquipement>> h : tous) {
            h.forEach((annee, liste) -> maxParAnnee.merge(annee, liste.size(), Math::max));
        }
        List<String> titres = new ArrayList<>();
        maxParAnnee.forEach((annee, nombre) -> {
            for (int n = 1; n <= nombre; n++) titres.add(prefixe + " " + annee + (n == 1 ? "" : " (" + n + ")"));
        });
        return titres;
    }

    private void ecrireBlocs(Sheet feuille, Styles styles, List<Equipement> blocs,
                             Map<Long, List<InterventionEquipement>> journal) {
        Map<Long, Historique> historiques = new HashMap<>();
        for (Equipement e : blocs) historiques.put(e.getId(), Historique.de(journal.getOrDefault(e.getId(), List.of())));
        List<String> requalifs = colonnesAnnees("Requalif",
                historiques.values().stream().map(Historique::requalifs).toList());
        List<String> visites = colonnesAnnees("Visite",
                historiques.values().stream().map(Historique::visites).toList());

        List<String> titres = new ArrayList<>(List.of("Numéro", "Club", "Ancien N°", "Constructeur", "Marque", "N°",
                "Cpté", "PE", "PS", "Marque Robinet", "N° robinet", "Première Epreuve", "Dernière Requalif",
                "Date de dernière visite TIV"));
        int premiereRequalif = titres.size();
        titres.addAll(requalifs);
        int premiereVisite = titres.size();
        titres.addAll(visites);
        titres.add("Commentaires");
        titres.add("Sortie");
        ecrireTitres(feuille, styles, titres);

        int ligne = 1;
        for (Equipement e : blocs) {
            Historique h = historiques.get(e.getId());
            Row r = feuille.createRow(ligne++);
            texte(r, 0, sansPrefixe(e.getReference(), "B-"));
            texte(r, 1, e.getProprietaire() == null ? ImportMaterielService.SIGLE_CLUB : e.getProprietaire());
            texte(r, 2, e.getAncienneReference());
            texte(r, 3, e.getConstructeur());
            texte(r, 4, e.getMarque());
            texte(r, 5, e.getNumeroSerie());
            if (e.getVolumeLitres() != null) r.createCell(6).setCellValue(e.getVolumeLitres().doubleValue());
            if (e.getPressionEpreuveBar() != null) r.createCell(7).setCellValue(e.getPressionEpreuveBar());
            if (e.getPressionServiceBar() != null) r.createCell(8).setCellValue(e.getPressionServiceBar());
            texte(r, 9, e.getRobinetterie());
            texte(r, 10, e.getNumeroRobinet());
            date(r, 11, e.getDatePremiereEpreuve(), styles.jour);
            date(r, 12, h.derniere(h.requalifs()), styles.jour);
            date(r, 13, h.derniere(h.visites()), styles.jour);
            ecrireAnnees(r, styles, premiereRequalif, requalifs, "Requalif", h.requalifs());
            ecrireAnnees(r, styles, premiereVisite, visites, "Visite", h.visites());

            List<String> notes = new ArrayList<>();
            if (e.isHorsService()) notes.add("Hors service");
            notes.addAll(h.nonConformes());
            ecrireSortie(r, titres.size() - 2, e, notes);
        }
        ajuster(feuille, titres.size());
    }

    private static void ecrireAnnees(Row r, Styles styles, int premiereColonne, List<String> titres, String prefixe,
                                     SortedMap<Integer, List<InterventionEquipement>> parAnnee) {
        parAnnee.forEach((annee, liste) -> {
            int colonne = premiereColonne + titres.indexOf(prefixe + " " + annee);
            for (InterventionEquipement i : liste) {
                // Une date reprise au mois près du classeur y retourne au mois près.
                boolean auMois = ImportMaterielService.ORIGINE_MOIS.equals(i.getDescription());
                date(r, colonne++, i.getDateIntervention(), auMois ? styles.mois : styles.jour);
            }
        });
    }

    // ---------- feuille des gilets ----------

    private void ecrireGilets(Sheet feuille, Styles styles, List<Equipement> gilets) {
        List<String> titres = List.of("N°", "old", "FABRICANT", "TYPE", "TAILLE", "Date ACHAT", "Commentaires", "Sortie");
        ecrireTitres(feuille, styles, titres);
        int ligne = 1;
        for (Equipement e : gilets) {
            Row r = feuille.createRow(ligne++);
            texte(r, 0, sansPrefixe(e.getReference(), "G-"));
            texte(r, 1, e.getAncienneReference());
            texte(r, 2, e.getMarque());
            texte(r, 3, e.getModele());
            texte(r, 4, e.getTaille());
            date(r, 5, e.getDateAchat(), styles.jour);
            ecrireSortie(r, 6, e, new ArrayList<>(e.isHorsService() ? List.of("Hors service") : List.of()));
        }
        ajuster(feuille, titres.size());
    }

    // ---------- commun ----------

    /**
     * « Commentaires » puis « Sortie ». Au rebut : la date en tête du
     * commentaire (l'import l'y relit), le motif ensuite s'il ne commence
     * pas déjà par « Vendu »/« Réformé » et cette date (motif déjà repris
     * d'un classeur, qui revient ainsi à l'identique).
     */
    private static void ecrireSortie(Row r, int colonne, Equipement e, List<String> notes) {
        String remarques = e.getRemarques() == null ? null : e.getRemarques().replaceFirst("^Classeur : ", "");
        if (e.getDateRebut() == null) {
            if (remarques != null) notes.addFirst(remarques);
            texte(r, colonne, notes.isEmpty() ? null : String.join(" ; ", notes));
            return;
        }
        String motif = e.getMotifRebut();
        boolean vendu = motif != null && ImportMaterielService.normaliser(motif).startsWith("vendu");
        String commentaire;
        if (motif != null && (vendu || ImportMaterielService.normaliser(motif).startsWith("reforme"))
                && e.getDateRebut().equals(ImportMaterielService.dateDansTexte(motif))) {
            commentaire = motif;
        } else {
            commentaire = (vendu ? "Vendu" : "Réformé") + " le " + JJ_MM_AAAA.format(e.getDateRebut())
                    + (motif == null ? "" : " : " + motif);
        }
        if (remarques != null) notes.addFirst(remarques);
        if (!notes.isEmpty()) commentaire += " ; " + String.join(" ; ", notes);
        texte(r, colonne, commentaire);
        texte(r, colonne + 1, vendu ? "VENDU" : "REFORME");
    }

    private static String sansPrefixe(String reference, String prefixe) {
        return reference.regionMatches(true, 0, prefixe, 0, prefixe.length())
                ? reference.substring(prefixe.length()) : reference;
    }

    private static void ecrireTitres(Sheet feuille, Styles styles, List<String> titres) {
        Row r = feuille.createRow(0);
        for (int i = 0; i < titres.size(); i++) {
            Cell c = r.createCell(i);
            c.setCellValue(titres.get(i));
            c.setCellStyle(styles.titre);
        }
        feuille.createFreezePane(1, 1);
    }

    private static void texte(Row r, int colonne, String valeur) {
        if (valeur != null && !valeur.isBlank()) r.createCell(colonne).setCellValue(valeur);
    }

    private static void date(Row r, int colonne, LocalDate valeur, CellStyle style) {
        if (valeur == null) return;
        Cell c = r.createCell(colonne);
        c.setCellValue(valeur);
        c.setCellStyle(style);
    }

    private static void ajuster(Sheet feuille, int colonnes) {
        for (int i = 0; i < colonnes; i++) {
            feuille.autoSizeColumn(i);
            feuille.setColumnWidth(i, Math.min(feuille.getColumnWidth(i) + 512, 60 * 256));
        }
    }

    private static final class Styles {
        final CellStyle titre;
        final CellStyle jour;
        final CellStyle mois;

        Styles(Workbook classeur) {
            DataFormat formats = classeur.createDataFormat();
            Font gras = classeur.createFont();
            gras.setBold(true);
            titre = classeur.createCellStyle();
            titre.setFont(gras);
            jour = classeur.createCellStyle();
            jour.setDataFormat(formats.getFormat("dd/mm/yyyy"));
            mois = classeur.createCellStyle();
            mois.setDataFormat(formats.getFormat("mmm-yy"));
        }
    }
}
