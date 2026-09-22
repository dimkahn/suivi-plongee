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
  moniteurReferent: string | null;
}

/**
 * Appartenance d'un élève à une saison sans formation (pas de niveau, pas de
 * référentiel) : pour un élève déjà breveté qui continue de plonger avec le
 * club. À distinguer d'un CursusVue, qui porte toujours un niveau.
 */
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
  criteres: CritereVue[];
}

export interface GrilleVue {
  cursusId: number;
  eleveId: number;
  eleve: string;
  aPhoto: boolean;
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
}

export interface SeanceVue {
  id: number;
  date: string;
  /** Rang de la séance dans sa journée (1, 2, 3…) : plusieurs séances peuvent partager la même date. */
  ordre: number;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string | null;
  profondeurMax: number | null;
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
  numeroLicence: string | null;
  certificatValideJusquAu: string | null;
}

export interface SeanceEnTete {
  id: number;
  date: string;
  lieu: string | null;
}

export interface LigneRoster {
  cursusId: number;
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  moniteurReferent: string | null;
  caciValide: boolean;
  seancesBloc: number;
  seancesNage: number;
  /** Clé = id de séance ; valeur = atelier (NAGE/BLOC/…) ou statut (ABSENT/EXCUSE). */
  presencesParSeance: Record<number, string>;
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
  autorisationLegale: boolean;
  autorisationImage: boolean;
  archive: boolean;
}

export interface LigneTrombinoscope {
  eleveId: number;
  cursusId: number;
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
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
  aptitude: string | null;
  qualificationPreparee: string | null;
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
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  statut: StatutPresence | null;
  atelier: Atelier | null;
}

export interface FeuillePresence {
  seance: SeanceVue;
  eleves: LignePresence[];
}
