export type Statut = 'NON_ABORDE' | 'EN_COURS' | 'ACQUIS';

export interface Session {
  jetonAcces: string;
  expireDansSecondes: number;
  nomComplet: string;
  email: string;
  roles: string[];
  niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4' | null;
  nom: string;
  prenom: string;
  numeroLicence: string | null;
  /** Fin de validité du CACI de l'encadrant (saisie par un admin). */
  certificatValideJusquAu: string | null;
}

export interface CursusVue {
  id: number;
  eleveId: number;
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  saison: string;
  statut: string;
}

/**
 * Appartenance d'un élève à une saison sans formation (pas de niveau, pas de
 * référentiel) : pour un élève déjà breveté qui continue de plonger avec le
 * club. À distinguer d'un CursusVue, qui porte toujours un niveau.
 */
/** Un élève proposé dans le formulaire d'inscription, vu depuis la saison choisie. */
export interface CandidatInscription {
  eleveId: number;
  nom: string;
  prenom: string;
  /** null : aucun brevet connu (débutant). */
  niveauActuel: string | null;
  /** true : niveau repris de la fiche élève, pas d'un brevet délivré dans l'appli. */
  niveauDeclare: boolean;
  /** Saisons antérieures avec un cursus ou une adhésion ; 0 = première saison au club. */
  saisonsPrecedentes: number;
  derniereSaison: string | null;
  /** Niveaux déjà ouverts pour l'élève sur la saison choisie. */
  inscriptionsSaison: string[];
  adhesionSaison: boolean;
  niveauPropose: 'N1' | 'N2' | 'N3' | null;
  motifProposition: string;
}

export interface AdhesionVue {
  id: number;
  eleveId: number;
  eleve: string;
  saisonId: number;
  saison: string;
  adhereLe: string;
}

export interface CritereVue {
  id: number;
  ordre: number;
  savoirFaire: string;
  critereRealisation: string | null;
  statut: Statut;
  parQui: string | null;
  le: string | null;
  commentaire: string | null;
}

export interface BlocVue {
  id: number;
  intitule: string;
  evaluationTransverse: boolean;
  validerEnDernier: boolean;
  acquis: number;
  total: number;
  valide: boolean;
  dateValidation: string | null;
  valideePar: string | null;
  /** "Commun"/"PA20"/"PE40"... pour les niveaux qui se scindent en plusieurs qualifications. */
  regroupement: string | null;
  /** Revisions post-PE20 (decembre 2025) uniquement : null sur les blocs plus anciens. */
  competenceAttendue: string | null;
  comportement: string | null;
  theorie: string | null;
  modalitesEvaluation: string | null;
  /** Fin de la dernière période de la progression suivie qui contient ce bloc ; null sans progression. */
  echeance: string | null;
  /** Échéance passée, bloc non validé et critères pas tous acquis (calculé par le serveur). */
  enRetard: boolean;
  criteres: CritereVue[];
}

/** Une période de la progression suivie par le cursus. */
export interface PeriodeGrilleVue {
  intitule: string;
  moisDebut: number;
  moisFin: number;
  milieu: 'ARTIFICIEL' | 'NATUREL' | null;
  note: string | null;
  blocIds: number[];
}

export interface GrilleVue {
  cursusId: number;
  eleveId: number;
  eleve: string;
  aPhoto: boolean;
  email: string | null;
  telephone: string | null;
  contactUrgenceNom: string | null;
  contactUrgenceTelephone: string | null;
  /** Dates au format ISO (AAAA-MM-JJ). */
  dateNaissance: string | null;
  certificatValideJusquAu: string | null;
  tailleGilet: string | null;
  tailleCombinaison: string | null;
  niveau: 'N1' | 'N2' | 'N3';
  versionMft: string;
  saison: string;
  statut: string;
  milieuNaturelExclusif: boolean;
  niveauEncadrantValidation: 'E1' | 'E2' | 'E3' | 'E4';
  prerogativeProfondeur: number;
  seancesNage: number;
  seancesBloc: number;
  seancesPlongee: number;
  criteresAcquis: number;
  criteresTotal: number;
  blocs: BlocVue[];
  /** Progression suivie par la saison pour ce référentiel ; null et liste vide sinon. */
  progression: string | null;
  periodes: PeriodeGrilleVue[];
  /**
   * Séances où l'élève est noté présent : les seules où on peut le noter.
   * Peut manquer dans une grille mise en cache avant cette règle.
   */
  seancesPresent?: number[];
  /**
   * Programme d'exercices des séances de la saison (sa formation et les
   * exercices communs). Peut manquer dans une grille mise en cache avant.
   */
  programmes?: ProgrammeGrilleVue[];
}

export interface ExerciceGrilleVue {
  intitule: string;
  consignes: string | null;
  dureeMinutes: number | null;
  /** Groupe d'entraînement qui l'a préparé ; null : programme commun de la séance. */
  groupe?: string | null;
  critereIds: number[];
}

export interface ProgrammeGrilleVue {
  seanceId: number;
  exercices: ExerciceGrilleVue[];
}

