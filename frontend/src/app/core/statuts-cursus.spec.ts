import { describe, expect, it } from 'vitest';
import { STATUTS_CURSUS, libelleStatutCursus } from './statuts-cursus';

describe('statuts d’un cursus', () => {
  it('propose « Brevet obtenu ailleurs » pour un brevet passé dans une autre structure', () => {
    expect(STATUTS_CURSUS).toContain('OBTENU_AILLEURS');
    expect(libelleStatutCursus('OBTENU_AILLEURS')).toBe('Brevet obtenu ailleurs');
  });

  it('donne un libellé lisible à chaque statut, jamais le code', () => {
    for (const s of STATUTS_CURSUS) expect(libelleStatutCursus(s)).not.toBe(s);
  });

  it('rend tel quel un statut inconnu (serveur plus récent que l’appli)', () => {
    expect(libelleStatutCursus('NOUVEAU')).toBe('NOUVEAU');
  });
});
