package fr.club.plongee.notification.courriel;

import fr.club.plongee.identite.IdentiteStructureService;

/** L'identité de la structure pour les tests, sans base : couleurs données, logo de quelques octets. */
public class IdentiteDonnee extends IdentiteStructureService {
    private final String principale, foncee, accent;

    public IdentiteDonnee(String principale, String foncee, String accent) {
        super(null, "Club de plongée d'essai");
        this.principale = principale;
        this.foncee = foncee;
        this.accent = accent;
    }

    /** Les couleurs d'origine. */
    public IdentiteDonnee() {
        this(null, null, null);
    }

    @Override
    public IdentiteVue lire() {
        return new IdentiteVue(null, null, null, principale, foncee, accent, false, 0);
    }

    @Override
    public String nom() {
        return "Club de plongée d'essai";
    }

    @Override
    public byte[] logoPng() {
        return new byte[] {1, 2, 3};
    }
}
