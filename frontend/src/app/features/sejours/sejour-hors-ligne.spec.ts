import { describe, expect, it } from 'vitest';
import { ParticipantVue, SejourVue } from './sejour-api';
import {
  ModificationEnAttente, NouvelleModification, appliquerEnAttente, comptesFrais, issueEchec, lectureEchouee,
  ranger, remplacerParticipant, repartir, requete
} from './sejour-hors-ligne';

function participant(id: number, prenom: string, moi = false): ParticipantVue {
  return {
    id, eleveId: null, utilisateurId: null, nom: 'Test', prenom, plongeur: true, telephone: null, email: null,
    regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null, arrivee: null, depart: null,
    remarques: null, moi, membreGroupeId: null, groupe: null
  };
}

function sejour(): SejourVue {
  return {
    sortie: { id: 7, nom: 'Port-Cros' } as SejourVue['sortie'],
    gere: true, organisateurs: [], peutDesigner: true, encadrant: true, infosPratiques: 'Rendez-vous au port',
    participants: [participant(1, 'Anne', true), participant(2, 'Bruno'), participant(3, 'Chloé')],
    voitures: [{ id: 10, nom: 'Clio', places: 5, conducteurId: 1, trajet: null, remarques: null, passagerIds: [2, 3] }],
    logements: [{ id: 20, nom: 'Gîte', adresse: null, remarques: null,
                  chambres: [{ id: 21, nom: 'Ch. 1', couchages: 2, remarques: null, occupantIds: [2] }] }],
    affaires: [], evenements: [],
    frais: {
      depenses: [], versements: [],
      comptes: { totalCentimes: 0, soldes: [], remboursements: [] },
      droits: { moiId: 1, peutAjouter: true, pourLesAutres: true, depensesModifiables: [], versementsSupprimables: [],
                lireNotes: false }
    },
    avertissements: [], groupesProposes: [], palanquees: []
  };
}

const nouvelle = (modification: NouvelleModification['modification']): NouvelleModification =>
  ({ sejourId: 7, nomSejour: 'Port-Cros', modification, libelle: 'test' });

