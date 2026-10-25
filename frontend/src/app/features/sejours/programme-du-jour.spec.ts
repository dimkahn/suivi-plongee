import { describe, expect, it } from 'vitest';
import { programmeParJour } from './programme-du-jour';
import { EvenementVue, JourneeVue } from './sejour-api';

describe('Le programme jour par jour, avec la présentation des journées', () => {
  const rendezVous: EvenementVue = {
    id: 1, jour: '2027-06-04', heureDebut: '08:00:00', heureFin: null, titre: 'Rendez-vous au ponton',
    lieu: 'Port d’Hyères', details: null
  };
  const journee = (jour: string, titre: string | null): JourneeVue => ({
    jour, titre, trajet: null, descriptif: null, conseil: null, hebergement: null, photos: []
  });

  it('chaque jour porte sa présentation, ou rien', () => {
    const jours = programmeParJour([rendezVous], [], [], [journee('2027-06-04', 'Jour 1 — Port-Cros')]);
    expect(jours).toHaveLength(1);
    expect(jours[0].journee?.titre).toBe('Jour 1 — Port-Cros');
    expect(jours[0].lignes[0].titre).toBe('Rendez-vous au ponton');
    expect(programmeParJour([rendezVous], [])[0].journee).toBeNull();
  });

  it('un jour présenté sans rendez-vous apparaît aussi, à sa place', () => {
    const jours = programmeParJour([rendezVous], [], [],
      [journee('2027-06-05', 'Jour 2 — Le Donator'), journee('2027-06-03', 'Le voyage')]);
    expect(jours.map(j => j.jour)).toEqual(['2027-06-03', '2027-06-04', '2027-06-05']);
    expect(jours[0].lignes).toEqual([]);
    expect(jours[2].journee?.titre).toBe('Jour 2 — Le Donator');
  });
});
