import { describe, expect, it } from 'vitest';
import { chambresLibres, placer, sansChambre } from './chambres-sejour';
import { LogementVue, ParticipantVue } from './sejour-api';

const personne = (id: number, prenom: string) => ({ id, prenom, nom: 'Test' }) as unknown as ParticipantVue;
const gite: LogementVue = {
  id: 1, nom: 'Gîte des Salins', adresse: '12 chemin des Salins', remarques: 'Clés dans la boîte',
  chambres: [
    { id: 10, nom: 'Chambre 1', couchages: 2, remarques: 'Lit double', occupantIds: [1, 2] },
    { id: 11, nom: 'Chambre 2', couchages: 3, remarques: null, occupantIds: [3] },
    { id: 12, nom: 'Chambre 3', couchages: 2, remarques: null, occupantIds: [] }
  ]
};

describe('Placer un participant sans chambre', () => {
  it('Sans chambre : ceux qui ne sont dans aucune, s\'il y a un logement', () => {
    const tous = [personne(1, 'Jules'), personne(3, 'Camille'), personne(4, 'Mateo')];
    expect(sansChambre(tous, [gite]).map(p => p.id)).toEqual([4]);
    expect(sansChambre(tous, [])).toEqual([]);
  });

  it('Les chambres proposées ont encore un lit, avec leur nombre de lits libres', () => {
    expect(chambresLibres([gite])).toEqual([
      { logementId: 1, chambreId: 11, libelle: 'Gîte des Salins — Chambre 2', libres: 2 },
      { logementId: 1, chambreId: 12, libelle: 'Gîte des Salins — Chambre 3', libres: 2 }
    ]);
  });

  it('Placer garde le logement tel quel et ajoute seulement le participant à la chambre choisie', () => {
    expect(placer(gite, 12, 4)).toEqual({
      nom: 'Gîte des Salins', adresse: '12 chemin des Salins', remarques: 'Clés dans la boîte',
      chambres: [
        { nom: 'Chambre 1', couchages: 2, remarques: 'Lit double', occupantIds: [1, 2] },
        { nom: 'Chambre 2', couchages: 3, remarques: null, occupantIds: [3] },
        { nom: 'Chambre 3', couchages: 2, remarques: null, occupantIds: [4] }
      ]
    });
  });
});
