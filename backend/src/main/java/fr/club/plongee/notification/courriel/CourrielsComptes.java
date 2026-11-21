package fr.club.plongee.notification.courriel;

/**
 * Les e-mails des comptes (mot de passe oublié, invitation d'un moniteur),
 * écrits une fois pour l'envoi réel et pour l'aperçu du profil dev.
 */
public final class CourrielsComptes {

    public static final String SUJET_REINITIALISATION = "Réinitialisation de votre mot de passe";
    public static final String SUJET_INVITATION = "Bienvenue : créez votre mot de passe";

    private CourrielsComptes() {}

    public static Courriel reinitialisation(String prenom, String lien) {
        return Courriel.titre("Votre mot de passe").bonjour(prenom)
                .paragraphe("Une réinitialisation de mot de passe a été demandée pour votre compte du club.")
                .bouton("Choisir un nouveau mot de passe", lien)
                .note("Ce lien est valable une heure. Si vous n'êtes pas à l'origine de cette demande, "
                        + "ignorez ce message : votre mot de passe ne change pas.");
    }

    public static Courriel invitation(String prenom, String lien) {
        return Courriel.titre("Bienvenue").bonjour(prenom)
                .paragraphe("Un compte moniteur vient d'être créé pour vous sur le suivi des formations du club.")
                .bouton("Créer mon mot de passe", lien)
                .note("Ce lien, valable une heure, vous permet de choisir votre mot de passe.");
    }
}