// ----------------------------------------------------------------
//  Programme d'exercices d'une séance, préparé par un moniteur.
// ----------------------------------------------------------------

export interface CritereExerciceVue {
  id: number;
  blocId: number;
  bloc: string;
  savoirFaire: string;
}

export interface ExerciceVue {
  id: number;
  /** Groupe d'entraînement qui l'a préparé ; null : programme commun de la séance. */
  groupeId: number | null;
  ordre: number;
  intitule: string;
  consignes: string | null;
  dureeMinutes: number | null;
  /** Null : exercice commun (échauffement, nage), sans critère. */
  referentielId: number | null;
  niveau: 'N1' | 'N2' | 'N3' | null;
  criteres: CritereExerciceVue[];
}

/** Formation proposée : celles des élèves de la saison (effectif), puis les versions actives du MFT. */
export interface FormationProgrammeVue {
  referentielId: number;
  niveau: 'N1' | 'N2' | 'N3';
  versionMft: string;
  eleves: number;
}

/**
 * Groupe d'entraînement de la saison de la séance. `modifiable` : l'utilisateur
 * prépare son programme (encadrant attitré ou admin) ; `mien` : il l'encadre.
 */
export interface GroupeProgrammeVue {
  id: number;
  nom: string;
  niveauPrepare: 'N1' | 'N2' | 'N3' | null;
  eleves: number;
  modifiable: boolean;
  mien: boolean;
}

export interface ProgrammeVue {
  seanceId: number;
  formations: FormationProgrammeVue[];
  groupes: GroupeProgrammeVue[];
  /** Tous les programmes de la séance : le commun et ceux des groupes. */
  exercices: ExerciceVue[];
}

export interface DemandeExercice {
  intitule: string;
  consignes: string | null;
  dureeMinutes: number | null;
  referentielId: number | null;
  critereIds: number[];
}

export interface SeanceVue {
  id: number;
  date: string;
  /** Rang de la séance dans sa journée (1, 2, 3…) : plusieurs séances peuvent partager la même date. */
  ordre: number;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string | null;
  /** Point de plongée précis au sein du lieu (épave, tombant…). */
  site: string | null;
  profondeurMax: number | null;
  /** Affiché « Info complémentaire ». */
  commentaire: string | null;
  /** false dès que la séance porte des présences ou des évaluations : milieu et profondeur figés. */
  modifiable: boolean;
  /** Une fiche de sécurité (A322-72) a déjà été enregistrée pour cette séance. */
  ficheSecurite: boolean;
}

export interface EvaluationVue {
  id: number;
  critereId: number;
  statut: Statut;
  commentaire: string | null;
  dateEvaluation: string;
  parQui: string;
}

export interface MoniteurVue {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  actif: boolean;
  niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4' | null;
  /** Niveau de plongeur (N1 à N5), distinct de l'encadrement : un E1 peut n'être que N2. */
  niveauPlongeur: string | null;
  numeroLicence: string | null;
  certificatValideJusquAu: string | null;
  admin: boolean;
  /** Gère le matériel du club et les prêts. */
  directeurTechnique: boolean;
  /** Technicien en inspection visuelle : remplit les fiches d'inspection des blocs. */
  tiv: boolean;
  autorisationImage: boolean;
  aPhoto: boolean;
}

export interface SeanceEnTete {
  id: number;
  date: string;
  lieu: string | null;
  milieu: 'ARTIFICIEL' | 'NATUREL';
}

export interface LigneRoster {
  cursusId: number;
  eleveId: number;
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  caciValide: boolean;
  /** Fin de validité du certificat médical (AAAA-MM-JJ), null si non renseignée. */
  caciFinValidite: string | null;
  seancesBloc: number;
  seancesNage: number;
  /** Clé = id de séance ; valeur = atelier (NAGE/BLOC/…) ou statut (ABSENT/EXCUSE). */
  presencesParSeance: Record<number, string>;
  aPhoto: boolean;
}

export interface RosterVue {
  seances: SeanceEnTete[];
  eleves: LigneRoster[];
}

export interface CelluleMatrice {
  seanceId: number | null;
  date: string;
  statut: Statut;
  parQui: string;
}

export interface LigneMatrice {
  critereId: number;
  blocIntitule: string;
  regroupement: string | null;
  savoirFaire: string;
  historique: CelluleMatrice[];
}

export interface MatriceVue {
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  seances: SeanceEnTete[];
  lignes: LigneMatrice[];
}

export type JourSemaine = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** Une même séance chaque jour de la semaine choisi, sur la période. */
export interface DemandeGenerationSaison {
  dateDebut: string;
  dateFin: string;
  jours: JourSemaine[];
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string;
  site: string;
  profondeurMax: number | null;
  info: string;
  /** A, B ou C ; vide : les vacances ne sont pas retirées. */
  zoneVacances: string;
  exclureFeries: boolean;
}

