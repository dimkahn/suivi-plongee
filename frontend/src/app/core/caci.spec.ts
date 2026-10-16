import { couleurCaci, etatCaci, finValiditeCaci } from './caci';

describe('CACI', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 16, 12) }));
  afterEach(() => vi.useRealTimers());

  it('La fin de validité est un an après l\'examen, le 28 février pour un examen un 29 février', () => {
    expect(finValiditeCaci('2026-10-16')).toBe('2027-10-16');
    expect(finValiditeCaci('2028-02-29')).toBe('2029-02-28');
  });

  it('État selon la fin de validité : expiré, bientôt (30 jours), valide, absent', () => {
    expect(etatCaci('2026-10-15')).toBe('expire');
    expect(etatCaci('2026-11-10')).toBe('bientot');
    expect(etatCaci('2027-03-01')).toBe('valide');
    expect(etatCaci(null)).toBe('absent');
  });

  it('Couleur : rouge à moins de 15 jours, orange à moins d\'un mois, vert au-delà', () => {
    expect(couleurCaci('2026-10-25')).toBe('rouge');
    expect(couleurCaci('2026-11-10')).toBe('orange');
    expect(couleurCaci('2027-03-01')).toBe('vert');
    expect(couleurCaci('2026-10-01')).toBeNull();
  });
});
