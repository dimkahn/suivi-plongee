import { describe, expect, it } from 'vitest';
import { conseilDepart } from './programme-du-jour';
import { Trajet, copieTrajet, trajetSaisi } from './sejour-api';
import { carteVoyage, compagnieDuVol, enregistrement, memeVoyageQue } from './voyage';

const aller: Trajet = {
  date: '2026-10-22', heure: '15:05:00', transport: 'AVION', numero: 'TX 510', lieu: 'Fort-de-France',
  heureDepart: '12:20:00', lieuDepart: 'Paris-Orly', terminal: '4', dossier: 'ABC123',
  ouvertureEnregistrement: '2026-10-20T12:20:00'
};
const retour: Trajet = {
  date: '2026-11-02', heure: '18:25:00', transport: 'AVION', numero: 'TX511', lieu: 'Fort-de-France',
  heureArrivee: '07:40:00', lieuArrivee: 'Paris-Orly'
};

describe('Compagnie du vol', () => {
  it('est reconnue par les deux lettres du numéro de vol, avec ou sans espace', () => {
    expect(compagnieDuVol('TX 510')?.nom).toBe('Air Caraïbes');
    expect(compagnieDuVol('af7520')?.nom).toBe('Air France');
  });

  it("n'est pas devinée pour un numéro inconnu ou un train", () => {
    expect(compagnieDuVol('ZZ123')).toBeNull();
    expect(compagnieDuVol('TGV 6171')).toBeNull();
    expect(compagnieDuVol(null)).toBeNull();
  });
});

describe('Carte du voyage', () => {
  it("à l'aller, part de l'aéroport de départ et arrive sur place", () => {
    const c = carteVoyage(aller, true);
    expect(c.depart).toEqual({ heure: '12h20', jour: '2026-10-22', lieu: 'Paris-Orly', terminal: '4' });
    expect(c.arrivee).toEqual({ heure: '15h05', jour: '2026-10-22', lieu: 'Fort-de-France', terminal: null });
    expect(c.joursEnPlus).toBe(0);
  });

  it('au retour, un avion qui arrive plus tôt qu\'il ne part arrive le lendemain : « +1 jour »', () => {
    const c = carteVoyage(retour, false);
    expect(c.depart.lieu).toBe('Fort-de-France');
    expect(c.arrivee).toEqual({ heure: '07h40', jour: '2026-11-03', lieu: 'Paris-Orly', terminal: null });
    expect(c.joursEnPlus).toBe(1);
  });

  it("à l'aller, un vol de nuit part la veille", () => {
    const c = carteVoyage({ ...aller, heureDepart: '22:30', heure: '06:10' }, true);
    expect(c.depart.jour).toBe('2026-10-21');
    expect(c.joursEnPlus).toBe(1);
  });
});

describe("Ouverture de l'enregistrement", () => {
  it("annonce le jour où l'enregistrement ouvre", () => {
    expect(enregistrement(aller, true, new Date(2026, 9, 19, 9, 0)))
      .toEqual({ etat: 'bientot', texte: "L'enregistrement ouvre le mardi 20/10 à 12h20" });
  });

  it("dit l'enregistrement ouvert jusqu'au départ, puis plus rien", () => {
    expect(enregistrement(aller, true, new Date(2026, 9, 21, 8, 0)))
      .toEqual({ etat: 'ouvert', texte: 'Enregistrement ouvert' });
    expect(enregistrement(aller, true, new Date(2026, 9, 22, 13, 0))).toBeNull();
  });

  it("sans date d'ouverture, ne dit rien", () => {
    expect(enregistrement(retour, false, new Date(2026, 9, 19))).toBeNull();
  });
});

describe("Heure d'être sur place", () => {
  it("en avion, 3 heures avant le départ", () => {
    expect(conseilDepart('AVION', '12:20')).toBe("Soyez à l'aéroport vers 09h20 (3 h avant).");
  });
});

describe('« Même voyage que… »', () => {
  it("reprend le vol de l'autre sans son dossier ni son lien, et garde ceux de la fiche", () => {
    const autre: Trajet = { ...aller, dossier: 'AUTRE1', lienEnregistrement: 'https://x.example/AUTRE1' };
    const siens: Trajet = { ...retour, dossier: 'MIEN22', lienEnregistrement: null };
    const t = memeVoyageQue(autre, siens);
    expect(t.numero).toBe('TX 510');
    expect(t.terminal).toBe('4');
    expect(t.dossier).toBe('MIEN22');
    expect(t.lienEnregistrement).toBeNull();
  });
});

describe('Réservation dans le formulaire', () => {
  it('garde le dossier, le terminal, le lien et l\'ouverture au format du champ', () => {
    const c = copieTrajet({ ...aller, lienEnregistrement: 'https://x.example' });
    expect(c.dossier).toBe('ABC123');
    expect(c.terminal).toBe('4');
    expect(c.lienEnregistrement).toBe('https://x.example');
    expect(c.ouvertureEnregistrement).toBe('2026-10-20T12:20');
  });

  it("un trajet avec seulement un numéro de dossier n'est pas vide", () => {
    expect(trajetSaisi({ date: null, heure: null, transport: null, numero: null, lieu: null, dossier: 'ABC123' }))
      .not.toBeNull();
  });
});
