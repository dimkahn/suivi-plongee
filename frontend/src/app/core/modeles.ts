export type Statut = 'NON_ABORDE' | 'EN_COURS' | 'ACQUIS';

export interface Session {
  jetonAcces: string;
  expireDansSecondes: number;
  nomComplet: string;
  email: string;
  roles: string[];
  niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4' | null;
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
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string | null;
  profondeurMax: number | null;
  commentaire: string | null;
  /** false dès que la séance porte des présences ou des évaluations : milieu et profondeur figés. */
  modifiable: boolean;
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
  source: string;
  ageMinimum: number;
  niveauPrerequis: 'N1' | 'N2' | 'N3' | null;
  qualificationRequise: string | null;
  milieuNaturelExclusif: boolean;
  niveauEncadrantValidation: 'E1' | 'E2' | 'E3' | 'E4';
  niveauEncadrantDelivrance: 'E1' | 'E2' | 'E3' | 'E4';
  prerogativeProfondeur: number;
  blocs: BlocReferentielVue[];
}

export interface Eligibilite {
  eligible: boolean;
  controles: Controle[];
}
