import { describe, expect, it } from 'vitest';
import { ParticipantVue } from './sejour-api';
import { filtrerParticipants, manqueDe } from './recherche-participants';

function participant(champs: Partial<ParticipantVue>): ParticipantVue {
  return {
    id: 1, eleveId: null, utilisateurId: null, nom: 'Martin', prenom: 'Léa', plongeur: true,
    telephone: null, email: null, regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null,
    arrivee: null, depart: null, remarques: null, moi: false, membreGroupeId: null, groupe: null,
    attestationAssurance: null, ...champs
  } as ParticipantVue;
}

const complet = { date: '2027-06-03', heure: '18:30' } as ParticipantVue['arrivee'];

describe('Recherche des participants d\'un séjour', () => {
  const lea = participant({ id: 1, prenom: 'Léa', nom: 'Martin', groupe: 'Les Mérous', telephone: '06 12 34 56 78' });
  const hugo = participant({ id: 2, prenom: 'Hugo', nom: 'Dupré', email: 'hugo@exemple.fr',
    arrivee: complet, depart: complet, urgenceNom: 'Maman', attestationAssurance: 'application/pdf' });

  it('sans texte ni filtre, tout le monde', () => {
    expect(filtrerParticipants([lea, hugo], '', 'tous')).toEqual([lea, hugo]);
  });

  it('retrouve par prénom ou nom, sans tenir compte des accents ni de la casse', () => {
    expect(filtrerParticipants([lea, hugo], 'lea', 'tous')).toEqual([lea]);
    expect(filtrerParticipants([lea, hugo], 'DUPRE', 'tous')).toEqual([hugo]);
  });

  it('retrouve par « prénom nom » ou « nom prénom »', () => {
    expect(filtrerParticipants([lea, hugo], 'léa mar', 'tous')).toEqual([lea]);
    expect(filtrerParticipants([lea, hugo], 'martin léa', 'tous')).toEqual([lea]);
  });

  it('retrouve par groupe, e-mail ou téléphone', () => {
    expect(filtrerParticipants([lea, hugo], 'merous', 'tous')).toEqual([lea]);
    expect(filtrerParticipants([lea, hugo], 'hugo@', 'tous')).toEqual([hugo]);
    expect(filtrerParticipants([lea, hugo], '0612', 'tous')).toEqual([lea]);
  });

  it('« À compléter » ne garde que ceux à qui il manque une information', () => {
    expect(filtrerParticipants([lea, hugo], '', 'a-completer')).toEqual([lea]);
  });

  it('« Sans attestation » ne garde que ceux sans attestation d\'assurance', () => {
    expect(filtrerParticipants([lea, hugo], '', 'sans-attestation')).toEqual([lea]);
  });

  it('le texte et le filtre se combinent', () => {
    expect(filtrerParticipants([lea, hugo], 'hugo', 'a-completer')).toEqual([]);
  });

  it('dit ce qui manque à un participant', () => {
    expect(manqueDe(lea)).toEqual(['arrivée', 'départ', 'personne à prévenir']);
    expect(manqueDe(hugo)).toEqual([]);
  });
});
