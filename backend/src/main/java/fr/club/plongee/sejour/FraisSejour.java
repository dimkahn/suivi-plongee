package fr.club.plongee.sejour;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.*;

/**
 * Le partage des frais d'un séjour, en calcul pur (sans base) : la part de
 * chacun dans chaque dépense, son solde, et les remboursements qui
 * remettent les comptes à zéro. Tous les montants sont en centimes.
 * <p>
 * Part de chacun : au prorata des parts, additionnée <b>exactement</b>
 * (en fractions) sur toutes les dépenses, puis arrondie une seule fois au
 * centime : au centime inférieur, et les centimes restants à ceux dont la
 * partie arrondie était la plus grande (à égalité, les premiers ids), pour
 * que la somme des parts fasse exactement le total partagé. Arrondir chaque
 * dépense donnait les centimes restants toujours aux mêmes : jusqu'à
 * plusieurs dizaines de centimes d'écart entre deux personnes aux mêmes parts.
 * Solde = payé − dû + remboursé − reçu : positif, on lui doit de
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
        return arrondir(List.of(new Partage(montant, parts)));
    }

    private record Partage(long montant, List<Part> parts) {}

    /**
     * La part de chacun dans un ensemble de dépenses : la somme exacte de ses
     * fractions, arrondie une seule fois (méthode du plus fort reste).
     */
    private static Map<Long, Long> arrondir(List<Partage> partages) {
        // Dénominateur commun : le PPCM des totaux de parts, pour additionner les fractions sans perte.
        BigInteger commun = BigInteger.ONE;
        for (Partage d : partages) {
            long total = d.parts().stream().mapToLong(Part::parts).sum();
            if (total == 0) continue;
            BigInteger t = BigInteger.valueOf(total);
            commun = commun.divide(commun.gcd(t)).multiply(t);
        }
        Map<Long, BigInteger> exact = new TreeMap<>(); // part × commun, par id croissant
        BigInteger somme = BigInteger.ZERO;
        for (Partage d : partages) {
            long total = d.parts().stream().mapToLong(Part::parts).sum();
            if (total == 0) continue;
            BigInteger facteur = commun.divide(BigInteger.valueOf(total));
            for (Part p : d.parts()) {
                exact.merge(p.participantId(),
                        BigInteger.valueOf(d.montant()).multiply(BigInteger.valueOf(p.parts())).multiply(facteur),
                        BigInteger::add);
            }
            somme = somme.add(BigInteger.valueOf(d.montant()));
        }
        Map<Long, Long> resultat = new LinkedHashMap<>();
        Map<Long, BigInteger> restes = new HashMap<>();
        long reparti = 0;
        for (Map.Entry<Long, BigInteger> e : exact.entrySet()) {
            BigInteger[] qr = e.getValue().divideAndRemainder(commun);
            resultat.put(e.getKey(), qr[0].longValueExact());
            restes.put(e.getKey(), qr[1]);
            reparti += qr[0].longValueExact();
        }
        // Les centimes restants, un chacun, aux plus forts restes ; à égalité, aux premiers ids.
        List<Long> ordre = new ArrayList<>(resultat.keySet());
        ordre.sort(Comparator.comparing((Long id) -> restes.get(id)).reversed()
                .thenComparing(Comparator.naturalOrder()));
        long reste = somme.longValueExact() - reparti;
        for (int i = 0; i < reste; i++) resultat.merge(ordre.get(i % ordre.size()), 1L, Long::sum);
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
        }
        arrondir(depenses.stream().map(d -> new Partage(d.montantCentimes(), d.parts())).toList())
                .forEach((p, part) -> comptes.computeIfAbsent(p, k -> new long[4])[1] += part);
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