export interface GenerationSaisonVue {
  saison: string;
  saisonOuverte: boolean;
  nbSeances: number;
  /** Séances déjà présentes sur la période : les nouvelles s'y ajouteraient. */
  seancesExistantes: number;
  seances: { date: string; ordre: number; milieu: 'ARTIFICIEL' | 'NATUREL'; lieu: string | null;
             site: string | null; profondeurMax: number | null; commentaire: string | null }[];
  exclusions: { motif: string; debut: string; fin: string; seancesRetirees: number }[];
}

export interface SaisonVue {
  id: number;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  ouverte: boolean;
}

export interface EleveVue {
  id: number;
  nom: string;
  prenom: string;
  dateNaissance: string | null;
  numeroLicence: string | null;
  certificatValideJusquAu: string | null;
  /** Déclaratif : brevet obtenu avant l'outil ou dans un autre club, sans cursus DELIVRE dans l'app. */
  dernierNiveau: string | null;
  email: string | null;
  telephone: string | null;
  contactUrgenceNom: string | null;
  contactUrgenceTelephone: string | null;
  /** Tailles pour le prêt de matériel, en texte libre (S, M, T3, 12 ans…). */
  tailleGilet: string | null;
  tailleCombinaison: string | null;
  autorisationLegale: boolean;
  autorisationImage: boolean;
  archive: boolean;
  /** Jamais vrai sans le droit à l'image. */
  aPhoto: boolean;
}

export interface LigneTrombinoscope {
  eleveId: number;
  cursusId: number;
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  aPhoto: boolean;
  autorisationImage: boolean;
}

export interface LigneTrombinoscopeMoniteur {
  id: number;
  nomComplet: string;
  niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4' | null;
  aPhoto: boolean;
  autorisationImage: boolean;
}

export interface Controle {
  code: string;
  libelle: string;
  satisfait: boolean;
  detail: string;
}

export interface CritereReferentielVue {
  id: number;
  ordre: number;
  savoirFaire: string;
  critereRealisation: string | null;
  commentaire: string | null;
}

export interface BlocReferentielVue {
  id: number;
  intitule: string;
  ordre: number;
  evaluationTransverse: boolean;
  validerEnDernier: boolean;
  /** Revisions post-PE20 (decembre 2025) uniquement : null sur les blocs plus anciens. */
  competenceAttendue: string | null;
  comportement: string | null;
  theorie: string | null;
  modalitesEvaluation: string | null;
  /** "Commun"/"PA20"/"PE40"... pour les niveaux qui se scindent en plusieurs qualifications. */
  regroupement: string | null;
  criteres: CritereReferentielVue[];
}

export interface ReferentielVue {
  id: number;
  niveau: 'N1' | 'N2' | 'N3';
  versionMft: string;
  source: string | null;
  dateApplication: string;
  actif: boolean;
  ageMinimum: number;
  niveauPrerequis: 'N1' | 'N2' | 'N3' | null;
  qualificationRequise: string | null;
  milieuNaturelExclusif: boolean;
  niveauEncadrantValidation: 'E1' | 'E2' | 'E3' | 'E4';
  niveauEncadrantDelivrance: 'E1' | 'E2' | 'E3' | 'E4';
  profondeurMaxValidation: number;
  profondeurMaxFormation: number;
  prerogativeProfondeur: number;
  blocs: BlocReferentielVue[];
}

/** Formulaire d'édition d'un référentiel : mêmes champs, sans id ni blocs (gérés séparément). */
export interface DemandeReferentiel {
  niveau: 'N1' | 'N2' | 'N3';
  versionMft: string;
  source: string | null;
  dateApplication: string;
  actif: boolean;
  ageMinimum: number;
  niveauPrerequis: 'N1' | 'N2' | 'N3' | null;
  qualificationRequise: string | null;
  milieuNaturelExclusif: boolean;
  niveauEncadrantValidation: 'E1' | 'E2' | 'E3' | 'E4';
  niveauEncadrantDelivrance: 'E1' | 'E2' | 'E3' | 'E4';
  profondeurMaxValidation: number;
  profondeurMaxFormation: number;
  prerogativeProfondeur: number;
}

export interface DemandeBlocReferentiel {
  intitule: string;
  ordre: number;
  evaluationTransverse: boolean;
  validerEnDernier: boolean;
  competenceAttendue: string | null;
  comportement: string | null;
  theorie: string | null;
  modalitesEvaluation: string | null;
  regroupement: string | null;
}

export interface DemandeCritereReferentiel {
  ordre: number;
  savoirFaire: string;
  critereRealisation: string | null;
  commentaire: string | null;
}

export interface Eligibilite {
  eligible: boolean;
  controles: Controle[];
}

export interface MoniteurOptionVue {
  id: number;
  nomComplet: string;
  niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4' | null;
}

export type FonctionPalanquee = 'PLONGEUR' | 'GUIDE_PALANQUEE' | 'ENCADRANT';

/**
 * Seuls le gaz et le moyen de désaturation varient d'un plongeur à l'autre :
 * le profil de plongée est celui de la palanquée. eleveId/utilisateurId sont
 * facultatifs : ils ne servent qu'à pré-remplir aptitude/qualificationPreparee
 * depuis le dossier d'un membre du club (voir PlongeurConnuVue) ; la fiche
 * garde ensuite ces valeurs comme un instantané éditable, pas une liaison vive.
 */
