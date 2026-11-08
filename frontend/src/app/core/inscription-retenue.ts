import { CursusVue } from './modeles';

/**
 * Inscription montrée pour un élève dans une liste de personnes : un brevet
 * délivré en cours de saison, puis le niveau suivant, font deux inscriptions
 * pour la même personne. Même règle que `InscriptionRetenue` du serveur
 * (choix du club, 2026-11-08) : en cours ou suspendue, puis validée ou
 * délivrée, puis hors formation ; à égalité, la plus récente. L'ordre des
 * élèves de la liste d'origine est gardé.
 */
export function uneInscriptionParEleve(inscriptions: CursusVue[]): CursusVue[] {
  const parEleve = new Map<number, CursusVue>();
  for (const c of inscriptions) {
    const actuelle = parEleve.get(c.eleveId);
    if (!actuelle || prefere(c, actuelle)) parEleve.set(c.eleveId, c);
  }
  const retenues = new Set(parEleve.values());
  return inscriptions.filter(c => retenues.has(c));
}

function prefere(candidate: CursusVue, actuelle: CursusVue): boolean {
  const rc = rang(candidate);
  const ra = rang(actuelle);
  return rc !== ra ? rc < ra : candidate.id > actuelle.id;
}

function rang(c: CursusVue): number {
  if (c.statut === 'EN_COURS' || c.statut === 'SUSPENDU') return 0;
  if (c.statut === 'ABANDON' || c.statut === 'OBTENU_AILLEURS') return 2;
  return 1;
}
