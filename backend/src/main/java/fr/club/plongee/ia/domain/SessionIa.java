package fr.club.plongee.ia.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.Instant;

/**
 * Une conversation avec l'assistant IA : une branche {@code ia/...}, sa
 * copie de travail git (worktree) et l'identifiant de conversation Claude
 * Code repris à chaque message. Rien n'y change après la création : ce qui
 * se passe ensuite est dans {@link JournalIa}.
 */
@Entity
public class SessionIa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String titre;

    @Column(nullable = false, length = 120, unique = true)
    private String branche;

    @Column(nullable = false, length = 500)
    private String dossier;

    @Column(nullable = false, length = 36)
    private String claudeSessionId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "cree_par_id")
    private Utilisateur creePar;

    @Column(nullable = false)
    private Instant creeLe = Instant.now();

    protected SessionIa() {
    }

    public SessionIa(String titre, String branche, String dossier, String claudeSessionId, Utilisateur creePar) {
        this.titre = titre;
        this.branche = branche;
        this.dossier = dossier;
        this.claudeSessionId = claudeSessionId;
        this.creePar = creePar;
    }

    public Long getId() {
        return id;
    }

    public String getTitre() {
        return titre;
    }

    public String getBranche() {
        return branche;
    }

    public String getDossier() {
        return dossier;
    }

    public String getClaudeSessionId() {
        return claudeSessionId;
    }

    public Utilisateur getCreePar() {
        return creePar;
    }

    public Instant getCreeLe() {
        return creeLe;
    }
}
