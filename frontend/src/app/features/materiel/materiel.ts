import { EquipementVue } from '../../core/modeles';

/** « 12 L acier nitrox, Roth », « Aqualung Legend », « Beuchat Focea, 7 mm, taille M ». */
export function descriptionEquipement(e: EquipementVue): string {
  const morceaux: string[] = [];
  if (e.type === 'BLOC' && e.volumeLitres != null) {
    morceaux.push(`${e.volumeLitres} L${e.matiere ? ' ' + e.matiere.toLowerCase() : ''}${e.nitrox ? ' nitrox' : ''}`);
  }
  const modele = [e.marque, e.modele].filter(Boolean).join(' ');
  if (modele) morceaux.push(modele);
  if (e.epaisseurMm != null) morceaux.push(`${e.epaisseurMm} mm`);
  if (e.taille) morceaux.push(`taille ${e.taille}`);
  return morceaux.join(', ');
}

/** L'échéance la plus proche parmi celles que le serveur a calculées. */
export function prochaineEcheance(e: EquipementVue): { libelle: string; date: string } | null {
  if (e.statut === 'REBUTE') return null;
  const echeances = [
    { libelle: 'Prochaine inspection TIV', date: e.prochaineInspection },
    { libelle: 'Prochaine requalification', date: e.prochaineRequalification },
    { libelle: 'Prochaine révision', date: e.prochaineRevision },
    { libelle: 'Mise au rebut prévue', date: e.dateRebutPrevue }
  ].filter((x): x is { libelle: string; date: string } => !!x.date);
  echeances.sort((a, b) => a.date.localeCompare(b.date));
  return echeances[0] ?? null;
}
