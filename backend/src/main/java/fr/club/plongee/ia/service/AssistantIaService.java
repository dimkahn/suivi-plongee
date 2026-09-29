package fr.club.plongee.ia.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.ia.domain.JournalIa;
import fr.club.plongee.ia.domain.SessionIa;
import fr.club.plongee.ia.domain.TypeJournalIa;
import fr.club.plongee.ia.repository.JournalIaRepository;
import fr.club.plongee.ia.repository.SessionIaRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Assistant IA : pilote Claude Code sur ce poste pour faire évoluer le code
 * du club, depuis la page {@code /ia}.
 *
 * <p>Chaque session a sa branche {@code ia/...} et sa copie de travail git
 * (worktree) dans le dossier de travail, hors du dépôt principal : le dépôt
 * du développeur n'est touché qu'au merge. Claude Code y tourne en
 * {@code claude -p}, un processus par message, la conversation reprise
 * par {@code --resume}.
 *
 * <p>Garde-fous. L'assistant écrit du code et commite sur sa branche, rien
 * de plus : il ne peut ni pousser (commandes refusées, et
 * {@code GIT_SSH_COMMAND=false} dans son environnement), ni merger, ni
 * tagger. Ces trois gestes sont des boutons de la page, confirmés par la
 * personne, et le serveur exige un passage de {@code mvn test} vert
 * (inscrit au journal) sur le commit exact qu'on merge ou qu'on tagge.
 * Un tag {@code v…} poussé part en production (outils/surveiller-tags.sh).
 */
@Service
@Profile("dev")
public class AssistantIaService {

    private static final Logger log = LoggerFactory.getLogger(AssistantIaService.class);

    static final String BRANCHE_PRINCIPALE = "master";
    private static final Pattern FORMAT_TAG = Pattern.compile("v(\\d{4})\\.(\\d{2})\\.(\\d+)");
    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");
    private static final int LIGNES_FIN_TESTS = 80;

    /** Ce que l'assistant peut faire sans demander : lire, écrire dans sa copie, compiler, tester, commiter. */
    private static final List<String> OUTILS_AUTORISES = List.of(
            "Read", "Edit", "Write", "Glob", "Grep", "TodoWrite",
            "Bash(mvn:*)", "Bash(npm:*)", "Bash(npx:*)",
            "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)",
            "Bash(git add:*)", "Bash(git commit:*)", "Bash(git rm:*)", "Bash(git mv:*)",
            "Bash(git restore:*)", "Bash(git rebase:*)",
            "Bash(ls:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(wc:*)",
            "Bash(grep:*)", "Bash(find:*)", "Bash(mkdir:*)");

    /**
     * Refusé même si une règle plus large l'autorisait : les gestes
     * réservés à la personne, et ce qui ferait sortir l'assistant de sa branche.
     */
    private static final List<String> OUTILS_INTERDITS = List.of(
            "Bash(git push:*)", "Bash(git merge:*)", "Bash(git tag:*)", "Bash(git branch:*)",
            "Bash(git checkout:*)", "Bash(git switch:*)", "Bash(git update-ref:*)", "Bash(git reset:*)",
            "Bash(git remote:*)", "Bash(git config:*)", "Bash(git worktree:*)", "Bash(git fetch:*)",
            "WebFetch", "WebSearch");

