import { PalanqueeVue } from './modeles';

/**
 * Où en est une palanquée au retour de plongée : pas encore immergée, à
 * l'eau, ou sortie. Une heure de sortie saisie à la main, même sans
 * immersion, vaut sortie : on ne la croit jamais encore à l'eau.
 */
export type EtatPalanquee = 'a-immerger' | 'a-l-eau' | 'sortie';

export function etatPalanquee(p: PalanqueeVue): EtatPalanquee {
  if (p.heureSortie) return 'sortie';
  return p.heureImmersion ? 'a-l-eau' : 'a-immerger';
}

/** « 10:05 » (ou « 10:05:30 », d'un champ heure corrigé) en minutes depuis minuit ; null si illisible. */
function enMinutes(heure: string | null): number | null {
  const correspondance = (heure ?? '').match(/^(\d{1,2}):(\d{2})/);
  return correspondance ? Number(correspondance[1]) * 60 + Number(correspondance[2]) : null;
}

/** Minutes entre deux heures du même jour ; une plongée de nuit qui passe minuit reste positive. */
export function dureeEntre(debut: string | null, fin: string | null): number | null {
  const d = enMinutes(debut), f = enMinutes(fin);
  if (d === null || f === null) return null;
  return (f - d + 24 * 60) % (24 * 60);
}

/** L'heure de sortie, et la durée réalisée calculée depuis l'immersion si elle n'est pas déjà saisie. */
export function marquerSortie(p: PalanqueeVue, heure: string): PalanqueeVue {
  return { ...p, heureSortie: heure, dureeRealisee: p.dureeRealisee ?? dureeEntre(p.heureImmersion, heure) };
}

/** Minutes passées à l'eau depuis l'heure d'immersion, à l'heure de l'horloge. */
export function minutesDepuis(heure: string, maintenant: Date): number | null {
  return dureeEntre(heure, `${maintenant.getHours()}:${String(maintenant.getMinutes()).padStart(2, '0')}`);
}

/**
 * Les palanquées en dépassement de leur durée prévue d'abord, puis celles
 * qui approchent de leur sortie : l'information de sécurité la plus urgente
 * ne reste jamais hors de l'écran. Les autres gardent leur ordre (tri stable).
 */
export function trierParUrgence(palanquees: PalanqueeVue[],
                                statut: (p: PalanqueeVue) => 'attention' | 'urgence' | null): PalanqueeVue[] {
  const rang = (p: PalanqueeVue) => {
    const s = statut(p);
    return s === 'urgence' ? 0 : s === 'attention' ? 1 : 2;
  };
  return [...palanquees].sort((a, b) => rang(a) - rang(b));
}

/**
 * Profondeur ou durée réalisée au-delà du prévu : en rouge à l'écran, comme
 * sur la fiche imprimée (Palanquee.profondeurDepassee côté serveur).
 */
export function depassements(p: PalanqueeVue): { profondeur: boolean; duree: boolean } {
  const depasse = (realise: number | null, prevu: number | null) => realise != null && prevu != null && realise > prevu;
  return { profondeur: depasse(p.profondeurRealisee, p.profondeurPrevue), duree: depasse(p.dureeRealisee, p.dureePrevue) };
}

/**
 * Le bandeau de la sécurité surface : combien de palanquées sont à
 * immerger, à l'eau, sorties, et, parmi les sorties, combien attendent
 * encore leur profondeur ou leur durée réalisée.
 */
export function bilanRealise(palanquees: PalanqueeVue[]): { aImmerger: number; aLEau: number; sorties: number; aCompleter: number } {
  const etats = palanquees.map(etatPalanquee);
  return {
    aImmerger: etats.filter(e => e === 'a-immerger').length,
    aLEau: etats.filter(e => e === 'a-l-eau').length,
    sorties: etats.filter(e => e === 'sortie').length,
    aCompleter: palanquees.filter(p => etatPalanquee(p) === 'sortie'
      && (p.profondeurRealisee == null || p.dureeRealisee == null)).length
  };
}
