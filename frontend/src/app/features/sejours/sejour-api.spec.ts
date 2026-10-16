import { describe, expect, it } from 'vitest';
import { jourDuDepart, voyagesDuJour } from './programme-du-jour';
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

describe("Jour de départ et jour d'arrivée d'un vol long", () => {
  const aller = {
    date: '2027-06-07', heure: '07:15:00', transport: 'AVION' as const, numero: 'TX540', lieu: 'Pointe-à-Pitre',
    heureDepart: '21:40:00', lieuDepart: 'Paris-Orly', dateDepart: '2027-06-05'
  };
  const retour = {
    date: '2027-06-14', heure: '22:30:00', transport: 'AVION' as const, numero: 'TX541', lieu: 'Pointe-à-Pitre',
    heureArrivee: '06:10:00', dateArrivee: '2027-06-16'
  };

  it("donne le jour de départ de l'avion aller s'il n'est pas celui de l'arrivée", () => {
    expect(texteTrajet(aller)).toContain('départ le samedi 05/06/2027 à 21h40 de Paris-Orly');
  });

  it("donne le jour d'arrivée de l'avion retour s'il n'est pas celui du départ", () => {
    expect(texteTrajet(retour)).toContain('arrivée le mercredi 16/06/2027 à 06h10');
  });

  it('ne répète pas le jour quand il est le même', () => {
    expect(texteTrajet({ ...retour, dateArrivee: '2027-06-14' })).toContain('arrivée à 06h10');
  });

  it('garde les jours dans la copie du formulaire', () => {
    expect(copieTrajet(aller).dateDepart).toBe('2027-06-05');
    expect(copieTrajet(retour).dateArrivee).toBe('2027-06-16');
  });

  it("un trajet avec seulement un jour de départ n'est pas vide", () => {
    expect(trajetSaisi({ date: null, heure: null, transport: null, numero: null, lieu: null, dateDepart: '2027-06-05' }))
      .not.toBeNull();
  });

  it("l'encart « Aujourd'hui » montre le voyage aller le jour où l'avion part", () => {
    expect(jourDuDepart(aller, 'aller')).toBe('2027-06-05');
  });

  it("l'encart « Aujourd'hui » dit le jour d'arrivée du retour", () => {
    const p: ParticipantVue = {
      id: 1, eleveId: null, utilisateurId: null, nom: 'Roux', prenom: 'Inès', plongeur: true, telephone: null,
      email: null, regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null, arrivee: null,
      depart: retour, remarques: null, moi: false, membreGroupeId: null, groupe: null
    };
    expect(voyagesDuJour([p], '2027-06-14')[0].arrivee).toBe('mercredi 16/06/2027 à 06h10');
  });

  it("l'encart « Aujourd'hui » dit le jour d'arrivée de l'aller quand l'avion part un autre jour", () => {
    const p: ParticipantVue = {
      id: 1, eleveId: null, utilisateurId: null, nom: 'Roux', prenom: 'Inès', plongeur: true, telephone: null,
      email: null, regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null, arrivee: aller,
      depart: null, remarques: null, moi: false, membreGroupeId: null, groupe: null
    };
    expect(voyagesDuJour([p], '2027-06-05')[0].arrivee).toBe('lundi 07/06/2027 à 07h15, Pointe-à-Pitre');
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