    private static final String CONSIGNES = """
            Tu travailles pour le club de plongée, depuis la page « Assistant IA » de l'application \
            de suivi, à la demande d'un administrateur qui n'est pas forcément développeur. \
            Réponds en français, simplement.
            Tu es dans une copie de travail git dédiée (worktree), sur la branche %s, partie de master. \
            Respecte CLAUDE.md. Commite ton travail sur cette branche avec des messages clairs en français.
            Tu ne peux ni pousser, ni merger, ni créer de tag, ni changer de branche : ces commandes te \
            seront refusées. La personne le fait depuis la page, avec les boutons « Lancer les tests », \
            « Merger sur master » puis « Créer le tag et pousser » ; le serveur exige que mvn test passe \
            sur le commit exact avant le merge. Quand la fonctionnalité est prête : commite tout (la \
            copie doit être propre), vérifie toi-même que mvn test passe, puis dis-le en résumant ce qui \
            a changé. Si master a avancé et que le merge est refusé, on te demandera de rebaser \
            (git rebase master).
            Les pièces jointes des messages (captures d'écran, documents) sont dans un dossier hors du \
            dépôt, dont les chemins sont donnés dans le message : lis-les avec l'outil Read. Ne les \
            ajoute au dépôt que si on te le demande, en les copiant à leur place.""";

    /** Un fichier joint à un message, tel que reçu du navigateur. */
    public record PieceJointe(String nom, byte[] contenu) {}

    static final int PIECES_MAX_PAR_MESSAGE = 10;
    static final long TAILLE_MAX_PIECE_OCTETS = 20L * 1024 * 1024;

    /** Un travail en arrière-plan sur une session : l'assistant qui répond, ou les tests. */
    private record Travail(String nature, Process processus) {}

    public record Etat(String depot, String brancheCourante, String dossierTravail) {}

    public record Livraison(String branche, String brancheSha, String masterSha, List<String> commits,
                            String resumeModifications, boolean copiePropre, boolean brancheTestee,
                            boolean dansMaster, boolean masterTeste, String tagSuggere, String travailEnCours) {}

    private final SessionIaRepository sessions;
    private final JournalIaRepository journal;
    private final UtilisateurRepository utilisateurs;
    private final JournalIaService journaliste;
    private final ObjectMapper json;
    private final Path depot;
    private final Path dossierTravail;
    private final String claude;
    private final String mvn;

    private final Map<Long, Travail> travaux = new ConcurrentHashMap<>();

    public AssistantIaService(SessionIaRepository sessions, JournalIaRepository journal,
                              UtilisateurRepository utilisateurs, JournalIaService journaliste, ObjectMapper json,
                              @Value("${app.ia.depot}") String depot,
                              @Value("${app.ia.dossier-travail}") String dossierTravail,
                              @Value("${app.ia.claude}") String claude,
                              @Value("${app.ia.mvn}") String mvn) {
        this.sessions = sessions;
        this.journal = journal;
        this.utilisateurs = utilisateurs;
        this.journaliste = journaliste;
        this.json = json;
        this.depot = Path.of(depot).toAbsolutePath().normalize();
        this.dossierTravail = Path.of(dossierTravail).toAbsolutePath().normalize();
        this.claude = claude;
        this.mvn = mvn;
    }

    public Etat etat() {
        CommandeLocale.Resultat r = CommandeLocale.git(depot, "symbolic-ref", "--short", "-q", "HEAD");
        return new Etat(depot.toString(), r.reussi() ? r.sortie() : null, dossierTravail.toString());
    }

    @Transactional(readOnly = true)
    public List<SessionIa> sessions() {
        return sessions.toutesRecentesDabord();
    }

    /** Nature du travail en cours sur la session (« assistant », « tests »), ou nul. */
    public String travailEnCours(Long sessionId) {
        Travail t = travaux.get(sessionId);
        return t == null || !t.processus().isAlive() ? null : t.nature();
    }

    @Transactional(readOnly = true)
    public List<JournalIa> journal(Long sessionId, long apres) {
        session(sessionId);
        return journal.suite(sessionId, apres);
    }

