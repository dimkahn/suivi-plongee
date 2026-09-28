package fr.club.plongee.ia.domain;

/** Nature d'une ligne du journal de l'assistant IA. */
public enum TypeJournalIa {
    /** Message écrit par la personne. */
    MESSAGE,
    /** Réponse de l'assistant. */
    TEXTE,
    /** Outil lancé par l'assistant (commande, fichier lu ou modifié). */
    OUTIL,
    /** Outil en échec ou refusé (commande hors de la liste autorisée, par exemple). */
    OUTIL_ERREUR,
    /** Fin d'un tour de l'assistant (durée, coût). */
    FIN,
    ERREUR,
    /** Tour interrompu par la personne. */
    ARRET,
    TESTS_LANCES,
    /** Tests verts : {@code commitSha} est le commit testé, seul autorisé au merge et au tag. */
    TESTS_OK,
    TESTS_KO,
    MERGE,
    TAG_POUSSE
}
