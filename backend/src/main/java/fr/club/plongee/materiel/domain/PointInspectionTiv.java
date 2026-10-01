package fr.club.plongee.materiel.domain;

/**
 * Les questions de la fiche d'évaluation et de suivi d'une bouteille,
 * reprises de l'onglet « FICHE D'EVALUATION ET DE SUIVI » du classeur du
 * club, complétées d'après le manuel de formation TIV de la FFESSM (UC8.2,
 * UC11, UC12) : appairage des filetages bouteille/robinet, remontage, marques
 * lisibles, col des bouteilles en aluminium, propreté « service oxygène ».
 *
 * <p>Chaque question se répond par oui ou non, comme sur la fiche papier ;
 * {@code reponseNormale} est la réponse d'une bouteille sans défaut. Un
 * défaut propose une action (la colonne « Décision » de la fiche) ; ceux
 * marqués {@code interditAvisFavorable} imposent un avis défavorable ou le
 * rebut. Ajouter une question ici suffit : la saisie et la fiche imprimée
 * se construisent à partir de cette liste.
 */
public enum PointInspectionTiv {
    // Robinetterie
    RESERVE_FONCTIONNE(Section.ROBINETTERIE, "La réserve fonctionne bien", true, "À réparer", false),
    ROBINET_DEMONTE_AISEMENT(Section.ROBINETTERIE, "Le robinet se démonte aisément", true, "À nettoyer", false),
    ROUILLE_FILETS_ROBINET(Section.ROBINETTERIE, "Dépôt de rouille sur les filets", false, "À nettoyer", false),
    ROUILLE_FOND_ROBINET(Section.ROBINETTERIE, "Dépôt de rouille sur le fond", false, "À nettoyer", false),
    FILETS_ROBINET_BON_ETAT(Section.ROBINETTERIE, "Filets en bon état", true, "Robinetterie à changer", false),
    APPAIRAGE_FILETAGES(Section.ROBINETTERIE, "Filetages de la bouteille et du robinet appairés (même type)", true,
            "Robinet à changer avant remise en service", true),
    REMONTAGE(Section.ROBINETTERIE, "Joint changé, filetage graissé, robinet remonté au couple de serrage", true,
            "À refaire", false),

    // Bouteille : filetage du col
    FILETAGE_COL_BON_ETAT(Section.FILETAGE, "Filetage du col en bon état", true, "À contrôler au tampon", false),
    FILETAGE_LEGEREMENT_OXYDE(Section.FILETAGE, "Filetage légèrement oxydé", false, "À nettoyer", false),
    FILETS_ACTIFS_DETERIORES(Section.FILETAGE, "Filets actifs détériorés", false, "Rejet", true),

    // Bouteille : extérieur
    MARQUAGES_LISIBLES(Section.EXTERIEUR, "Marques gravées lisibles (fabricant, pressions, épreuves)", true,
            "À signaler au propriétaire", false),
    ATTEINTES_PROFONDES(Section.EXTERIEUR, "Atteintes profondes", false, "Rejet", true),
    PEINTURE_BON_ETAT(Section.EXTERIEUR, "Peinture en bon état", true, "Retouche", false),
    CLOQUES_NON_CORRODEES(Section.EXTERIEUR, "Cloques, écaillage non corrodés", false, "Retouche", false),
    CLOQUES_CORRODEES(Section.EXTERIEUR, "Cloques, écaillage corrodés", false, "Nettoyage", false),
    CORROSION_EXTERIEURE_LOCALISEE(Section.EXTERIEUR, "Corrosion superficielle localisée", false, "Nettoyage", false),
    CORROSION_EXTERIEURE_GENERALISEE(Section.EXTERIEUR, "Corrosion superficielle généralisée", false,
            "Sablage, traitement de surface et peinture", false),

    // Bouteille : intérieur
    INTERIEUR_PROPRE(Section.INTERIEUR, "Propre (sinon : nature des résidus)", true, "À nettoyer", false),
    INTERIEUR_SEC(Section.INTERIEUR, "Sec", true, "À sécher", false),
    REVETEMENT_A_ELIMINER(Section.INTERIEUR, "Revêtement intérieur à éliminer (opaque, ou non adhérent)", false,
            "Élimination : thermique, chimique ou mécanique (entreprise, produits)", false),