    /** Nouvelle session : une branche {@code ia/...} partie de master, dans sa propre copie de travail. */
    @Transactional
    public SessionIa creer(String titre, Long auteurId) {
        String propre = titre == null ? "" : titre.strip();
        if (propre.isEmpty()) throw new RegleMetierException("Donnez un titre à la session (ce que vous voulez faire).");
        if (propre.length() > 120) throw new RegleMetierException("Titre trop long : 120 caractères au plus.");

        String base = "ia/" + LocalDateTime.now(PARIS).format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm"))
                + "-" + slug(propre);
        String branche = base;
        for (int i = 2; sessions.existsByBranche(branche)
                || CommandeLocale.git(depot, "rev-parse", "-q", "--verify", "refs/heads/" + branche).reussi(); i++) {
            branche = base + "-" + i;
        }
        Path dossier = dossierTravail.resolve(branche.replace('/', '-'));
        if (Files.exists(dossier)) {
            throw new RegleMetierException("Le dossier " + dossier + " existe déjà : supprimez-le ou changez de titre.");
        }
        try {
            Files.createDirectories(dossierTravail);
        } catch (IOException e) {
            throw new RegleMetierException("Impossible de créer le dossier de travail " + dossierTravail + " : "
                    + e.getMessage());
        }
        CommandeLocale.gitExige(depot, "La copie de travail n'a pas pu être créée",
                "worktree", "add", "-b", branche, dossier.toString(), BRANCHE_PRINCIPALE);

        return sessions.save(new SessionIa(propre, branche, dossier.toString(), UUID.randomUUID().toString(),
                utilisateurs.findById(auteurId).orElseThrow()));
    }

    /** Envoie un message à l'assistant ; sa réponse arrive dans le journal au fil de l'eau. */
    public void envoyer(Long sessionId, String texte, Long auteurId) {
        envoyer(sessionId, texte, List.of(), auteurId);
    }

