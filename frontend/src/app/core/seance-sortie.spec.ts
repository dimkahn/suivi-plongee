import { libelleSeanceSortie } from './seance-sortie';
import { SeanceSortieVue } from './modeles';

function seance(champs: Partial<SeanceSortieVue>): SeanceSortieVue {
  return { id: 1, date: '2026-10-10', ordre: null, milieu: 'NATUREL', lieu: null, site: null, commentaire: null, ...champs };
}

describe("Le libellé d'une plongée de sortie", () => {
  it('dit le jour, le n° de plongée, le lieu, le site et le commentaire', () => {
    expect(libelleSeanceSortie(seance({ ordre: 1, lieu: 'Blaisy', site: 'Le Tombant', commentaire: 'Bateau 2' })))
      .toBe('sam. 10/10/2026 · plongée 1 · Blaisy – Le Tombant (Bateau 2)');
  });

  it("se contente de la date quand on ne sait rien d'autre", () => {
    expect(libelleSeanceSortie(seance({}))).toBe('sam. 10/10/2026');
  });

  it('garde le commentaire seul, sans lieu', () => {
    expect(libelleSeanceSortie(seance({ date: '2026-10-11', commentaire: 'Bateau 1' }))).toBe('dim. 11/10/2026 · Bateau 1');
  });
});
