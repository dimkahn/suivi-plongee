import { periodeDeLaPlongee, periodeDuMois, plagePeriode } from './progression';

const periode = (moisDebut: number | null, moisFin: number | null, nom: string,
  plongeeDebut: number | null = null, plongeeFin: number | null = null) =>
  ({ moisDebut, moisFin, plongeeDebut, plongeeFin, nom });

describe('Période d\'une progression', () => {
  it('Une période de novembre à février couvre janvier (elle enjambe le changement d\'année)', () => {
    const periodes = [periode(9, 10, 'rentrée'), periode(11, 2, 'hiver')];

    expect(periodeDuMois(periodes, '2027-01-15')?.nom).toBe('hiver');
  });

  it('Un mois que rien ne couvre n\'a pas de période', () => {
    expect(periodeDuMois([periode(9, 10, 'rentrée')], '2027-07-01')).toBeNull();
  });

  it('Au-delà de la dernière étape par plongées, l\'élève reste à la dernière', () => {
    const etapes = [periode(null, null, 'début', 1, 2), periode(null, null, 'validation', 3, 6)];

    expect(periodeDeLaPlongee(etapes, 4)?.nom).toBe('validation');
    expect(periodeDeLaPlongee(etapes, 9)?.nom).toBe('validation');
  });

  it('Le libellé suit le découpage : plongées ou mois', () => {
    expect(plagePeriode(periode(null, null, '', 5, 6))).toBe('plongées 5 – 6');
    expect(plagePeriode(periode(9, 9, ''))).toBe('septembre');
  });
});
