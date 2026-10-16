import { describe, expect, it } from 'vitest';
import { voyagesDuJour } from './programme-du-jour';
import { ParticipantVue, copieTrajet, texteTrajet, trajetSaisi } from './sejour-api';

describe('Trajet du voyage retour', () => {
  const retour = {
    date: '2027-06-07', heure: '20:10:00', transport: 'AVION' as const, numero: 'AF7527',
    lieu: 'Aéroport de Toulon-Hyères', heureArrivee: '21:35:00'
  };

  it("donne l'heure d'arrivée de l'avion ou du train", () => {
    expect(texteTrajet(retour)).toContain('arrivée à 21h35');
  });

  it("garde l'heure d'arrivée au format du champ", () => {
    expect(copieTrajet(retour).heureArrivee).toBe('21:35');
  });

  it("un trajet avec seulement l'heure d'arrivée n'est pas vide", () => {
    expect(trajetSaisi({ date: null, heure: null, transport: null, numero: null, lieu: null, heureArrivee: '21:35' }))
      .not.toBeNull();
  });
});

describe("Voyage retour dans l'encart « Aujourd'hui »", () => {
  it("donne l'heure d'arrivée de l'avion du retour", () => {
    const p: ParticipantVue = {
      id: 1, eleveId: null, utilisateurId: null, nom: 'Roux', prenom: 'Inès', plongeur: true, telephone: null,
      email: null, regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null, arrivee: null,
      depart: { date: '2027-06-07', heure: '20:10:00', transport: 'AVION' as const, numero: 'AF7527', lieu: 'Toulon',
        heureArrivee: '21:35:00' },
      remarques: null, moi: false, membreGroupeId: null, groupe: null
    };
    expect(voyagesDuJour([p], '2027-06-07')[0].arrivee).toBe('21h35');
  });
});