export interface PlongeurVue {
  eleveId: number | null;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  aptitude: string | null;
  /** Prérogative accordée par le DP pour cette sortie précise, distincte de `aptitude` (le niveau détenu). */
  aptitudeDonneeParDp: string | null;
  qualificationPreparee: string | null;
  fonction: FonctionPalanquee;
  gaz: string | null;
  moyenDesaturation: string | null;
  observations: string | null;
}

/**
 * Un élève ou un encadrant du club, pour le sélecteur d'un membre de
 * palanquée : aptitude/qualificationPreparee viennent de son dossier
 * (dernier brevet délivré et cursus en cours pour un élève, niveau
 * d'encadrement pour un encadrant — jamais les deux à la fois).
 */
export interface PlongeurConnuVue {
  eleveId: number | null;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  /** Pré-remplissage d'un membre de palanquée ou de groupe. */
  aptitude: string | null;
  qualificationPreparee: string | null;
  /** Les mêmes informations séparées, pour l'affichage : brevet de plongeur, */
  niveau: string | null;
  /** formation en cours, */
  niveauPreparation: string | null;
  /** et niveau d'encadrement (encadrant, ou élève qui a aussi un compte d'encadrant). */
  niveauEncadrement: string | null;
}

/**
 * Une palanquée : profil prévu (saisi à l'établissement de la fiche) et
 * profil réalisé (complété séparément, au retour de plongée — voir
 * ApiService.enregistrerProfilRealise).
 */
export interface PalanqueeVue {
  numero: number;
  profondeurPrevue: number | null;
  dureePrevue: number | null;
  profondeurRealisee: number | null;
  dureeRealisee: number | null;
  paliers: string | null;
  heureImmersion: string | null;
  heureSortie: string | null;
  membres: PlongeurVue[];
}

/**
 * Fiche de sécurité d'une séance (A322-72). dp/dpId sont null tant qu'aucune
 * fiche n'a été enregistrée : le backend renvoie alors une fiche "vide"
 * plutôt qu'une 404, pour amorcer directement le formulaire de création.
 */
export interface FicheSecuriteVue {
  id: number | null;
  dpId: number | null;
  dp: string | null;
  meteo: string | null;
  etatMer: string | null;
  visibilite: string | null;
  courant: string | null;
  maree: string | null;
  temperatureEau: string | null;
  securiteSurface: string | null;
  planSecours: string | null;
  observations: string | null;
  palanquees: PalanqueeVue[];
  /** Séances du même jour liées à celle-ci (deux bateaux…), qui se partagent les plongeurs d'un groupe. */
  seancesLiees: SeanceLieeVue[];
  /** La sortie (séjour) dont fait partie la séance : ses fiches s'impriment toutes d'un coup. */
  sortie?: { id: number; nom: string } | null;
}

/** Un plongeur déjà placé sur la fiche d'une séance liée. */
export interface PlongeurPlaceVue {
  eleveId: number | null;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  palanquee: number;
}

export interface SeanceLieeVue {
  seanceId: number;
  date: string;
  ordre: number | null;
  lieu: string | null;
  site: string | null;
  ficheEtablie: boolean;
  plongeursPlaces: PlongeurPlaceVue[];
}

/** Un plongeur au sein d'un GroupePlongeursVue : même logique d'instantané éditable que PlongeurConnuVue. */
export interface MembreGroupeVue {
  eleveId: number | null;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  aptitude: string | null;
  qualificationPreparee: string | null;
}

/**
 * Groupe nommé et réutilisable de plongeurs (typiquement composé pour un
 * séjour), glissé-déposé ensuite dans les palanquées de plusieurs fiches de
 * sécurité successives — voir fiche-securite.component.ts.
 */
export interface GroupePlongeursVue {
  id: number;
  nom: string;
  saisonId: number;
  membres: MembreGroupeVue[];
}

export type StatutPresence = 'PRESENT' | 'ABSENT' | 'EXCUSE';
export type Atelier = 'NAGE' | 'BLOC' | 'THEORIE' | 'PLONGEE';

/** Une ligne de la feuille de présence ; statut null : rien de saisi pour cette séance. */
export interface LignePresence {
  cursusId: number;
  eleveId: number;
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  /** Version du MFT figée sur le cursus ; absente d'une feuille embarquée hors ligne avant son ajout. */
  referentielId?: number;
  statut: StatutPresence | null;
  atelier: Atelier | null;
  aPhoto: boolean;
  autorisationImage: boolean;
}

export interface FeuillePresence {
  seance: SeanceVue;
  eleves: LignePresence[];
}

/**
 * Notation groupée des présents d'une séance : le serveur ne fait jamais
 * reculer un élève (acquis reste acquis, en cours reste en cours, non abordé
 * passe en cours) et ajoute le commentaire, obligatoire, de chaque critère.
 */
export interface DemandeNotationGroupee {
  cursusIds: number[];
  criteres: { critereId: number; commentaire: string }[];
}

