import { CasePlanningVue, PlanningVue } from './modeles';

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Jour de la semaine d'une date ISO (0 = dimanche), en heure locale. */
export function jourDe(date: string): number {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(a, m - 1, j).getDay();
}

/** Code court d'une case, comme dans le tableur du club : « 3 », « F10 », « F6 », « — », ou l'activité. */
export function codeCase(c: CasePlanningVue, espaces: PlanningVue['espaces']): string {
  switch (c.type) {
    case 'ABSENT': return '—';
    case 'AUCUN': return '?';
    case 'ACTIVITE': return c.activite ?? '';
  }
  if (c.espaceType === 'FOSSE') {
    const profondeur = c.profondeurLimitee ?? espaces.find(e => e.id === c.espaceId)?.profondeurMax;
    return 'F' + (profondeur ?? '');
  }
  return c.espace?.match(/(\d+)\s*$/)?.[1] ?? c.espace ?? '';
}
