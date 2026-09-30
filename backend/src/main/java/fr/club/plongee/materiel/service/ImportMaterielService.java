package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.InterventionEquipement.Resultat;
import fr.club.plongee.materiel.domain.TypeEquipement;
import fr.club.plongee.materiel.domain.TypeIntervention;
import fr.club.plongee.materiel.repository.EquipementRepository;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reprise du classeur Excel tenu par le club avant l'application
 * (« Historique Blocs ») : une feuille de blocs, une ligne par bloc, avec
 * une colonne par année pour les requalifications et pour les visites TIV,
 * et une feuille de gilets stabilisateurs (« Stabs »).
 *
 * <p>Les colonnes sont retrouvées par leur titre, pas par leur position.
 * L'historique entre au journal (lignes « conforme »). Un équipement dont
 * la référence existe déjà est laissé tel quel : réimporter le même
 * classeur ne crée pas de doublon. Les cases « VENDU » ou « REFORME »
 * mettent le bloc au rebut, sa fiche restant consultable.
 *
 * <p>Ce que le classeur donne pour l'avenir n'est pas repris : une
 * requalification notée après la « Dernière Requalif » (ou après
 * aujourd'hui) n'est qu'une prévision.
 */
@Service
public class ImportMaterielService {

    /** Le club lui-même dans la colonne « Club » : propriétaire laissé vide. */
    static final String SIGLE_CLUB = "CPPJVO";

    private static final String ORIGINE = "Repris du classeur du matériel.";
    private static final String ORIGINE_MOIS = "Repris du classeur du matériel (seul le mois y est noté).";
    private static final Set<String> MARQUES_VIDES = Set.of("", "*", "?", "???", "vendu", "reforme", "requalif");
    private static final Set<String> TAILLES = Set.of("XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL");
    private static final Pattern DATE_TEXTE = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{2,4})");
    private static final Pattern ANNEE_COLONNE = Pattern.compile("^(requalif|visite) (\\d{4})");

    public record Rapport(int blocs, int gilets, int interventions, int auRebut,
                          List<String> dejaPresents, List<String> remarques) {}

    private final EquipementRepository equipements;
    private final UtilisateurRepository utilisateurs;
    private final MaterielService materiel;

    public ImportMaterielService(EquipementRepository equipements, UtilisateurRepository utilisateurs,
                                 MaterielService materiel) {
        this.equipements = equipements;
        this.utilisateurs = utilisateurs;
        this.materiel = materiel;
    }

    /** Tout ou rien : un classeur illisible ne laisse pas un inventaire à moitié repris. */
    @Transactional
    public Rapport importer(byte[] contenu, Long auteurId) {
        Import imp = new Import(utilisateurs.getReferenceById(auteurId));
        try (Workbook classeur = ouvrir(contenu)) {
            List<Feuille> blocs = new ArrayList<>();
            List<Feuille> gilets = new ArrayList<>();
            for (Sheet s : classeur) {
                Feuille f = Feuille.lire(s);
                if (f == null) continue;
                if (f.a("numero") && f.a("pe") && f.a("ps")) blocs.add(f);
                else if (f.a("taille") && f.a("fabricant")) gilets.add(f);
            }
            if (blocs.isEmpty() && gilets.isEmpty()) {
                throw new RegleMetierException("Ce classeur ne contient ni feuille de blocs (colonnes « Numéro », "
                        + "« PE », « PS ») ni feuille de gilets (colonnes « N° », « FABRICANT », « TAILLE »).");
            }
            // Une feuille « Blocs sortis » reprend des lignes de la feuille complète : la plus longue d'abord.
            blocs.sort(Comparator.comparingInt((Feuille f) -> -f.lignes.size()));
            for (Feuille f : blocs) for (Row r : f.lignes) importerBloc(imp, f, r);
            for (Feuille f : gilets) for (Row r : f.lignes) importerGilet(imp, f, r);
        } catch (IOException e) {
            throw illisible();
        }
        return new Rapport(imp.blocs, imp.gilets, imp.interventions, imp.auRebut, imp.dejaPresents, imp.remarques);
    }

    private static Workbook ouvrir(byte[] contenu) {
        try {
            return WorkbookFactory.create(new ByteArrayInputStream(contenu));
        } catch (IOException | IllegalArgumentException | IllegalStateException e) {
            // Fichier vide, pas un classeur Office, classeur protégé par mot de passe...
            throw illisible();
        }
    }

    private static RegleMetierException illisible() {
        return new RegleMetierException("Le fichier n'a pas pu être lu : envoyez le classeur au format Excel (.xlsx).");
    }

    private void importerBloc(Import imp, Feuille f, Row r) {
        String numero = texte(f.cellule(r, "numero"));
        if (numero == null) return;
        String reference = numero.matches("\\d+") ? "B-%02d".formatted(Integer.parseInt(numero)) : "B-" + numero;
        if (!imp.references.add(reference.toLowerCase())) return;
        if (equipements.existsByReferenceIgnoreCase(reference)) {
            imp.dejaPresents.add(reference);
            return;
        }

        Equipement e = new Equipement();
        e.setType(TypeEquipement.BLOC);
        e.setReference(reference);
        e.setAncienneReference(texte(f.cellule(r, "ancien n°")));
        String proprietaire = texte(f.cellule(r, "club"));
        e.setProprietaire(proprietaire == null || proprietaire.equalsIgnoreCase(SIGLE_CLUB) ? null : proprietaire);
        e.setConstructeur(texte(f.cellule(r, "constructeur")));
        e.setMarque(texte(f.cellule(r, "marque")));
        e.setNumeroSerie(texte(f.cellule(r, "n°")));
        Double volume = nombre(f.cellule(r, "cpte"));
        e.setVolumeLitres(volume == null ? null : BigDecimal.valueOf(volume));
        Double pe = nombre(f.cellule(r, "pe"));
        Double ps = nombre(f.cellule(r, "ps"));
        e.setPressionEpreuveBar(pe == null ? null : (int) Math.round(pe));
        e.setPressionServiceBar(ps == null ? null : (int) Math.round(ps));
        e.setRobinetterie(texte(f.cellule(r, "marque robinet")));
        e.setNumeroRobinet(texte(f.cellule(r, "n° robinet")));
        e.setDatePremiereEpreuve(date(f.cellule(r, "premiere epreuve")));
        e.setRegimeTiv(true);
        String commentaire = texte(f.cellule(r, "commentaires"));
        equipements.save(e);
        imp.blocs++;

        LocalDate aujourdhui = Calendrier.aujourdhui();
        LocalDate borneRequalif = date(f.cellule(r, "derniere requalif"));
        List<String> notes = new ArrayList<>();
        Integer anneeSortie = null;
        SortedMap<LocalDate, Boolean> requalifs = new TreeMap<>();
        SortedMap<LocalDate, Boolean> visites = new TreeMap<>();

        for (Map.Entry<String, Integer> col : f.colonnes.entrySet()) {
            String titre = col.getKey();
            Cell c = r.getCell(col.getValue());
            Matcher annee = ANNEE_COLONNE.matcher(titre);
            boolean colonneVisite = titre.startsWith("date de") && titre.contains("visite");
            if (!annee.find() && !colonneVisite) continue;
            boolean requalif = !colonneVisite && annee.group(1).equals("requalif");

            LocalDate d = date(c);
            if (d != null) {
                if (d.isAfter(aujourdhui)) continue;
                if (requalif) {
                    if (borneRequalif == null || !d.isAfter(borneRequalif)) requalifs.merge(d, jourConnu(c), Boolean::logicalOr);
                } else {
                    visites.merge(d, jourConnu(c), Boolean::logicalOr);
                }
                continue;
            }
            String brut = normaliser(texteBrut(c));
            if ((brut.equals("vendu") || brut.equals("reforme")) && !colonneVisite && anneeSortie == null) {
                anneeSortie = Integer.parseInt(annee.group(2));
            } else if (!MARQUES_VIDES.contains(brut) && !brut.startsWith("neuf")) {
                notes.add(f.titres.get(col.getValue()) + " : « " + texteBrut(c).trim() + " »");
            }
        }
        // Une requalification vaut visite : pas de doublon au journal pour la même date.
        requalifs.forEach((d, jour) -> {
            visites.remove(d);
            materiel.journaliser(e, TypeIntervention.REQUALIFICATION, d, Resultat.CONFORME,
                    jour ? ORIGINE : ORIGINE_MOIS, null, imp.auteur);
            imp.interventions++;
        });
        visites.forEach((d, jour) -> {
            materiel.journaliser(e, TypeIntervention.INSPECTION_VISUELLE, d, Resultat.CONFORME,
                    jour ? ORIGINE : ORIGINE_MOIS, null, imp.auteur);
            imp.interventions++;
        });

        String sortie = sortie(r);
        if (sortie != null) {
            LocalDate dateSortie = dateDansTexte(commentaire);
            String precision = "";
            if (dateSortie == null && anneeSortie != null) {
                dateSortie = LocalDate.of(anneeSortie, 1, 1);
                precision = " (date exacte inconnue : année " + anneeSortie + " d'après le classeur)";
            }
            if (dateSortie == null || dateSortie.isAfter(aujourdhui)) {
                dateSortie = aujourdhui;
                precision = " (date inconnue : date de l'import)";
            }
            e.setDateRebut(dateSortie);
            // « Réformé par ROTH… » se suffit à lui-même.
            String motif = (commentaire == null ? sortie
                    : normaliser(commentaire).startsWith(normaliser(sortie)) ? commentaire
                    : sortie + " : " + commentaire) + precision;
            e.setMotifRebut(motif.length() > 255 ? motif.substring(0, 254) + "…" : motif);
            imp.auRebut++;
        } else if (commentaire != null) {
            notes.addFirst(commentaire);
        }
        if (!notes.isEmpty()) {
            e.setRemarques("Classeur : " + String.join(" ; ", notes));
            imp.remarques.add(reference + " : " + String.join(" ; ", notes));
        }
    }

    private void importerGilet(Import imp, Feuille f, Row r) {
        String numero = texte(f.cellule(r, "n°"));
        if (numero == null) return;
        String reference = "G-" + numero;
        if (!imp.references.add(reference.toLowerCase())) return;
        if (equipements.existsByReferenceIgnoreCase(reference)) {
            imp.dejaPresents.add(reference);
            return;
        }
        Equipement e = new Equipement();
        e.setType(TypeEquipement.GILET);
        e.setReference(reference);
        e.setAncienneReference(texte(f.cellule(r, "old")));
        e.setMarque(texte(f.cellule(r, "fabricant")));
        e.setModele(texte(f.cellule(r, "type")));
        String taille = texte(f.cellule(r, "taille"));
        if (taille == null) {
            // « S6 » : la taille se lit dans le numéro quand la colonne est vide.
            String prefixe = numero.replaceAll("\\d+$", "").toUpperCase();
            if (TAILLES.contains(prefixe)) taille = prefixe;
        }
        e.setTaille(taille);
        e.setDateAchat(date(f.cellule(r, "date achat")));
        equipements.save(e);
        imp.gilets++;
    }

    /** « Vendu » ou « Réformé » si une case de la ligne le dit, sinon null. */
    private static String sortie(Row r) {
        boolean vendu = false, reforme = false;
        for (Cell c : r) {
            String v = normaliser(texteBrut(c));
            vendu |= v.equals("vendu");
            reforme |= v.equals("reforme");
        }
        return vendu ? "Vendu" : reforme ? "Réformé" : null;
    }

    private static LocalDate dateDansTexte(String texte) {
        if (texte == null) return null;
        Matcher m = DATE_TEXTE.matcher(texte);
        if (!m.find()) return null;
        int annee = Integer.parseInt(m.group(3));
        if (annee < 100) annee += annee < 50 ? 2000 : 1900;
        try {
            return LocalDate.of(annee, Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
        } catch (java.time.DateTimeException e) {
            return null;
        }
    }

    // ---------- lecture des cellules ----------

    private static CellType typeEffectif(Cell c) {
        return c.getCellType() == CellType.FORMULA ? c.getCachedFormulaResultType() : c.getCellType();
    }

    /** Le texte tel quel, chiffres sans « .0 » ; chaîne vide pour une case vide. */
    private static String texteBrut(Cell c) {
        if (c == null) return "";
        return switch (typeEffectif(c)) {
            case STRING -> c.getStringCellValue();
            case NUMERIC -> BigDecimal.valueOf(c.getNumericCellValue()).stripTrailingZeros().toPlainString();
            case BOOLEAN -> String.valueOf(c.getBooleanCellValue());
            default -> "";
        };
    }

    /** Null pour une case vide ou une marque sans valeur (« VENDU », « ??? », « * »). */
    private static String texte(Cell c) {
        String v = texteBrut(c).trim();
        return MARQUES_VIDES.contains(normaliser(v)) ? null : v;
    }

    private static Double nombre(Cell c) {
        if (c == null) return null;
        if (typeEffectif(c) == CellType.NUMERIC) return c.getNumericCellValue();
        try {
            String v = texteBrut(c).trim().replace(',', '.');
            return v.isEmpty() ? null : Double.valueOf(v);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Une date avant 1950 est un zéro d'Excel (« décembre-99 »), pas une vraie date. */
    private static LocalDate date(Cell c) {
        if (c == null) return null;
        LocalDate d = null;
        if (typeEffectif(c) == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(c) || c.getCellType() == CellType.FORMULA) {
                d = DateUtil.getLocalDateTime(c.getNumericCellValue()).toLocalDate();
            }
        } else if (typeEffectif(c) == CellType.STRING) {
            String v = c.getStringCellValue().trim();
            for (String motif : List.of("d/M/yyyy", "d/M/yy")) {
                try {
                    d = LocalDate.parse(v, DateTimeFormatter.ofPattern(motif));
                    break;
                } catch (DateTimeParseException ignore) {
                    // motif suivant
                }
            }
        }
        return d == null || d.getYear() < 1950 ? null : d;
    }

    /** « avr.-00 » : format sans jour, la date n'est connue qu'au mois près. */
    private static boolean jourConnu(Cell c) {
        if (c == null || typeEffectif(c) != CellType.NUMERIC) return true;
        String format = c.getCellStyle().getDataFormatString();
        return format == null || format.toLowerCase().contains("d") || format.toLowerCase().startsWith("general");
    }

    /** Minuscules, sans accents ni espaces superflus, première ligne seulement. */
    static String normaliser(String s) {
        if (s == null) return "";
        String premiereLigne = s.strip().split("\\R", 2)[0];
        return Normalizer.normalize(premiereLigne, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    // ---------- structures ----------

    /** Une feuille dont la ligne de titres est reconnue, et ses lignes de données. */
    private record Feuille(Map<String, Integer> colonnes, Map<Integer, String> titres, List<Row> lignes) {

        static Feuille lire(Sheet s) {
            for (int i = s.getFirstRowNum(); i <= Math.min(s.getFirstRowNum() + 5, s.getLastRowNum()); i++) {
                Row titre = s.getRow(i);
                if (titre == null) continue;
                Map<String, Integer> colonnes = new LinkedHashMap<>();
                Map<Integer, String> titres = new HashMap<>();
                for (Cell c : titre) {
                    String t = normaliser(texteBrut(c));
                    if (t.isEmpty()) continue;
                    colonnes.putIfAbsent(t, c.getColumnIndex());
                    titres.put(c.getColumnIndex(), texteBrut(c).strip().split("\\R", 2)[0].trim());
                }
                if (colonnes.size() < 3) continue;
                List<Row> lignes = new ArrayList<>();
                for (int j = i + 1; j <= s.getLastRowNum(); j++) {
                    if (s.getRow(j) != null) lignes.add(s.getRow(j));
                }
                return new Feuille(colonnes, titres, lignes);
            }
            return null;
        }

        boolean a(String titre) {
            return colonnes.containsKey(titre);
        }

        Cell cellule(Row r, String titre) {
            Integer i = colonnes.get(titre);
            return i == null ? null : r.getCell(i);
        }
    }

    private static final class Import {
        final Utilisateur auteur;
        final Set<String> references = new HashSet<>();
        final List<String> dejaPresents = new ArrayList<>();
        final List<String> remarques = new ArrayList<>();
        int blocs, gilets, interventions, auRebut;

        Import(Utilisateur auteur) {
            this.auteur = auteur;
        }
    }
}