export interface BilanNotationGroupee {
  eleves: number;
  passesEnCours: number;
  commentairesAjoutes: number;
}

// ----------------------------------------------------------------
//  Progressions types : l'année d'un niveau découpée en périodes (mois).
// ----------------------------------------------------------------

export interface BlocResume {
  id: number;
  ordre: number;
  intitule: string;
}

export interface PeriodeProgressionVue {
  id: number;
  rang: number;
  intitule: string;
  /** 1 = janvier ... 12 = décembre ; une période peut enjamber le changement d'année. */
  moisDebut: number;
  moisFin: number;
  milieu: 'ARTIFICIEL' | 'NATUREL' | null;
  note: string | null;
  blocs: BlocResume[];
}

export interface ProgressionResume {
  id: number;
  nom: string;
  referentielId: number;
  niveau: 'N1' | 'N2' | 'N3';
  versionMft: string;
  nombrePeriodes: number;
}

export interface ProgressionVue {
  id: number;
  nom: string;
  description: string | null;
  referentielId: number;
  niveau: 'N1' | 'N2' | 'N3';
  versionMft: string;
  periodes: PeriodeProgressionVue[];
}

/** id null : nouvelle période. L'ordre de la liste donne le rang. */
export interface DemandePeriodeProgression {
  id: number | null;
  intitule: string;
  moisDebut: number;
  moisFin: number;
  milieu: 'ARTIFICIEL' | 'NATUREL' | null;
  note: string | null;
  blocIds: number[];
}

/** referentielId n'est lu qu'à la création. */
export interface DemandeProgression {
  referentielId: number | null;
  nom: string;
  description: string | null;
  periodes: DemandePeriodeProgression[];
}

// ----------------------------------------------------------------
//  Planning du bassin : espaces (lignes d'eau, fosse) et groupes
//  d'entraînement de la saison.
// ----------------------------------------------------------------

export interface EspaceBassinVue {
  id: number;
  nom: string;
  type: 'LIGNE' | 'FOSSE';
  ordre: number;
  profondeurMax: number | null;
  /** Plongeurs admis en même temps, encadrants compris. */
  capacite: number | null;
  actif: boolean;
}

export type DemandeEspaceBassin = Omit<EspaceBassinVue, 'id'>;

export interface GroupeEntrainementVue {
  id: number;
  saisonId: number;
  nom: string;
  ordre: number;
  niveauPrepare: 'N1' | 'N2' | 'N3' | null;
  /** Lignes attitrées, dans l'ordre du bassin ; un groupe nombreux peut en occuper plusieurs. */
  espaceAttitreIds: number[];
  /** « Ligne 5 + Ligne 6 » ; null sans ligne attitrée. */
  espacesAttitres: string | null;
  /** Référents d'abord : un référent est aussi un encadrant attitré. */
  encadrants: { id: number; nomComplet: string; niveauEncadrement: string | null; referent: boolean }[];
  eleves: { id: number; nom: string; prenom: string }[];
}

export interface DemandeGroupeEntrainement {
  saisonId: number;
  nom: string;
  niveauPrepare: 'N1' | 'N2' | 'N3' | null;
  espaceAttitreIds: number[];
  /** Encadrants attitrés qui ne sont pas référents. */
  encadrantIds: number[];
  referentIds: number[];
}

/** Un élève de la saison vu depuis l'écran de rangement. */
export interface EleveSaisonGroupeVue {
  eleveId: number;
  nom: string;
  prenom: string;
  niveauxEnCours: string[];
  /** Adhérent sans formation cette saison. */
  adhesionSeule: boolean;
  groupeId: number | null;
  groupeSuggereId: number | null;
}

/** Place d'un groupe un soir donné (ATTITREE : sa ligne attitrée, rien d'enregistré). */
export interface CasePlanningVue {
  groupeId: number;
  type: 'ATTITREE' | 'ESPACE' | 'ACTIVITE' | 'ABSENT' | 'AUCUN';
  espaceId: number | null;
  espace: string | null;
  espaceType: 'LIGNE' | 'FOSSE' | null;
  /**
   * Tous les espaces occupés ce soir-là (plusieurs pour un groupe attitré à
   * plusieurs lignes) ; espaceId, espace et espaceType décrivent le premier.
   * Peut manquer dans un planning mis en cache avant cette évolution.
   */
  espaces?: { id: number; nom: string; type: 'LIGNE' | 'FOSSE' }[];
  profondeurLimitee: number | null;
  activite: string | null;
  /** En clair : « Ligne 3 », « Ligne 5 + Ligne 6 », « Fosse (limitée à 6 m) », « Baptêmes », « Absent ». */
  libelle: string;
  /**
   * Encadrants du groupe ce soir-là : les attitrés, moins ceux mis dans un
   * autre groupe, plus ceux qu'on y a mis. Peut manquer dans un planning mis
   * en cache avant cette évolution (on retombe alors sur les attitrés).
   */
  encadrants?: EncadrantCasePlanningVue[];
}

