package fr.club.plongee.ia.service;

import fr.club.plongee.ia.domain.JournalIa;
import fr.club.plongee.ia.domain.TypeJournalIa;
import fr.club.plongee.ia.repository.JournalIaRepository;
import fr.club.plongee.ia.repository.SessionIaRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Écrit le journal de l'assistant IA : en base (table en ajout seul), et
 * recopié dans {@code journal.log} du dossier de travail. La base du profil
 * dev est en mémoire et repart de zéro à chaque démarrage ; le fichier,
 * lui, garde la trace d'un démarrage à l'autre.
 *
 * <p>Appelé aussi depuis les fils qui lisent la sortie de Claude Code et
 * des tests : chaque ligne est sa propre transaction.
 */
@Service
@ConditionalOnProperty(name = "app.ia.active", havingValue = "true")
public class JournalIaService {

    private static final Logger log = LoggerFactory.getLogger(JournalIaService.class);
    private static final int LONGUEUR_MAX = 20_000;

    private final JournalIaRepository journal;
    private final SessionIaRepository sessions;
    private final UtilisateurRepository utilisateurs;
    private final Path fichier;

    public JournalIaService(JournalIaRepository journal, SessionIaRepository sessions,
                            UtilisateurRepository utilisateurs,
                            @Value("${app.ia.dossier-travail}") String dossierTravail) {
        this.journal = journal;
        this.sessions = sessions;
        this.utilisateurs = utilisateurs;
        this.fichier = Path.of(dossierTravail).resolve("journal.log");
    }

    @Transactional
    public JournalIa noter(Long sessionId, TypeJournalIa type, String contenu, String commitSha, Long auteurId) {
        String texte = contenu != null && contenu.length() > LONGUEUR_MAX
                ? contenu.substring(0, LONGUEUR_MAX) + "\n… (tronqué)"
                : contenu;
        JournalIa ligne = journal.save(new JournalIa(sessions.getReferenceById(sessionId), type, texte, commitSha,
                auteurId == null ? null : utilisateurs.getReferenceById(auteurId)));
        recopier(sessionId, type, texte, commitSha, auteurId);
        return ligne;
    }

    /**
     * Événements qui ne relèvent d'aucune session (code d'accès demandé,
     * accès ouvert ou refermé) : dans journal.log seulement, la table
     * journal_ia étant rattachée à une session.
     */
    public void noterHorsSession(String texte) {
        ecrire("%s ACCES %s%n".formatted(OffsetDateTime.now(ZoneId.of("Europe/Paris")), texte));
    }

    private void recopier(Long sessionId, TypeJournalIa type, String contenu, String commitSha, Long auteurId) {
        ecrire("%s session=%d %s auteur=%s%s %s%n".formatted(
                OffsetDateTime.now(ZoneId.of("Europe/Paris")), sessionId, type,
                auteurId == null ? "assistant" : auteurId,
                commitSha == null ? "" : " commit=" + commitSha,
                contenu == null ? "" : contenu.replace("\n", "\n    ")));
    }

    private synchronized void ecrire(String ligne) {
        try {
            Files.createDirectories(fichier.getParent());
            Files.writeString(fichier, ligne, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            log.warn("Journal de l'assistant IA non recopié dans {} : {}", fichier, e.getMessage());
        }
    }
}