describe('Modifications du séjour gardées sans réseau', () => {
  it('une nouvelle version du même état remplace la précédente, à son rang', () => {
    let file = ranger([], nouvelle({ type: 'infos', texte: 'A' }), 'r1', 1000);
    file = ranger(file, nouvelle({ type: 'voiture', id: 10, demande: { nom: 'Clio', places: 4, conducteurId: 1,
      trajet: null, remarques: null, passagerIds: [] } }), 'r2', 2000);
    file = ranger(file, nouvelle({ type: 'infos', texte: 'B' }), 'r3', 3000);
    expect(file).toHaveLength(2);
    expect(file[0].modification).toEqual({ type: 'infos', texte: 'B' });
    expect(file[0].ordre).toBe(1000);
  });

  it('chaque ajout est gardé à part, avec un id provisoire négatif', () => {
    const v = { nom: 'Kangoo', places: 7, conducteurId: null, trajet: null, remarques: null, passagerIds: [] };
    let file = ranger([], nouvelle({ type: 'voiture', id: null, demande: v }), 'r1', 1000);
    file = ranger(file, nouvelle({ type: 'voiture', id: null, demande: { ...v, nom: 'Twingo' } }), 'r2', 1000);
    expect(file).toHaveLength(2);
    expect(file.map(e => e.idProvisoire)).toEqual([-1000, -1001]);
    expect(file.map(e => e.reference)).toEqual(['r1', 'r2']);
  });

  it('modifier ce qui a été ajouté sans réseau change l\'ajout ; le supprimer le retire de la file', () => {
    const v = { nom: 'Kangoo', places: 7, conducteurId: null, trajet: null, remarques: null, passagerIds: [] };
    let file = ranger([], nouvelle({ type: 'voiture', id: null, demande: v }), 'r1', 1000);
    file = ranger(file, nouvelle({ type: 'voiture', id: -1000, demande: { ...v, places: 9 } }), 'r2', 2000);
    expect(file).toHaveLength(1);
    expect(file[0].modification).toEqual({ type: 'voiture', id: null, demande: { ...v, places: 9 } });
    expect(file[0].reference).toBe('r1');
    expect(ranger(file, nouvelle({ type: 'suppression', objet: 'voiture', id: -1000 }), 'r3', 3000)).toEqual([]);
  });

  it('supprimer un objet remplace la modification qui l\'attendait', () => {
    let file = ranger([], nouvelle({ type: 'evenement', id: 5, demande: { jour: '2027-06-05', heureDebut: null,
      heureFin: null, titre: 'Apéritif', lieu: null, details: null } }), 'r1', 1000);
    file = ranger(file, nouvelle({ type: 'suppression', objet: 'evenement', id: 5 }), 'r2', 2000);
    expect(file.map(e => e.modification.type)).toEqual(['suppression']);
  });

  it('une création part en POST avec sa référence ; une modification en PUT ; une suppression en DELETE', () => {
    expect(requete(7, { type: 'versement', demande: { deId: 2, aId: 1, montantCentimes: 500, jour: null } }))
      .toMatchObject({ methode: 'POST', url: '/api/sejours/7/versements', creation: true });
    expect(requete(7, { type: 'infos', texte: 'X' }))
      .toEqual({ methode: 'PUT', url: '/api/sejours/7/infos', corps: { infosPratiques: 'X' }, creation: false });
    expect(requete(7, { type: 'suppression', objet: 'depense', id: 4 }))
      .toMatchObject({ methode: 'DELETE', url: '/api/sejours/7/depenses/4', creation: false });
  });

  it('sans réponse ou erreur du serveur elle attend ; supprimer ce qui n\'existe plus est fait ; le reste est refusé', () => {
    expect(issueEchec(0, 'PUT')).toBe('en-attente');
    expect(issueEchec(503, 'POST')).toBe('en-attente');
    expect(issueEchec(404, 'DELETE')).toBe('deja-faite');
    expect(issueEchec(404, 'PUT')).toBe('refusee');
    expect(issueEchec(422, 'POST')).toBe('refusee');
    expect(issueEchec(403, 'PUT')).toBe('refusee');
  });

  it('une lecture sans réseau prend la copie ; un refus (plus participant, séjour supprimé) l\'efface', () => {
    expect(lectureEchouee(0)).toBe('copie');
    expect(lectureEchouee(504)).toBe('copie');
    expect(lectureEchouee(403)).toBe('effacer');
    expect(lectureEchouee(404)).toBe('effacer');
  });

  it('un participant ajouté sans réseau, une fois envoyé, est cité par son vrai id dans ce qui suit', () => {
    expect(remplacerParticipant({ type: 'voiture', id: null, demande: { nom: 'Clio', places: 5, conducteurId: -9,
      trajet: null, remarques: null, passagerIds: [1, -9] } }, -9, 42))
      .toMatchObject({ demande: { conducteurId: 42, passagerIds: [1, 42] } });
    expect(remplacerParticipant({ type: 'depense', id: null, demande: { libelle: 'Pain', categorie: 'REPAS',
      montantCentimes: 300, payeurId: -9, jour: null, parts: [{ participantId: -9, parts: 1 }] } }, -9, 42))
      .toMatchObject({ demande: { payeurId: 42, parts: [{ participantId: 42, parts: 1 }] } });
  });
});