/** Un encadrant d'un groupe un soir donné. */
export interface EncadrantCasePlanningVue extends EncadrantPlanningVue {
  /** Pas encadrant attitré du groupe : l'admin l'y a mis pour cette soirée seulement. */
  affecteCeSoir: boolean;
}

/** Un encadrant mis un soir dans un autre groupe que ses groupes attitrés. */
export interface ChangementEncadrantVue {
  utilisateurId: number;
  nomComplet: string;
  groupeId: number;
  groupe: string;
}

/** Un encadrant tel que le planning l'affiche. */
export interface EncadrantPlanningVue {
  id: number;
  nomComplet: string;
  niveauEncadrement: string | null;
  /** Référent du groupe ; toujours faux dans les présences d'une soirée. */
  referent: boolean;
}

export interface SoireePlanningVue {
  date: string;
  dpFosseId: number | null;
  dpFosse: string | null;
  dpPiscineId: number | null;
  dpPiscine: string | null;
  note: string | null;
  /** Réponses des encadrants ; qui n'est dans aucune des deux listes n'a pas répondu. */
  presents: EncadrantPlanningVue[];
  absents: EncadrantPlanningVue[];
  cases: CasePlanningVue[];
  avertissements: string[];
  /** Encadrants mis ce soir-là dans un autre groupe ; peut manquer dans un planning mis en cache avant. */
  changementsEncadrants?: ChangementEncadrantVue[];
}

export interface GroupePlanningVue {
  id: number;
  nom: string;
  niveauPrepare: string | null;
  espaceAttitreIds: number[];
  /** « Ligne 5 + Ligne 6 » ; null sans ligne attitrée. */
  espacesAttitres: string | null;
  nombreEleves: number;
  /** Élèves et encadrants attitrés : ce que le groupe pèse dans la fosse. */
  effectif: number;
  encadrants: EncadrantPlanningVue[];
}

export type ReponseDisponibilite = 'PRESENT' | 'ABSENT';

export interface PlanningVue {
  saisonId: number;
  saison: string;
  groupes: GroupePlanningVue[];
  espaces: { id: number; nom: string; type: 'LIGNE' | 'FOSSE'; profondeurMax: number | null; capacite: number | null }[];
  soirees: SoireePlanningVue[];
  /** Groupes dont l'utilisateur connecté est encadrant attitré. */
  mesGroupeIds: number[];
  /** L'utilisateur connecté, pour retrouver ses réponses dans les soirées. */
  utilisateurId: number;
}

export interface DemandeCasePlanning {
  type: 'ATTITREE' | 'ESPACE' | 'ACTIVITE' | 'ABSENT';
  espaceId?: number | null;
  /** Une ou plusieurs lignes d'eau (la fosse se donne seule, par espaceId). */
  espaceIds?: number[];
  profondeurLimitee?: number | null;
  activite?: string | null;
}

// ----------------------------------------------------------------
//  Matériel du club et prêts : domaine du directeur technique.
//  Échéances et alertes calculées par le serveur (EcheancesEquipement).
// ----------------------------------------------------------------

export type TypeEquipement = 'BLOC' | 'DETENDEUR' | 'GILET' | 'COMBINAISON';

export const TYPES_EQUIPEMENT: { valeur: TypeEquipement; libelle: string; pluriel: string }[] = [
  { valeur: 'BLOC', libelle: 'Bloc', pluriel: 'Blocs' },
  { valeur: 'DETENDEUR', libelle: 'Détendeur', pluriel: 'Détendeurs' },
  { valeur: 'GILET', libelle: 'Gilet stabilisateur', pluriel: 'Gilets' },
  { valeur: 'COMBINAISON', libelle: 'Combinaison', pluriel: 'Combinaisons' }
];

/** A_REGULARISER : une alerte bloque le prêt (TIV dépassée, contrôle non conforme...). */
export type StatutEquipement = 'DISPONIBLE' | 'PRETE' | 'A_REGULARISER' | 'HORS_SERVICE' | 'REBUTE';

export const LIBELLES_STATUT_EQUIPEMENT: Record<StatutEquipement, string> = {
  DISPONIBLE: 'Disponible',
  PRETE: 'Prêté',
  A_REGULARISER: 'À régulariser',
  HORS_SERVICE: 'Hors service',
  REBUTE: 'Au rebut'
};

export interface AlerteEquipement {
  gravite: 'BLOQUANT' | 'AVERTISSEMENT';
  message: string;
}

/** Champs saisis de la fiche de gestion (Code du sport, annexe III-27). */
export interface ChampsEquipement {
  reference: string;
  ancienneReference: string | null;
  /** Null = le club. */
  proprietaire: string | null;
  constructeur: string | null;
  marque: string | null;
  modele: string | null;
  numeroSerie: string | null;
  taille: string | null;
  dateFabrication: string | null;
  dateAchat: string | null;
  dateMiseEnService: string | null;
  dateRebutPrevue: string | null;
  notice: string | null;
  consignesEntretien: string | null;
  periodiciteRevisionMois: number | null;
  volumeLitres: number | null;
  pressionServiceBar: number | null;
  pressionEpreuveBar: number | null;
  matiere: 'ACIER' | 'ALUMINIUM' | null;
  robinetterie: string | null;
  numeroRobinet: string | null;
  datePremiereEpreuve: string | null;
  nitrox: boolean;
  regimeTiv: boolean;
  composition: string | null;
  epaisseurMm: number | null;
  horsService: boolean;
  remarques: string | null;
}

