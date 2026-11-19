import { dateFr } from './date-fr';
import { SeanceSortieVue } from './modeles';

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** Une plongée d'une sortie : « sam. 10/10/2026 · plongée 1 · Blaisy – Le Tombant (Bateau 2) ». */
export function libelleSeanceSortie(se: SeanceSortieVue): string {
  const [a, m, j] = se.date.split('-').map(Number);
  const jour = JOURS[new Date(a, m - 1, j).getDay()];
  const lieu = [se.lieu, se.site].filter(Boolean).join(' – ');
  return [`${jour} ${dateFr(se.date)}`, se.ordre ? `plongée ${se.ordre}` : null,
    lieu ? lieu + (se.commentaire ? ` (${se.commentaire})` : '') : se.commentaire]
    .filter(Boolean).join(' · ');
}
