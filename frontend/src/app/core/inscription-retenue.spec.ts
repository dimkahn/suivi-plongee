import { CursusVue } from './modeles';
import { uneInscriptionParEleve } from './inscription-retenue';

const cursus = (id: number, eleveId: number, niveau: 'N1' | 'N2' | 'N3', statut: string): CursusVue =>
  ({ id, eleveId, eleve: `Élève ${eleveId}`, niveau, saison: '2026-2027', statut });

describe('Une inscription par élève dans une liste de personnes', () => {
  it('Un élève breveté en cours de saison puis inscrit au niveau suivant n\'apparaît qu\'au niveau qu\'il prépare', () => {
    const n1 = cursus(10, 1, 'N1', 'DELIVRE');
    const n2 = cursus(11, 1, 'N2', 'EN_COURS');
    expect(uneInscriptionParEleve([n1, n2])).toEqual([n2]);
  });

  it('Sans inscription en cours, la plus récente ; un abandon ne l\'emporte pas sur un brevet délivré', () => {
    const delivre = cursus(10, 1, 'N1', 'DELIVRE');
    const abandon = cursus(12, 1, 'N2', 'ABANDON');
    const seul = cursus(11, 2, 'N1', 'EN_COURS');
    expect(uneInscriptionParEleve([delivre, seul, abandon])).toEqual([delivre, seul]);
  });
});