export interface EquipementVue extends ChampsEquipement {
  id: number;
  type: TypeEquipement;
  typeLibelle: string;
  dateRebut: string | null;
  motifRebut: string | null;
  statut: StatutEquipement;
  derniereInspection: string | null;
  prochaineInspection: string | null;
  derniereRequalification: string | null;
  prochaineRequalification: string | null;
  derniereRevision: string | null;
  prochaineRevision: string | null;
  alertes: AlerteEquipement[];
  pretEnCours: { id: number; emprunteur: string; dateRetourPrevue: string | null } | null;
}

/** Les trois dernières dates ne servent qu'à la création : reprise de l'historique au journal. */
export interface DemandeEquipement extends ChampsEquipement {
  type: TypeEquipement;
  derniereInspectionVisuelle?: string | null;
  derniereRequalification?: string | null;
  derniereRevision?: string | null;
}

/** Compte rendu de la reprise du classeur Excel du matériel. */
export interface RapportImportMateriel {
  blocs: number;
  gilets: number;
  interventions: number;
  auRebut: number;
  dejaPresents: string[];
  remarques: string[];
}

/** Une étiquette à coller sur le matériel : son QR code ouvre la fiche. */
export interface EtiquetteMateriel {
  equipementId: number;
  typeLibelle: string;
  reference: string;
  ancienneReference: string | null;
  adresse: string;
  /** Lignes du QR code, « 1 » = carré noir, sans marge autour. */
  modules: string[];
}

export type TypeIntervention ='INSPECTION_VISUELLE' | 'REQUALIFICATION' | 'REVISION' | 'REPARATION'
  | 'REMPLACEMENT_PIECE' | 'CONTROLE' | 'DESINFECTION' | 'INCIDENT';

export const TYPES_INTERVENTION: { valeur: TypeIntervention; libelle: string; blocSeulement?: boolean }[] = [
  { valeur: 'INSPECTION_VISUELLE', libelle: 'Inspection visuelle (TIV)', blocSeulement: true },
  { valeur: 'REQUALIFICATION', libelle: 'Requalification (épreuve hydraulique)', blocSeulement: true },
  { valeur: 'REVISION', libelle: 'Révision' },
  { valeur: 'REPARATION', libelle: 'Réparation' },
  { valeur: 'REMPLACEMENT_PIECE', libelle: "Remplacement d'une pièce" },
  { valeur: 'CONTROLE', libelle: 'Contrôle' },
  { valeur: 'DESINFECTION', libelle: 'Désinfection' },
  { valeur: 'INCIDENT', libelle: 'Incident' }
];

export interface InterventionVue {
  id: number;
  type: TypeIntervention;
  typeLibelle: string;
  dateIntervention: string;
  intervenant: string | null;
  resultat: 'CONFORME' | 'NON_CONFORME' | null;
  description: string | null;
  pretId: number | null;
  saisiPar: string | null;
  saisiLe: string;
  /** La fiche d'inspection TIV détaillée, quand la ligne en a une. */
  inspectionTivId: number | null;
}

export interface DemandeIntervention {
  type: TypeIntervention;
  dateIntervention: string;
  intervenant: string | null;
  resultat: 'CONFORME' | 'NON_CONFORME' | null;
  description: string | null;
}

export interface PretVue {
  id: number;
  emprunteurType: 'ELEVE' | 'ENCADRANT' | null;
  emprunteurId: number | null;
  emprunteur: string;
  sortieId: number | null;
  sortieNom: string | null;
  sortieLieu: string | null;
  sortieDebut: string | null;
  sortieFin: string | null;
  nombrePlongees: number;
  motif: string | null;
  datePret: string;
  dateRetourPrevue: string | null;
  dateRetour: string | null;
  enRetard: boolean;
  pretePar: string | null;
  recuPar: string | null;
  remarques: string | null;
  equipements: { id: number; type: TypeEquipement; typeLibelle: string; reference: string; description: string }[];
  photosAvant: number;
  photosApres: number;
}

export type MomentPhotoPret = 'AVANT' | 'APRES';

/** Photo de l'état du matériel à la remise ou au retour ; le contenu se lit à part. */
export interface PhotoPretVue {
  id: number;
  moment: MomentPhotoPret;
  /** Null : la photo montre tout le lot. */
  equipementId: number | null;
  equipementReference: string | null;
  legende: string | null;
  priseLe: string;
  prisePar: string | null;
}

export interface FicheEquipementVue {
  equipement: EquipementVue;
  journal: InterventionVue[];
  prets: PretVue[];
}

export type MotifInspectionTiv = 'PERIODIQUE' | 'AVANT_REQUALIFICATION' | 'APRES_INCIDENT' | 'AUTRE';
export type DecisionInspectionTiv = 'FAVORABLE' | 'DEFAVORABLE' | 'REBUT';

