import { initiales } from './initiales';

describe('Les initiales d\'une vignette sans photo', () => {
  it('La première lettre des deux premiers mots, en majuscules', () => {
    expect(initiales('Camille Berthier')).toBe('CB');
    expect(initiales('jules ferrand')).toBe('JF');
  });

  it('Pas plus de deux lettres, et les espaces en trop ne comptent pas', () => {
    expect(initiales('  Marie  Claire Dupont ')).toBe('MC');
  });

  it('Prénom et nom séparés : leur première lettre, même pour un prénom en deux mots', () => {
    expect(initiales({ prenom: 'Jean Pierre', nom: 'Martin' })).toBe('JM');
    expect(initiales({ prenom: '', nom: 'Martin' })).toBe('M');
  });

  it('Un seul mot, ou rien', () => {
    expect(initiales('Mateo')).toBe('M');
    expect(initiales('')).toBe('');
  });
});
