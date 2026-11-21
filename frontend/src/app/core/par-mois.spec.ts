import { parMois } from './par-mois';

describe('Une liste datée regroupée par mois', () => {
  const fiches = [
    { id: 1, date: '2027-06-30' }, { id: 2, date: '2027-06-05' },
    { id: 3, date: '2026-11-18' }, { id: 4, date: '2026-10-02' }
  ];

  it('Un groupe par mois, dans l\'ordre de la liste, avec son libellé en français', () => {
    const mois = parMois(fiches, f => f.date, '2026-11-21');
    expect(mois.map(m => m.libelle)).toEqual(['Juin 2027', 'Novembre 2026', 'Octobre 2026']);
    expect(mois[0].elements.map(f => f.id)).toEqual([1, 2]);
  });

  it('Les mois avant celui d\'aujourd\'hui sont passés ; le mois en cours ne l\'est pas', () => {
    const mois = parMois(fiches, f => f.date, '2026-11-21');
    expect(mois.map(m => m.passe)).toEqual([false, false, true]);
  });
});
