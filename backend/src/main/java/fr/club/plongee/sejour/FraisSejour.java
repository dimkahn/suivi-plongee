package fr.club.plongee.sejour;

import java.time.LocalDate;
import java.util.*;

/**
 * Le partage des frais d'un séjour, en calcul pur (sans base) : la part de
 * chacun dans chaque dépense, son solde, et les remboursements qui
 * remettent les comptes à zéro. Tous les montants sont en centimes.
 * <p>
 * Répartition d'une dépense : au prorata des parts, arrondie au centime
 * inférieur ; les centimes restants vont un par un aux premiers
 * participants (par id), pour que la somme des parts fasse exactement le
 * montant. Solde = payé − dû + remboursé − reçu : positif, on lui doit de
 * l'argent ; négatif, il en doit. Les remboursements proposés associent le
 * plus gros débiteur au plus gros créancier, jusqu'à épuisement : au plus
 * un virement de moins que de personnes concernées.
 * <p>
 * Le club peut avancer une dépense (payeur null) et recevoir ou faire un
 * remboursement (de ou à null) : il a alors son solde, null en guise d'id,
 * après ceux des participants. Il ne prend jamais de part d'une dépense.
 */
public final class FraisSejour {

    public enum CategorieDepense { HEBERGEMENT, TRANSPORT, REPAS, PLONGEE, AUTRE }

    public record Part(Long participantId, int parts) {}

    /** {@code photos} : les ids des photos de la note ; {@code saisiePar…} : qui l'a saisie (compte ou participant). */
    public record Depense(Long id, String libelle, CategorieDepense categorie, long montantCentimes, Long payeurId,
                          LocalDate jour, List<Part> parts, List<Long> photos, Long saisieParUtilisateurId,
                          Long saisieParParticipantId) {}

    public record Versement(Long id, Long deId, Long aId, long montantCentimes, LocalDate jour,
                            Long saisieParUtilisateurId, Long saisieParParticipantId) {}

    /** Ce que chacun a payé, ce qu'il doit (sa part des dépenses) et son solde, remboursements compris. */
    public record Solde(Long participantId, long payeCentimes, long duCentimes, long soldeCentimes) {}

    /** Un virement à faire pour solder les comptes. */
    public record Remboursement(Long deId, Long aId, long montantCentimes) {}

    public record Comptes(long totalCentimes, List<Solde> soldes, List<Remboursement> remboursements) {}

    private FraisSejour() {}

    /** La part de chaque participant dans une dépense, au centime près. */
    public static Map<Long, Long> repartir(long montant, List<Part> parts) {
        List<Part> triees = parts.stream().sorted(Comparator.comparing(Part::participantId)).toList();
        long total = triees.stream().mapToLong(Part::parts).sum();
        Map<Long, Long> resultat = new LinkedHashMap<>();
        if (total == 0) return resultat;
        long reparti = 0;
        for (Part p : triees) {
            long part = montant * p.parts() / total;
            resultat.put(p.participantId(), part);
            reparti += part;
        }
        Iterator<Long> ids = resultat.keySet().iterator();
        for (long reste = montant - reparti; reste > 0; reste--) {
            if (!ids.hasNext()) ids = resultat.keySet().iterator();
            resultat.merge(ids.next(), 1L, Long::sum);
        }
        return resultat;
    }

    /** {@code participants} : l'ordre d'affichage des soldes (tous les participants, même à zéro). */
    public static Comptes calculer(List<Long> participants, List<Depense> depenses, List<Versement> versements) {
        Map<Long, long[]> comptes = new LinkedHashMap<>(); // [payé, dû, remboursé, reçu]
        participants.forEach(p -> comptes.put(p, new long[4]));
        long total = 0;
        for (Depense d : depenses) {
            total += d.montantCentimes();
            comptes.computeIfAbsent(d.payeurId(), k -> new long[4])[0] += d.montantCentimes();
            repartir(d.montantCentimes(), d.parts())
                    .forEach((p, part) -> comptes.computeIfAbsent(p, k -> new long[4])[1] += part);
        }
        for (Versement v : versements) {
            comptes.computeIfAbsent(v.deId(), k -> new long[4])[2] += v.montantCentimes();
            comptes.computeIfAbsent(v.aId(), k -> new long[4])[3] += v.montantCentimes();
        }
        List<Solde> soldes = new ArrayList<>();
        comptes.forEach((p, c) -> soldes.add(new Solde(p, c[0], c[1], c[0] - c[1] + c[2] - c[3])));
        return new Comptes(total, soldes, remboursements(soldes));
    }

    /** Ce qui reste à verser ou à recevoir ; {@code id} null : le club. */
    private record Reste(Long id, long montant) {}

    private static List<Remboursement> remboursements(List<Solde> soldes) {
        // Débiteurs et créanciers, du plus gros montant au plus petit (à égalité, par id, le club d'abord).
        Comparator<Reste> ordre = Comparator.comparingLong((Reste x) -> -x.montant())
                .thenComparing(Reste::id, Comparator.nullsFirst(Comparator.naturalOrder()));
        PriorityQueue<Reste> debiteurs = new PriorityQueue<>(ordre);
        PriorityQueue<Reste> creanciers = new PriorityQueue<>(ordre);
        for (Solde s : soldes) {
            if (s.soldeCentimes() < 0) debiteurs.add(new Reste(s.participantId(), -s.soldeCentimes()));
            if (s.soldeCentimes() > 0) creanciers.add(new Reste(s.participantId(), s.soldeCentimes()));
        }
        List<Remboursement> resultat = new ArrayList<>();
        while (!debiteurs.isEmpty() && !creanciers.isEmpty()) {
            Reste d = debiteurs.poll();
            Reste c = creanciers.poll();
            long montant = Math.min(d.montant(), c.montant());
            resultat.add(new Remboursement(d.id(), c.id(), montant));
            if (d.montant() > montant) debiteurs.add(new Reste(d.id(), d.montant() - montant));
            if (c.montant() > montant) creanciers.add(new Reste(c.id(), c.montant() - montant));
        }
        return resultat;
    }

    /** « 1 234,50 € ». */
    public static String euros(long centimes) {
        String signe = centimes < 0 ? "-" : "";
        long abs = Math.abs(centimes);
        String entier = String.format(Locale.FRANCE, "%,d", abs / 100).replace(' ', ' ').replace(' ', ' ');
        return signe + entier + "," + String.format("%02d", abs % 100) + " €";
    }
}
