import { notationEntamee } from './notation-entamee';

describe('Fermer « Noter les présents » demande confirmation si la notation est entamée', () => {
  it('Rien de coché ni d\'écrit : on ferme sans question', () => {
    expect(notationEntamee(new Set(), new Map())).toBe(false);
  });

  it('Un critère coché, même sans commentaire : la notation est entamée', () => {
    expect(notationEntamee(new Set([12]), new Map())).toBe(true);
  });

  it('Un commentaire écrit, même sur un critère décoché depuis : il serait perdu', () => {
    expect(notationEntamee(new Set(), new Map([[12, 'Bon palmage']]))).toBe(true);
  });

  it('Un commentaire fait seulement d\'espaces ne compte pas', () => {
    expect(notationEntamee(new Set(), new Map([[12, '   ']]))).toBe(false);
  });
});