    // Bouteille : paroi
    OXYDATION_SUPERFICIELLE(Section.PAROI, "Oxydation superficielle uniforme (1)", false, "Grenaillage", false),
    OXYDATION_PULVERULENTE(Section.PAROI, "Oxydation pulvérulente généralisée (6)", false, "Grenaillage", false),
    PETITES_PIQURES(Section.PAROI, "Petites piqûres réparties", false, "Grenaillage, mesure aux ultrasons", false),
    PIQURES_GENERALISEES(Section.PAROI, "Piqûres généralisées", false, "Grenaillage, mesure aux ultrasons", false),
    PIQURES_EN_LIGNE(Section.PAROI, "Piqûres en ligne (3)", false, "Mesure de la profondeur", false),
    PIQURES_EN_BANDE(Section.PAROI, "Piqûres en bande (3+)", false, "Mesure de la profondeur", false),
    CHANCRES(Section.PAROI, "Chancres", false, "Mesure : grandeur, profondeur, surface", false),
    CORROSION_FEUILLETANTE_LOCALISEE(Section.PAROI, "Corrosion feuilletante localisée (4)", false, "Rejet", true),
    CORROSION_FEUILLETANTE_GENERALISEE(Section.PAROI, "Corrosion feuilletante généralisée (5)", false, "Rejet", true),

    // Bouteilles en alliage d'aluminium (UC12)
    COL_ALUMINIUM_SANS_FISSURE(Section.ALUMINIUM, "Col et ogive sans fissure ni amorce de fissure", true,
            "Rejet", true),

    // Bouteilles nitrox, susceptibles de recevoir de l'oxygène (UC11)
    PROPRETE_OXYGENE(Section.OXYGENE, "Propreté « service oxygène » vérifiée (lumière noire)", true,
            "Dégraissage « service oxygène »", true),
    ROBINET_OXYGENE(Section.OXYGENE, "Robinet nettoyé et graissé avec un produit compatible oxygène", true,
            "À refaire", true);

    /** Les parties de la fiche, dans l'ordre d'impression. */
    public enum Section {
        ROBINETTERIE("Robinetterie"),
        FILETAGE("Bouteille : filetage du col"),
        EXTERIEUR("Bouteille : extérieur"),
        INTERIEUR("Bouteille : intérieur"),
        PAROI("Bouteille : paroi"),
        ALUMINIUM("Bouteille en aluminium"),
        OXYGENE("Service oxygène (bloc nitrox)");

        private final String libelle;

        Section(String libelle) {
            this.libelle = libelle;
        }

        public String libelle() {
            return libelle;
        }

        /** Les questions aluminium et oxygène ne concernent que les blocs qui le sont. */
        public boolean concerne(Equipement bloc) {
            return switch (this) {
                case ALUMINIUM -> bloc.getMatiere() == Equipement.Matiere.ALUMINIUM;
                case OXYGENE -> bloc.isNitrox();
                default -> true;
            };
        }
    }

    private final Section section;
    private final String libelle;
    private final boolean reponseNormale;
    private final String actionProposee;
    private final boolean interditAvisFavorable;

    PointInspectionTiv(Section section, String libelle, boolean reponseNormale, String actionProposee,
                       boolean interditAvisFavorable) {
        this.section = section;
        this.libelle = libelle;
        this.reponseNormale = reponseNormale;
        this.actionProposee = actionProposee;
        this.interditAvisFavorable = interditAvisFavorable;
    }

    public Section section() {
        return section;
    }

    public String libelle() {
        return libelle;
    }

    public boolean reponseNormale() {
        return reponseNormale;
    }

    public String actionProposee() {
        return actionProposee;
    }

    public boolean interditAvisFavorable() {
        return interditAvisFavorable;
    }

    public boolean concerne(Equipement bloc) {
        return section.concerne(bloc);
    }
}
