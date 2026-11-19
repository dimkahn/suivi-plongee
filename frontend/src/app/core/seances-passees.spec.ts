import { separerSeancesPassees } from './seances-passees';

const seance = (date: string) => ({ date });

describe('Les séances passées de l\'administration', () => {
  it('Une séance d\'avant aujourd\'hui est passée ; celle du jour et les suivantes sont à venir', () => {
    const { aVenir, passees } = separerSeancesPassees(
      [seance('2026-11-12'), seance('2026-11-19'), seance('2026-11-26')], '2026-11-19');
    expect(aVenir.map(s => s.date)).toEqual(['2026-11-19', '2026-11-26']);
    expect(passees.map(s => s.date)).toEqual(['2026-11-12']);
  });

  it('L\'ordre de la liste est gardé', () => {
    const { aVenir } = separerSeancesPassees(
      [seance('2026-12-03'), seance('2026-11-20'), seance('2026-12-01')], '2026-11-19');
    expect(aVenir.map(s => s.date)).toEqual(['2026-12-03', '2026-11-20', '2026-12-01']);
  });

  it('Une liste vide donne deux listes vides', () => {
    expect(separerSeancesPassees([], '2026-11-19')).toEqual({ aVenir: [], passees: [] });
  });
});
