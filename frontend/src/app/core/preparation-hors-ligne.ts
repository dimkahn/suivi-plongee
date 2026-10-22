/**
 * Ce que « Préparer hors ligne » copie sur l'appareil. Tout embarquer prend
 * du temps et de la place (grilles de toute la saison, photos) ; le moniteur
 * qui n'a besoin que de la fiche de sécurité du jour choisit une formule plus
 * légère. Les lectures elles-mêmes sont dans `ApiService.precharger`.
 */
import { pluriel } from './pluriel';

/** Un morceau de l'appli qu'on peut emporter sans réseau. */
export type ContenuHorsLigne = 'grilles' | 'presences' | 'fiches' | 'planning' | 'eleves' | 'photos' | 'sejours';

export const CONTENUS_HORS_LIGNE: readonly ContenuHorsLigne[] =
  ['grilles', 'presences', 'fiches', 'planning', 'eleves', 'photos', 'sejours'];

/** Libellés des cases « Sur mesure », dans l'ordre d'affichage. */
export const LIBELLES_CONTENUS: Record<ContenuHorsLigne, { titre: string; detail: string }> = {
  grilles: { titre: 'Notes des élèves', detail: 'grilles, programme et schémas des exercices' },
  presences: { titre: 'Feuilles de présence', detail: "faire l'appel" },
  fiches: { titre: 'Fiches de sécurité', detail: 'palanquées, moniteurs, plongeurs et groupes' },
  planning: { titre: 'Planning du bassin', detail: 'qui encadre quel groupe' },
  eleves: { titre: 'Infos élèves et trombinoscopes', detail: 'listes, sans les photos' },
  photos: { titre: 'Photos', detail: 'élèves et moniteurs ; le plus long à copier' },
  sejours: { titre: 'Séjours', detail: 'en cours ou dans les 30 jours : programme, voitures, chambres, frais' }
};

/** Séances dont on embarque présences et fiches : celles du jour, ou celles à ±30 jours. */
export type PeriodeHorsLigne = 'jour' | 'proches';

export const JOURS_SEANCES_PROCHES = 30;

export type FormuleHorsLigne = 'tout' | 'seance-du-jour' | 'fiche-du-jour' | 'sur-mesure';

export interface ChoixHorsLigne {
  contenus: Set<ContenuHorsLigne>;
  periode: PeriodeHorsLigne;
}

const FORMULES: Record<Exclude<FormuleHorsLigne, 'sur-mesure'>, { contenus: readonly ContenuHorsLigne[]; periode: PeriodeHorsLigne }> = {
  'tout': { contenus: CONTENUS_HORS_LIGNE, periode: 'proches' },
  'seance-du-jour': { contenus: ['grilles', 'presences', 'fiches'], periode: 'jour' },
  'fiche-du-jour': { contenus: ['fiches'], periode: 'jour' }
};

/** « Sur mesure » part de tout : on décoche ce dont on n'a pas besoin. */
export function choixDeLaFormule(formule: FormuleHorsLigne): ChoixHorsLigne {
  const f = FORMULES[formule === 'sur-mesure' ? 'tout' : formule];
  return { contenus: new Set(f.contenus), periode: f.periode };
}

/** La formule qui correspond exactement au choix, sinon « sur mesure ». */
export function formuleDuChoix(choix: ChoixHorsLigne): FormuleHorsLigne {
  for (const [nom, f] of Object.entries(FORMULES)) {
    if (f.periode === choix.periode && f.contenus.length === choix.contenus.size
        && f.contenus.every(c => choix.contenus.has(c))) {
      return nom as FormuleHorsLigne;
    }
  }
  return 'sur-mesure';
}

/** Écart en jours entre une date ISO et aujourd'hui (négatif dans le passé). */
export function ecartEnJours(dateIso: string): number {
  const [a, m, j] = dateIso.split('-').map(Number);
  const aujourdhui = new Date();
  const debut = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return (Date.UTC(a, m - 1, j) - debut) / 86_400_000;
}

/** Ce qui a été copié ; null pour ce qu'on n'a pas choisi d'emporter. */
export interface BilanPreparation {
  grilles: number | null;
  feuilles: number | null;
  fiches: number | null;
  photos: number | null;
  /** Les séjours en cours ou proches, avec leur matériel emprunté. */
  sejours?: number | null;
}

export function resumePreparation(bilan: BilanPreparation): string {
  const morceaux = ([
    [bilan.grilles, 'grille', 'grilles'],
    [bilan.feuilles, 'feuille de présence', 'feuilles de présence'],
    [bilan.fiches, 'fiche de sécurité', 'fiches de sécurité'],
    [bilan.photos, 'photo', 'photos'],
    [bilan.sejours ?? null, 'séjour', 'séjours']
  ] as const).filter(([n]) => n !== null) as [number, string, string][];
  // Planning ou Infos élèves seuls : rien à compter.
  if (morceaux.length === 0) return 'Votre choix est disponible hors ligne.';
  if (morceaux.length === 1 && bilan.sejours === 0) {
    return 'Aucun séjour à emporter : aucun n’est en cours ni ne commence dans les 30 jours.';
  }
  if (morceaux.every(([n]) => n === 0)) {
    const rien = morceaux.map(([, singulier]) => singulier).join(' ni ');
    return `Aucune ${rien} à emporter : pas de séance sur la période choisie.`;
  }
  const total = morceaux.reduce((somme, [n]) => somme + n, 0);
  return `${total > 1 ? 'Disponibles' : 'Disponible'} hors ligne : `
    + morceaux.map(([n, s, p]) => pluriel(n, s, p)).join(', ') + '.';
}

/**
 * Sécurité surface : pas de choix à faire, on emporte les fiches de ses
 * séances d'une journée de plongée, aujourd'hui, sinon la prochaine (on
 * prépare souvent la veille au soir) ; null s'il n'y en a plus.
 */
export function journeeAEmporter<S extends { date: string }>(seances: S[]): string | null {
  const aVenir = seances.map(s => s.date).filter(d => ecartEnJours(d) >= 0).sort();
  return aVenir[0] ?? null;
}

export function resumePreparationSurface(journee: string | null, fiches: number): string {
  if (!journee) return 'Aucune séance à venir ne vous est confiée.';
  const [a, m, j] = journee.split('-');
  const jour = `${j}/${m}/${a}`;
  if (fiches === 0) {
    return `Aucune fiche de sécurité établie pour le ${jour} : réessayez quand le directeur de plongée l'aura faite.`;
  }
  return `${fiches > 1 ? 'Disponibles' : 'Disponible'} hors ligne : ${pluriel(fiches, 'fiche de sécurité', 'fiches de sécurité')} du ${jour}.`;
}

/** Les séjours à emporter : en cours, ou qui commencent dans les 30 jours ; pas ceux qui sont finis. */
export function sejoursAEmporter<S extends { dateDebut: string; dateFin: string }>(sejours: S[]): S[] {
  return sejours.filter(s => ecartEnJours(s.dateFin) >= 0 && ecartEnJours(s.dateDebut) <= JOURS_SEANCES_PROCHES);
}

export function seancesAEmbarquer<S extends { date: string }>(seances: S[], periode: PeriodeHorsLigne): S[] {
  const limite = periode === 'jour' ? 0 : JOURS_SEANCES_PROCHES;
  return seances.filter(s => Math.abs(ecartEnJours(s.date)) <= limite);
}
