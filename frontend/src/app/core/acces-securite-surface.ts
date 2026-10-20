/**
 * Choix des séances confiées à un compte « sécurité surface » et de sa date
 * de fin d'accès (écran Administration › Sécurité surface).
 */

/** Jours laissés après la dernière séance pour compléter les fiches au retour. */
export const JOURS_APRES_DERNIERE_SEANCE = 7;

/** Séances récentes encore proposées : une fiche se complète parfois quelques jours après. */
const JOURS_PASSES_PROPOSES = 7;

interface SeanceChoisissable {
  id: number;
  date: string;
  ordre: number;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  profondeurMax: number | null;
}

function ajouterJours(date: string, jours: number): string {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + jours));
  return d.toISOString().slice(0, 10);
}

/** Une semaine après la dernière séance, jamais moins d'une semaine à partir d'aujourd'hui ; null sans séance. */
export function finAccesProposee(dates: string[], aujourdhui: string): string | null {
  if (dates.length === 0) return null;
  const derniere = [...dates, aujourdhui].sort().at(-1)!;
  return ajouterJours(derniere, JOURS_APRES_DERNIERE_SEANCE);
}

/**
 * Séances qui appellent une fiche (milieu naturel ou plus de 6 m, A322-98),
 * de la semaine passée ou à venir, plus celles déjà choisies ; par date.
 */
export function seancesProposees<S extends SeanceChoisissable>(seances: S[], choisies: number[], aujourdhui: string): S[] {
  const depuis = ajouterJours(aujourdhui, -JOURS_PASSES_PROPOSES);
  return seances
    .filter(s => choisies.includes(s.id)
      || ((s.milieu === 'NATUREL' || (s.profondeurMax ?? 0) > 6) && s.date >= depuis))
    .sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre);
}
