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
