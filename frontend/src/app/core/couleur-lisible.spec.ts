import { contraste, couleurLisible } from './couleur-lisible';

describe('Une couleur de marque lisible au soleil', () => {
  it('Une couleur déjà assez foncée reste telle quelle', () => {
    expect(couleurLisible('#0E7490')).toBe('#0E7490');
    expect(couleurLisible('#0C3547')).toBe('#0C3547');
  });

  it('Une couleur trop claire est assombrie jusqu\'à 4,5:1 sur blanc, sans aller plus loin que nécessaire', () => {
    const lisible = couleurLisible('#0891B2');
    expect(contraste(lisible, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(lisible, '#FFFFFF')).toBeLessThan(5);
  });

  it('Elle garde sa teinte : un bleu reste un bleu', () => {
    const lisible = couleurLisible('#38BDF8');
    const [r, g, b] = [1, 3, 5].map(i => parseInt(lisible.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(contraste(lisible, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});
