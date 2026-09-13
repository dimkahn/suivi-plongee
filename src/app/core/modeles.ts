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
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  saison: string;
  statut: string;
  moniteurReferent: string | null;
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
  code: string;
  intitule: string;
  evaluationTransverse: boolean;
  validerEnDernier: boolean;
  acquis: number;
  total: number;
  valide: boolean;
  dateValidation: string | null;
  valideePar: string | null;
  criteres: CritereVue[];
}

export interface GrilleVue {
  cursusId: number;
  eleve: string;
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
  blocCode: string;
  savoirFaire: string;
  historique: CelluleMatrice[];
}

export interface MatriceVue {
  eleve: string;
  niveau: 'N1' | 'N2' | 'N3';
  seances: SeanceEnTete[];
  lignes: LigneMatrice[];
}

export interface Controle {
  code: string;
  libelle: string;
  satisfait: boolean;
  detail: string;
}

export interface Eligibilite {
  eligible: boolean;
  controles: Controle[];
}
