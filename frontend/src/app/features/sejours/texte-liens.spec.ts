import { describe, expect, it } from 'vitest';
import { texteAvecLiens } from './texte-liens';

describe('texteAvecLiens', () => {
  it("rend cliquable l'adresse web du conseil d'assurance, sans le point qui la suit", () => {
    expect(texteAvecLiens('Souscrivez sur https://www.lafont.example/contrat.aspx. Merci')).toEqual([
      { texte: 'Souscrivez sur ', lien: null },
      { texte: 'https://www.lafont.example/contrat.aspx', lien: 'https://www.lafont.example/contrat.aspx' },
      { texte: '. Merci', lien: null }
    ]);
  });

  it('laisse un texte sans adresse tel quel', () => {
    expect(texteAvecLiens('Pas de lien ici')).toEqual([{ texte: 'Pas de lien ici', lien: null }]);
  });

  it("ne fait pas un lien d'une adresse qui n'est ni http ni https", () => {
    expect(texteAvecLiens('javascript:alert(1)')).toEqual([{ texte: 'javascript:alert(1)', lien: null }]);
  });
});
