import { CasePlanningVue, PlanningVue } from './modeles';

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Jour de la semaine d'une date ISO (0 = dimanche), en heure locale. */
export function jourDe(date: string): number {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(a, m - 1, j).getDay();
}

/** Code court d'une case, comme dans le tableur du club : « 3 », « 5+6 », « F10 », « F6 », « — », ou l'activité. */
export function codeCase(c: CasePlanningVue, espaces: PlanningVue['espaces']): string {
  switch (c.type) {
    case 'ABSENT': return '—';
    case 'AUCUN': return '?';
    case 'ACTIVITE': return c.activite ?? '';
  }
  const occupes = c.espaces?.length ? c.espaces : [{ id: c.espaceId, nom: c.espace, type: c.espaceType }];
  return occupes.map(o => {
    if (o.type === 'FOSSE') {
      const profondeur = c.profondeurLimitee ?? espaces.find(e => e.id === o.id)?.profondeurMax;
      return 'F' + (profondeur ?? '');
    }
    return o.nom?.match(/(\d+)\s*$/)?.[1] ?? o.nom ?? '';
  }).join('+');
}