    /**
     * Envoie un message, avec d'éventuelles pièces jointes ; la réponse
     * arrive dans le journal au fil de l'eau. Les pièces sont enregistrées
     * hors du dépôt, dans le dossier {@code …-pieces} de la session, que
     * Claude Code peut lire ({@code --add-dir}) ; leurs chemins sont ajoutés
     * au message.
     */
    public void envoyer(Long sessionId, String texte, List<PieceJointe> pieces, Long auteurId) {
        SessionIa s = session(sessionId);
        boolean sansTexte = texte == null || texte.isBlank();
        if (sansTexte && pieces.isEmpty()) throw new RegleMetierException("Le message est vide.");
        if (pieces.size() > PIECES_MAX_PAR_MESSAGE) {
            throw new RegleMetierException("Pas plus de " + PIECES_MAX_PAR_MESSAGE + " fichiers par message.");
        }
        for (PieceJointe piece : pieces) {
            if (piece.contenu().length == 0) throw new RegleMetierException("Le fichier « " + piece.nom() + " » est vide.");
            if (piece.contenu().length > TAILLE_MAX_PIECE_OCTETS) {
                throw new RegleMetierException("Le fichier « " + piece.nom() + " » dépasse "
                        + TAILLE_MAX_PIECE_OCTETS / (1024 * 1024) + " Mo.");
            }
        }
        exigerLibre(sessionId);
        boolean premier = !journal.existsBySessionIdAndType(sessionId, TypeJournalIa.MESSAGE);

        Path dossierPieces = dossierPieces(s);
        List<String> cheminsPieces = new ArrayList<>();
        List<String> resumePieces = new ArrayList<>();
        if (!pieces.isEmpty()) {
            String horodatage = LocalDateTime.now(PARIS).format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
            try {
                Files.createDirectories(dossierPieces);
                for (int i = 0; i < pieces.size(); i++) {
                    PieceJointe piece = pieces.get(i);
                    Path cible = dossierPieces.resolve(horodatage + "-" + (i + 1) + "-" + nomDeFichier(piece.nom()));
                    Files.write(cible, piece.contenu());
                    cheminsPieces.add(cible.toString());
                    resumePieces.add(piece.nom() + " (" + taille(piece.contenu().length) + ")");
                }
            } catch (IOException e) {
                throw new RegleMetierException("Les pièces jointes n'ont pas pu être enregistrées : " + e.getMessage());
            }
        }
        String demande = sansTexte ? "Voici des fichiers." : texte.strip();
        String consigne = cheminsPieces.isEmpty() ? demande : demande
                + "\n\nPièces jointes (à lire avec l'outil Read) :\n- " + String.join("\n- ", cheminsPieces);
        String pourLeJournal = resumePieces.isEmpty() ? demande : demande
                + "\n\nPièces jointes : " + String.join(", ", resumePieces);

        List<String> commande = new ArrayList<>(List.of(claude, "-p",
                "--output-format", "stream-json", "--verbose",
                "--permission-mode", "acceptEdits",
                "--append-system-prompt", CONSIGNES.formatted(s.getBranche())));
        commande.addAll(premier ? List.of("--session-id", s.getClaudeSessionId())
                                : List.of("--resume", s.getClaudeSessionId()));
        if (!cheminsPieces.isEmpty() || Files.isDirectory(dossierPieces)) {
            // Lecture des pièces jointes de la session, y compris celles des messages précédents.
            commande.addAll(List.of("--add-dir", dossierPieces.toString()));
        }
        commande.add("--allowedTools");
        commande.addAll(OUTILS_AUTORISES);
        commande.add("--disallowedTools");
        commande.addAll(OUTILS_INTERDITS);

        ProcessBuilder pb = new ProcessBuilder(commande).directory(Path.of(s.getDossier()).toFile())
                .redirectErrorStream(true);
        // Deuxième verrou sur le push, indépendant des règles de Claude Code : aucune connexion SSH possible.
        pb.environment().put("GIT_SSH_COMMAND", "false");
        pb.environment().put("GIT_TERMINAL_PROMPT", "0");

        journaliste.noter(sessionId, TypeJournalIa.MESSAGE, pourLeJournal, null, auteurId);
        Process p;
        try {
            p = pb.start();
            // Le message passe par l'entrée standard : --allowedTools, variadique, avalerait un argument final.
            try (OutputStream entree = p.getOutputStream()) {
                entree.write(consigne.getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException e) {
            journaliste.noter(sessionId, TypeJournalIa.ERREUR, "Claude Code n'a pas pu être lancé : " + e.getMessage(),
                    null, null);
            throw new RegleMetierException("Impossible de lancer Claude Code (« " + claude + " ») sur ce poste : "
                    + "vérifiez qu'il est installé et connecté (claude, puis /login).");
        }
        Travail travail = new Travail("assistant", p);
        travaux.put(sessionId, travail);
        Thread.ofVirtual().name("assistant-ia-" + sessionId).start(() -> suivreAssistant(sessionId, s.getDossier(), travail));
    }

    public void arreter(Long sessionId, Long auteurId) {
        session(sessionId);
        Travail t = travaux.get(sessionId);
        if (t == null || !t.processus().isAlive()) throw new RegleMetierException("Rien n'est en cours sur cette session.");
        // Supprimé d'abord : le fil de suivi sait ainsi que l'arrêt est voulu, pas une panne.
        travaux.remove(sessionId, t);
        t.processus().descendants().forEach(ProcessHandle::destroy);
        t.processus().destroy();
        journaliste.noter(sessionId, TypeJournalIa.ARRET,
                t.nature().equals("tests") ? "Tests interrompus." : "Réponse de l'assistant interrompue.", null, auteurId);
    }

    /** Lance {@code mvn test} (frontend compris, via le pom racine) sur le dernier commit de la branche. */
    public void lancerTests(Long sessionId, Long auteurId) {
        SessionIa s = session(sessionId);
        exigerLibre(sessionId);
        Path dossier = Path.of(s.getDossier());
        exigerCopiePropre(dossier);
        String sha = CommandeLocale.gitExige(dossier, "Commit introuvable", "rev-parse", "HEAD");
        Path sortie = dossierTravail.resolve(dossier.getFileName() + "-tests.log");

        ProcessBuilder pb = new ProcessBuilder(mvn, "-B", "test").directory(dossier.toFile())
                .redirectErrorStream(true).redirectOutput(sortie.toFile());
        pb.environment().put("GIT_SSH_COMMAND", "false");
        Process p;
        try {
            p = pb.start();
            p.getOutputStream().close();
        } catch (IOException e) {
            throw new RegleMetierException("Impossible de lancer Maven (« " + mvn + " ») : " + e.getMessage());
        }
        journaliste.noter(sessionId, TypeJournalIa.TESTS_LANCES,
                "mvn test sur " + court(sha) + " (sortie complète : " + sortie + ")", sha, auteurId);
        Travail travail = new Travail("tests", p);
        travaux.put(sessionId, travail);
        Instant debut = Instant.now();
        Thread.ofVirtual().name("tests-ia-" + sessionId).start(() -> {
            try {
                int code = p.waitFor();
                if (!travaux.remove(sessionId, travail)) return; // interrompus : déjà journalisé
                String duree = duree(Duration.between(debut, Instant.now()));
                if (code == 0) {
                    journaliste.noter(sessionId, TypeJournalIa.TESTS_OK,
                            "Tests verts sur " + court(sha) + " en " + duree + ".", sha, null);
                } else {
                    journaliste.noter(sessionId, TypeJournalIa.TESTS_KO, "Tests en échec sur " + court(sha)
                            + " (" + duree + "). Fin de la sortie :\n" + fin(sortie, LIGNES_FIN_TESTS), sha, null);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (RuntimeException e) {
                log.error("Suivi des tests de la session IA {}", sessionId, e);
            }
        });
    }

    @Transactional(readOnly = true)
    public Livraison livraison(Long sessionId) {
        SessionIa s = session(sessionId);
        Path dossier = Path.of(s.getDossier());
        String branche = s.getBranche();
        String brancheSha = CommandeLocale.gitExige(depot, "Branche introuvable", "rev-parse", branche);
        String masterSha = CommandeLocale.gitExige(depot, "master introuvable", "rev-parse", BRANCHE_PRINCIPALE);
        String log = CommandeLocale.git(depot, "log", "--format=%h %s", BRANCHE_PRINCIPALE + ".." + branche).sortie();
        List<String> commits = log.isBlank() ? List.of() : List.of(log.split("\n"));
        String resume = CommandeLocale.git(depot, "diff", "--stat", BRANCHE_PRINCIPALE + "..." + branche).sortie();
        boolean propre = Files.isDirectory(dossier)
                && CommandeLocale.git(dossier, "status", "--porcelain").sortie().isBlank();
        boolean dansMaster = CommandeLocale.git(depot, "merge-base", "--is-ancestor", brancheSha, masterSha).reussi();
        return new Livraison(branche, brancheSha, masterSha, commits, resume, propre,
                journal.existsByTypeAndCommitSha(TypeJournalIa.TESTS_OK, brancheSha), dansMaster,
                journal.existsByTypeAndCommitSha(TypeJournalIa.TESTS_OK, masterSha),
                tagSuggere(), travailEnCours(sessionId));
    }

    /**
     * Amène master sur le dernier commit de la branche, en avance rapide
     * seulement : master devient exactement le commit testé. Si master a
     * avancé entre-temps, l'assistant rebase et on reteste.
     */
    public void merger(Long sessionId, Long auteurId) {
        SessionIa s = session(sessionId);
        exigerLibre(sessionId);
        exigerCopiePropre(Path.of(s.getDossier()));
        String branche = s.getBranche();
        String sha = CommandeLocale.gitExige(depot, "Branche introuvable", "rev-parse", branche);
        String masterSha = CommandeLocale.gitExige(depot, "master introuvable", "rev-parse", BRANCHE_PRINCIPALE);
        if (sha.equals(masterSha) || CommandeLocale.git(depot, "merge-base", "--is-ancestor", sha, masterSha).reussi()) {
            throw new RegleMetierException("Rien à merger : master contient déjà tout le travail de cette branche.");
        }
        if (!journal.existsByTypeAndCommitSha(TypeJournalIa.TESTS_OK, sha)) {
            throw new RegleMetierException("Les tests n'ont pas été passés avec succès sur le dernier commit de la "
                    + "branche (" + court(sha) + ") : lancez-les d'abord.");
        }
        if (!CommandeLocale.git(depot, "merge-base", "--is-ancestor", masterSha, sha).reussi()) {
            throw new RegleMetierException("master a avancé depuis le début de cette branche : demandez à "
                    + "l'assistant de rebaser son travail sur master (git rebase master), puis relancez les tests.");
        }

        CommandeLocale.Resultat courante = CommandeLocale.git(depot, "symbolic-ref", "--short", "-q", "HEAD");
        if (courante.reussi() && courante.sortie().equals(BRANCHE_PRINCIPALE)) {
            // master est extrait dans le dépôt principal : on avance aussi ses fichiers.
            if (!CommandeLocale.git(depot, "status", "--porcelain", "--untracked-files=no").sortie().isBlank()) {
                throw new RegleMetierException("Le dépôt principal (" + depot + ") a des modifications non "
                        + "commitées sur master : commitez-les ou mettez-les de côté avant de merger.");
            }
            CommandeLocale.gitExige(depot, "Le merge a échoué", "merge", "--ff-only", branche);
        } else {
            // master n'est pas extrait : on déplace la référence, git refuse tout ce qui n'est pas une avance rapide.
            CommandeLocale.gitExige(depot, "Le merge a échoué", "fetch", ".", branche + ":" + BRANCHE_PRINCIPALE);
        }
        journaliste.noter(sessionId, TypeJournalIa.MERGE,
                branche + " mergée sur master (avance rapide jusqu'à " + court(sha) + "). Rien n'est encore poussé.",
                sha, auteurId);
    }

    /**
     * Tague master et pousse master avec le tag, en une fois. Le tag part en
     * production (surveiller-tags.sh sur le serveur, toutes les 5 minutes).
     */
    public void taggerEtPousser(Long sessionId, String tag, Long auteurId) {
        session(sessionId);
        exigerLibre(sessionId);
        if (tag == null || !FORMAT_TAG.matcher(tag).matches()) {
            throw new RegleMetierException("Tag attendu sous la forme vAAAA.MM.N, par exemple " + tagSuggere() + ".");
        }
        if (CommandeLocale.git(depot, "rev-parse", "-q", "--verify", "refs/tags/" + tag).reussi()) {
            throw new RegleMetierException("Le tag " + tag + " existe déjà : prenez-en un autre (" + tagSuggere() + ").");
        }
        String masterSha = CommandeLocale.gitExige(depot, "master introuvable", "rev-parse", BRANCHE_PRINCIPALE);
        if (!journal.existsByTypeAndCommitSha(TypeJournalIa.TESTS_OK, masterSha)) {
            throw new RegleMetierException("master (" + court(masterSha) + ") n'a pas de passage de tests vert "
                    + "enregistré : seul un commit testé depuis cette page peut partir en production.");
        }
        CommandeLocale.gitExige(depot, "Le tag n'a pas pu être créé", "tag", "-a", tag, "-m", tag, masterSha);
        CommandeLocale.Resultat push = CommandeLocale.git(depot, "push", "--atomic", "origin",
                BRANCHE_PRINCIPALE, "refs/tags/" + tag);
        if (!push.reussi()) {
            // Un tag local non poussé serait repris par erreur au prochain essai : on le retire.
            CommandeLocale.git(depot, "tag", "-d", tag);
            throw new RegleMetierException("Le push vers GitHub a échoué, rien n'est parti en production : "
                    + push.sortie());
        }
        journaliste.noter(sessionId, TypeJournalIa.TAG_POUSSE, "master et le tag " + tag + " poussés sur GitHub ("
                + court(masterSha) + "). Mise en production par le serveur dans les 5 minutes.", masterSha, auteurId);
    }

    /** Prochain tag du mois : vAAAA.MM.N, N suivant le plus grand déjà posé ce mois-ci. */
    String tagSuggere() {
        String prefixe = "v" + LocalDateTime.now(PARIS).format(DateTimeFormatter.ofPattern("yyyy.MM")) + ".";
        int max = 0;
        for (String t : CommandeLocale.git(depot, "tag", "--list", prefixe + "*").sortie().split("\n")) {
            Matcher m = FORMAT_TAG.matcher(t.strip());
            if (m.matches() && t.strip().startsWith(prefixe)) max = Math.max(max, Integer.parseInt(m.group(3)));
        }
        return prefixe + (max + 1);
    }

    @PreDestroy
    void arreterTout() {
        travaux.values().forEach(t -> {
            t.processus().descendants().forEach(ProcessHandle::destroy);
            t.processus().destroy();
        });
    }

    // ---------------------------------------------------------------
    //  Lecture de la sortie de Claude Code (--output-format stream-json)
    // ---------------------------------------------------------------

    private void suivreAssistant(Long sessionId, String dossier, Travail travail) {
        Deque<String> horsJson = new ArrayDeque<>();
        boolean termine = false;
        try (BufferedReader lecteur = new BufferedReader(
                new InputStreamReader(travail.processus().getInputStream(), StandardCharsets.UTF_8))) {
            String ligne;
            while ((ligne = lecteur.readLine()) != null) {
                if (ligne.isBlank()) continue;
                JsonNode evenement;
                try {
                    evenement = json.readTree(ligne);
                } catch (JacksonException e) {
                    horsJson.addLast(ligne);
                    if (horsJson.size() > 30) horsJson.removeFirst();
                    continue;
                }
                termine |= traiter(sessionId, dossier, evenement);
            }
            int code = travail.processus().waitFor();
            boolean voulu = !travaux.remove(sessionId, travail);
            if (!voulu && !termine && code != 0) {
                journaliste.noter(sessionId, TypeJournalIa.ERREUR, "L'assistant s'est arrêté (code " + code + ")."
                        + (horsJson.isEmpty() ? "" : "\n" + String.join("\n", horsJson)), null, null);
            }
        } catch (IOException e) {
            travaux.remove(sessionId, travail);
            log.warn("Lecture de la sortie de Claude Code (session IA {}) : {}", sessionId, e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException e) {
            travaux.remove(sessionId, travail);
            log.error("Suivi de l'assistant (session IA {})", sessionId, e);
        }
    }

    /** Inscrit un événement au journal ; vrai quand c'est la fin du tour. */
    private boolean traiter(Long sessionId, String dossier, JsonNode e) {
        switch (e.path("type").asText()) {
            case "assistant" -> {
                for (JsonNode bloc : e.path("message").path("content")) {
                    switch (bloc.path("type").asText()) {
                        case "text" -> {
                            String texte = bloc.path("text").asText().strip();
                            if (!texte.isEmpty()) journaliste.noter(sessionId, TypeJournalIa.TEXTE, texte, null, null);
                        }
                        case "tool_use" -> journaliste.noter(sessionId, TypeJournalIa.OUTIL,
                                resumeOutil(dossier, bloc.path("name").asText(), bloc.path("input")), null, null);
                        default -> { }
                    }
                }
            }
            case "user" -> {
                for (JsonNode bloc : e.path("message").path("content")) {
                    if (bloc.path("type").asText().equals("tool_result") && bloc.path("is_error").asBoolean(false)) {
                        journaliste.noter(sessionId, TypeJournalIa.OUTIL_ERREUR, texteResultat(bloc.path("content")),
                                null, null);
                    }
                }
            }
            case "result" -> {
                if (e.path("is_error").asBoolean(false)) {
                    journaliste.noter(sessionId, TypeJournalIa.ERREUR,
                            "L'assistant s'est arrêté sur une erreur : " + e.path("result").asText(e.path("subtype").asText()),
                            null, null);
                } else {
                    journaliste.noter(sessionId, TypeJournalIa.FIN, "Terminé en "
                            + duree(Duration.ofMillis(e.path("duration_ms").asLong(0))) + ".", null, null);
                }
                return true;
            }
            default -> { }
        }
        return false;
    }

    private static String resumeOutil(String dossier, String nom, JsonNode entree) {
        String detail = null;
        for (String champ : List.of("command", "file_path", "pattern", "path", "description")) {
            if (entree.hasNonNull(champ)) {
                detail = entree.get(champ).asText();
                break;
            }
        }
        if (detail == null) return nom;
        detail = detail.replace(dossier + "/", "");
        return nom + " : " + (detail.length() > 500 ? detail.substring(0, 500) + "…" : detail);
    }

    private static String texteResultat(JsonNode contenu) {
        if (!contenu.isArray()) return contenu.asText();
        StringBuilder sb = new StringBuilder();
        for (JsonNode c : contenu) if (c.has("text")) sb.append(c.get("text").asText()).append('\n');
        String t = sb.toString().strip();
        return t.length() > 2000 ? t.substring(0, 2000) + "…" : t;
    }

    // ---------------------------------------------------------------

    private SessionIa session(Long id) {
        return sessions.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Session introuvable."));
    }

    private void exigerLibre(Long sessionId) {
        String enCours = travailEnCours(sessionId);
        if (enCours != null) {
            throw new RegleMetierException(enCours.equals("tests")
                    ? "Les tests tournent encore sur cette session : attendez la fin ou interrompez-les."
                    : "L'assistant travaille encore sur cette session : attendez sa réponse ou interrompez-le.");
        }
    }

    private static void exigerCopiePropre(Path dossier) {
        if (!Files.isDirectory(dossier)) {
            throw new RegleMetierException("La copie de travail " + dossier + " n'existe plus.");
        }
        if (!CommandeLocale.git(dossier, "status", "--porcelain").sortie().isBlank()) {
            throw new RegleMetierException("La copie de travail a des modifications non commitées : demandez à "
                    + "l'assistant de les commiter (ou de les annuler) d'abord. Seul un commit se teste et se merge.");
        }
    }

    /** À côté de la copie de travail, jamais dedans : une pièce jointe ne doit pas finir commitée par erreur. */
    private Path dossierPieces(SessionIa s) {
        return dossierTravail.resolve(Path.of(s.getDossier()).getFileName() + "-pieces");
    }

    /** Nom sûr : sans chemin (« ../ »), sans accents ni caractères spéciaux, extension gardée. */
    static String nomDeFichier(String nom) {
        String base = nom == null ? "" : nom.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1);
        base = Normalizer.normalize(base, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^[._]+", "");
        if (base.length() > 80) base = base.substring(base.length() - 80);
        return base.isEmpty() ? "fichier" : base;
    }

    private static String taille(long octets) {
        if (octets < 1024) return octets + " o";
        if (octets < 1024 * 1024) return (octets / 1024) + " Ko";
        return String.format(java.util.Locale.FRANCE, "%.1f Mo", octets / (1024.0 * 1024));
    }

    static String slug(String titre) {
        String s = Normalizer.normalize(titre, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (s.length() > 40) s = s.substring(0, 40).replaceAll("-$", "");
        return s.isEmpty() ? "session" : s;
    }

    private static String court(String sha) {
        return sha.length() > 8 ? sha.substring(0, 8) : sha;
    }

    private static String duree(Duration d) {
        long s = d.toSeconds();
        return s < 60 ? s + " s" : (s / 60) + " min " + (s % 60) + " s";
    }

    private static String fin(Path fichier, int lignes) {
        try {
            List<String> tout = Files.readAllLines(fichier, StandardCharsets.UTF_8);
            return String.join("\n", tout.subList(Math.max(0, tout.size() - lignes), tout.size()));
        } catch (IOException e) {
            return "(sortie illisible : " + e.getMessage() + ")";
        }
    }
}
