package fr.club.plongee.ia.domain;

import fr.club.plongee.securite.domain.Utilisateur;
import jakarta.persistence.*;

import java.time.Instant;

/**
 * Une ligne du journal d'une session de l'assistant IA. Table en AJOUT
 * SEUL, comme {@code evaluation} : c'est la trace de qui a demandé quoi,
 * de ce que l'assistant a exécuté, et la preuve que les tests sont passés
 * sur un commit avant son merge ou son tag.
 */
@Entity
public class JournalIa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private SessionIa session;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TypeJournalIa type;

    @Column(columnDefinition = "text")
    private String contenu;

    @Column(length = 40)
    private String commitSha;

    /** Nul pour ce qui vient de l'assistant. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auteur_id")
    private Utilisateur auteur;

    @Column(nullable = false)
    private Instant creeLe = Instant.now();

    protected JournalIa() {
    }

    public JournalIa(SessionIa session, TypeJournalIa type, String contenu, String commitSha, Utilisateur auteur) {
        this.session = session;
        this.type = type;
        this.contenu = contenu;
        this.commitSha = commitSha;
        this.auteur = auteur;
    }

    public Long getId() {
        return id;
    }

    public SessionIa getSession() {
        return session;
    }

    public TypeJournalIa getType() {
        return type;
    }

    public String getContenu() {
        return contenu;
    }

    public String getCommitSha() {
        return commitSha;
    }

    public Utilisateur getAuteur() {
        return auteur;
    }

    public Instant getCreeLe() {
        return creeLe;
    }
}