export const MOTIFS_INSPECTION_TIV: { valeur: MotifInspectionTiv; libelle: string }[] = [
  { valeur: 'PERIODIQUE', libelle: 'Inspection périodique (annuelle)' },
  { valeur: 'AVANT_REQUALIFICATION', libelle: 'Visite avant requalification' },
  { valeur: 'APRES_INCIDENT', libelle: 'Après un incident (choc, chute, eau, vidage complet)' },
  { valeur: 'AUTRE', libelle: 'Autre' }
];

export const DECISIONS_INSPECTION_TIV: { valeur: DecisionInspectionTiv; libelle: string }[] = [
  { valeur: 'FAVORABLE', libelle: 'Favorable au maintien en service' },
  { valeur: 'DEFAVORABLE', libelle: 'Défavorable au maintien en service' },
  { valeur: 'REBUT', libelle: 'Bouteille rebutée' }
];

/** Une question de la fiche d'inspection ; la liste vient du serveur. */
export interface PointInspectionTivVue {
  code: string;
  libelle: string;
  /** La réponse d'une bouteille sans défaut. */
  reponseNormale: boolean;
  /** La décision proposée en cas de défaut (colonne « Décision » de la fiche). */
  actionProposee: string;
  interditAvisFavorable: boolean;
}

export interface ModeleInspectionTivVue {
  bloc: EquipementVue;
  sections: { code: string; libelle: string; points: PointInspectionTivVue[] }[];
  tivNom: string | null;
  tivNumero: string | null;
  filetageBouteille: string | null;
  filetageRobinet: string | null;
}

export interface DemandeConstatTiv {
  point: string;
  reponse: boolean;
  decision: string | null;
  precisions: string | null;
  realiseLe: string | null;
}

export interface DemandeInspectionTiv {
  dateInspection: string;
  motif: MotifInspectionTiv;
  tivNom: string;
  tivNumero: string;
  filetageBouteille: string | null;
  filetageRobinet: string | null;
  marquageRequalification: string | null;
  decision: DecisionInspectionTiv;
  observations: string | null;
  constats: DemandeConstatTiv[];
}

/** Le compte rendu d'inspection, tel qu'émis. */
export interface InspectionTivVue {
  id: number;
  /** Identification unique du compte rendu (« TIV-2026-0042 »). */
  numero: string;
  /** La structure émettrice. */
  club: string;
  bloc: EquipementVue;
  dateInspection: string;
  motif: MotifInspectionTiv;
  motifLibelle: string;
  tivNom: string;
  tivNumero: string;
  proprietaire: string | null;
  filetageBouteille: string | null;
  filetageRobinet: string | null;
  marquageRequalification: string | null;
  decision: DecisionInspectionTiv;
  decisionLibelle: string;
  observations: string | null;
  prochaineInspection: string | null;
  prochaineRequalification: string | null;
  saisiPar: string | null;
  saisiLe: string;
  sections: {
    code: string;
    libelle: string;
    constats: {
      point: string; libelle: string; reponse: boolean; defaut: boolean;
      decision: string | null; precisions: string | null; realiseLe: string | null;
    }[];
  }[];
}

export interface EmprunteurVue {
  type: 'ELEVE' | 'ENCADRANT';
  id: number;
  nomComplet: string;
  /** Niveau d'encadrement (encadrant) ou dernier niveau obtenu (élève). */
  precision: string | null;
}

// ----------------------------------------------------------------
//  Sorties : nom, lieu, dates et séances choisies (admin ou directeur
//  technique). Une séance appartient au plus à une sortie.
// ----------------------------------------------------------------

export interface SeanceSortieVue {
  id: number;
  date: string;
  ordre: number | null;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string | null;
  site: string | null;
  commentaire: string | null;
}

export interface SortieVue {
  id: number;
  nom: string;
  lieu: string | null;
  dateDebut: string;
  dateFin: string;
  remarques: string | null;
  /** Deux séances d'une même plongée (deux bateaux) comptent pour une. */
  nombrePlongees: number;
  seances: SeanceSortieVue[];
}

/** Une séance des dates de la sortie : déjà choisie, ou prise par une autre sortie. */
export interface SeancePossibleVue {
  seance: SeanceSortieVue;
  choisie: boolean;
  autreSortie: string | null;
}

export interface DemandeSortie {
  nom: string;
  lieu: string | null;
  dateDebut: string;
  /** Absente : sortie d'une journée. */
  dateFin: string | null;
  remarques: string | null;
}

export interface DemandePret {
  eleveId: number | null;
  utilisateurId: number | null;
  sortieId: number | null;
  motif: string | null;
  datePret: string;
  dateRetourPrevue: string | null;
  equipementIds: number[];
  /** Obligatoire dès qu'un détendeur est prêté (Code du sport, art. A322-81). */
  detendeursDesinfectes: boolean;
  remarques: string | null;
}

export interface DemandeRetour {
  dateRetour: string;
  equipements: { equipementId: number; incident: string | null; horsService: boolean }[];
  remarques: string | null;
}
