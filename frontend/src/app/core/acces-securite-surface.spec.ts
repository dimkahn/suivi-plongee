import { finAccesProposee, seancesProposees } from './acces-securite-surface';

const seance = (id: number, date: string, milieu: 'NATUREL' | 'ARTIFICIEL' = 'NATUREL', profondeurMax: number | null = 20) =>
  ({ id, date, ordre: 1, milieu, profondeurMax });

describe('Accès de la sécurité surface', () => {
  it('Propose une semaine après la dernière séance choisie, pour compléter les fiches au retour', () => {
    expect(finAccesProposee(['2026-10-25', '2026-10-24'], '2026-10-20')).toBe('2026-11-01');
  });

  it('Jamais avant aujourd\'hui + 7 jours, même pour des séances passées ; rien sans séance', () => {
    expect(finAccesProposee(['2026-09-26'], '2026-10-20')).toBe('2026-10-27');
    expect(finAccesProposee([], '2026-10-20')).toBeNull();
  });

  it('Ne propose que les séances qui appellent une fiche, de la semaine passée ou à venir, plus celles déjà choisies', () => {
    const liste = seancesProposees([
      seance(1, '2026-10-30'),
      seance(2, '2026-10-30', 'ARTIFICIEL', 4),
      seance(3, '2026-10-30', 'ARTIFICIEL', 20),
      seance(4, '2026-10-01'),
      seance(5, '2026-09-26'),
      seance(6, '2026-10-14')
    ], [5], '2026-10-20');
    expect(liste.map(s => s.id)).toEqual([5, 6, 1, 3]);
  });
});
