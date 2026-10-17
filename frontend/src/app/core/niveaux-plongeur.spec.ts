import { aptitudeSurFiche, separerAptitude } from './niveaux-plongeur';

describe('Niveaux d\'un plongeur de groupe repris sur une fiche de sécurité', () => {
  it('La fiche montre le niveau d\'encadrement puis le niveau de plongeur', () => {
    expect(aptitudeSurFiche({ aptitude: 'N3', niveauEncadrement: 'E1' })).toBe('E1 · N3');
  });

  it('Un seul des deux niveaux suffit ; aucun, la case reste vide', () => {
    expect(aptitudeSurFiche({ aptitude: 'N2', niveauEncadrement: null })).toBe('N2');
    expect(aptitudeSurFiche({ aptitude: ' ', niveauEncadrement: 'E2' })).toBe('E2');
    expect(aptitudeSurFiche({ aptitude: null })).toBeNull();
  });

  it('Un groupe créé depuis une fiche range les codes d\'encadrement à part', () => {
    expect(separerAptitude('E1 · N3')).toEqual({ aptitude: 'N3', niveauEncadrement: 'E1' });
    expect(separerAptitude('MF1 N4')).toEqual({ aptitude: 'N4', niveauEncadrement: 'MF1' });
    expect(separerAptitude('E2')).toEqual({ aptitude: null, niveauEncadrement: 'E2' });
  });

  it('Un texte sans code d\'encadrement reste le niveau de plongeur, tel quel', () => {
    expect(separerAptitude('PE40 PA20')).toEqual({ aptitude: 'PE40 PA20', niveauEncadrement: null });
    expect(separerAptitude('Niveau 3')).toEqual({ aptitude: 'Niveau 3', niveauEncadrement: null });
    expect(separerAptitude(null)).toEqual({ aptitude: null, niveauEncadrement: null });
  });
});