describe('Le séjour montré avec les modifications qui attendent', () => {
  const entree = (modification: ModificationEnAttente['modification'], ordre: number, idProvisoire: number | null = null)
    : ModificationEnAttente => ({
      cle: String(ordre), sejourId: 7, nomSejour: 'Port-Cros', modification, reference: 'r' + ordre, idProvisoire,
      libelle: 'test', ordre, majLe: ordre
    });

  it('sans modification, le séjour est celui du serveur', () => {
    const s = sejour();
    expect(appliquerEnAttente(s, [])).toBe(s);
  });

  it('les infos pratiques, une voiture ajoutée, un rendez-vous supprimé', () => {
    const s = { ...sejour(), evenements: [{ id: 5, jour: '2027-06-05', heureDebut: null, heureFin: null, titre: 'Apéro',
      lieu: null, details: null }] };
    const vu = appliquerEnAttente(s, [
      entree({ type: 'infos', texte: 'Au port à 8 h' }, 1),
      entree({ type: 'voiture', id: null, demande: { nom: 'Kangoo', places: 7, conducteurId: null, trajet: null,
        remarques: null, passagerIds: [] } }, 2, -2),
      entree({ type: 'suppression', objet: 'evenement', id: 5 }, 3)
    ]);
    expect(vu.infosPratiques).toBe('Au port à 8 h');
    expect(vu.voitures.map(v => [v.id, v.nom])).toEqual([[10, 'Clio'], [-2, 'Kangoo']]);
    expect(vu.evenements).toEqual([]);
  });

  it('un participant retiré quitte aussi sa voiture et sa chambre', () => {
    const vu = appliquerEnAttente(sejour(), [entree({ type: 'suppression', objet: 'participant', id: 2 }, 1)]);
    expect(vu.participants.map(p => p.id)).toEqual([1, 3]);
    expect(vu.voitures[0].passagerIds).toEqual([3]);
    expect(vu.logements[0].chambres[0].occupantIds).toEqual([]);
  });

  it('mes informations ne changent que ma fiche', () => {
    const vu = appliquerEnAttente(sejour(), [entree({ type: 'mes-informations', demande: {
      telephone: '0600000000', regimes: ['VEGETARIEN'], regimePrecision: null, urgenceNom: 'Hélène',
      urgenceTelephone: null, arrivee: null, depart: null, remarques: null } }, 1)]);
    expect(vu.participants.find(p => p.id === 1)?.telephone).toBe('0600000000');
    expect(vu.participants.find(p => p.id === 2)?.telephone).toBeNull();
  });

  it('une dépense ajoutée recalcule les comptes et reste modifiable', () => {
    const vu = appliquerEnAttente(sejour(), [entree({ type: 'depense', id: null, demande: {
      libelle: 'Restaurant', categorie: 'REPAS', montantCentimes: 9000, payeurId: 1, jour: null,
      parts: [{ participantId: 1, parts: 1 }, { participantId: 2, parts: 1 }, { participantId: 3, parts: 1 }] } }, 1, -1)]);
    expect(vu.frais.depenses.map(d => d.id)).toEqual([-1]);
    expect(vu.frais.droits.depensesModifiables).toEqual([-1]);
    expect(vu.frais.comptes.totalCentimes).toBe(9000);
    expect(vu.frais.comptes.remboursements).toEqual([
      { deId: 2, aId: 1, montantCentimes: 3000 }, { deId: 3, aId: 1, montantCentimes: 3000 }]);
  });
});

describe('Les comptes des frais calculés sur le téléphone, comme le serveur', () => {
  it('une dépense se répartit au centime près, les centimes restants aux premiers', () => {
    expect([...repartir(1000, [{ participantId: 3, parts: 1 }, { participantId: 1, parts: 1 }, { participantId: 2, parts: 1 }])])
      .toEqual([[1, 334], [2, 333], [3, 333]]);
    expect([...repartir(900, [{ participantId: 1, parts: 2 }, { participantId: 2, parts: 1 }])]).toEqual([[1, 600], [2, 300]]);
  });

  it('soldes et remboursements à faire, remboursements déjà faits compris', () => {
    const tous = [{ participantId: 1, parts: 1 }, { participantId: 2, parts: 1 }, { participantId: 3, parts: 1 }];
    const depense = (id: number, montant: number, payeurId: number) => ({
      id, libelle: '', categorie: 'AUTRE' as const, montantCentimes: montant, payeurId, jour: null, parts: tous,
      photos: [], saisieParUtilisateurId: null, saisieParParticipantId: null
    });
    const depenses = [depense(1, 30000, 1), depense(2, 6000, 2)];
    const c = comptesFrais([1, 2, 3], { depenses, versements: [] });
    expect(c.totalCentimes).toBe(36000);
    expect(c.soldes.map(s => s.soldeCentimes)).toEqual([18000, -6000, -12000]);
    expect(c.remboursements).toEqual([{ deId: 3, aId: 1, montantCentimes: 12000 }, { deId: 2, aId: 1, montantCentimes: 6000 }]);

    const apres = comptesFrais([1, 2, 3], { depenses, versements: [{ id: 1, deId: 3, aId: 1, montantCentimes: 12000, jour: null }] });
    expect(apres.soldes.map(s => s.soldeCentimes)).toEqual([6000, -6000, 0]);
    expect(apres.remboursements).toEqual([{ deId: 2, aId: 1, montantCentimes: 6000 }]);
  });
});
