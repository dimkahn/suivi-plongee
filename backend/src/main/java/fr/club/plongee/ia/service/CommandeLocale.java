package fr.club.plongee.ia.service;

import fr.club.plongee.commun.RegleMetierException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Lance une commande courte (git surtout) sur le poste et attend son
 * résultat. Les travaux longs (Claude Code, tests) ne passent pas par ici :
 * ils tournent en arrière-plan, voir {@link AssistantIaService}.
 */
final class CommandeLocale {

    record Resultat(int code, String sortie) {
        boolean reussi() {
            return code == 0;
        }
    }

    private static final long DELAI_SECONDES = 180;

    private CommandeLocale() {
    }

    static Resultat executer(Path dossier, List<String> commande) {
        ProcessBuilder pb = new ProcessBuilder(commande).directory(dossier.toFile()).redirectErrorStream(true);
        // Jamais de question interactive (identifiants, éditeur de message) : le serveur n'a pas de terminal.
        pb.environment().put("GIT_TERMINAL_PROMPT", "0");
        pb.environment().put("GIT_EDITOR", "true");
        try {
            Process p = pb.start();
            p.getOutputStream().close();
            byte[] sortie = p.getInputStream().readAllBytes();
            if (!p.waitFor(DELAI_SECONDES, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new RegleMetierException("La commande « " + String.join(" ", commande)
                        + " » n'a pas répondu en " + DELAI_SECONDES + " secondes.");
            }
            return new Resultat(p.exitValue(), new String(sortie, StandardCharsets.UTF_8).strip());
        } catch (IOException e) {
            throw new RegleMetierException("Impossible de lancer « " + commande.getFirst() + " » sur ce poste : "
                    + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RegleMetierException("Commande interrompue : " + String.join(" ", commande));
        }
    }

    static Resultat git(Path dossier, String... arguments) {
        return executer(dossier, concat("git", arguments));
    }

    /** Comme {@link #git}, mais un échec devient une erreur affichée telle quelle, précédée de {@code contexte}. */
    static String gitExige(Path dossier, String contexte, String... arguments) {
        Resultat r = git(dossier, arguments);
        if (!r.reussi()) throw new RegleMetierException(contexte + " : " + r.sortie());
        return r.sortie();
    }

    private static List<String> concat(String premier, String... suite) {
        String[] tout = new String[suite.length + 1];
        tout[0] = premier;
        System.arraycopy(suite, 0, tout, 1, suite.length);
        return List.of(tout);
    }
}
