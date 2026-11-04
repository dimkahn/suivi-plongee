import { describe, expect, it } from 'vitest';
import {
  FichesSecuriteSejourVue, PlongeeSejourVue, actionsAFaire, avecEcrituresEnAttente, etatFiche, ficheEmportee,
  nouvellePlongee, plongeesParJour
} from './fiches-securite-sejour';

function plongee(p: Partial<PlongeeSejourVue>): PlongeeSejourVue {
  return {
    seanceId: 1, date: '2027-06-04', ordre: 1, milieu: 'NATUREL', lieu: null, site: null, profondeurMax: null,
    commentaire: null, fiche: false, signee: false, dpId: null, dp: null, palanquees: 0, plongeurs: 0,
    realise: false, supprimable: true, ...p
  };
}

describe('Les fiches de sécurité d’un séjour', () => {
  it('se rangent par jour, dans l’ordre des plongées', () => {
    const jours = plongeesParJour([
      plongee({ seanceId: 3, date: '2027-06-05', ordre: 1 }),
      plongee({ seanceId: 2, date: '2027-06-04', ordre: 2 }),
      plongee({ seanceId: 1, date: '2027-06-04', ordre: 1 })
    ]);
    expect(jours.map(j => j.jour)).toEqual(['2027-06-04', '2027-06-05']);
    expect(jours[0].plongees.map(p => p.seanceId)).toEqual([1, 2]);
  });

  it('disent où en est chaque fiche, de « à établir » à « signée »', () => {
    expect(etatFiche(plongee({})).libelle).toBe('À établir');
    expect(etatFiche(plongee({ fiche: true })).libelle).toBe('Établie');
    expect(etatFiche(plongee({ fiche: true, realise: true })).libelle).toBe('Complétée au retour');
    expect(etatFiche(plongee({ fiche: true, realise: true, signee: true })).libelle).toBe('Signée');
  });

  it('une nouvelle plongée prend le premier jour du séjour, son lieu et le milieu naturel', () => {
    expect(nouvellePlongee('2027-06-04', 'Port-Cros')).toEqual({
      date: '2027-06-04', ordre: null, milieu: 'NATUREL', lieu: 'Port-Cros', site: null, profondeurMax: null,
      commentaire: null
    });
  });
});

describe('Ce qu’un encadrant a à faire sur les fiches du séjour', () => {
  const vue = (plongees: PlongeeSejourVue[], peutEtablir = false): FichesSecuriteSejourVue =>
    ({ peutAjouter: false, peutEtablir, peutSupprimerFiche: false, plongees });
  const AUJOURDHUI = '2027-06-05';

  it('le DP signe la fiche d’une plongée passée, pas celle d’un autre DP', () => {
    const a = actionsAFaire(vue([
      plongee({ seanceId: 1, date: '2027-06-04', fiche: true, realise: true, dpId: 7 }),
      plongee({ seanceId: 2, date: '2027-06-04', fiche: true, realise: true, dpId: 8 })
    ]), 7, AUJOURDHUI);
    expect(a.actions.map(x => [x.action, x.plongee.seanceId])).toEqual([['signer', 1]]);
  });

  it('le DP complète au retour la fiche pas encore complétée, puis la signe', () => {
    const a = actionsAFaire(vue([plongee({ seanceId: 1, date: AUJOURDHUI, fiche: true, dpId: 7 })]), 7, AUJOURDHUI);
    expect(a.actions.map(x => x.action)).toEqual(['completer', 'signer']);
  });

  it('une fiche signée ne demande plus rien', () => {
    const a = actionsAFaire(vue([plongee({ date: '2027-06-04', fiche: true, signee: true, dpId: 7 })], true), 7, AUJOURDHUI);
    expect(a.actions).toEqual([]);
  });

  it('qui peut établir les fiches établit celles qui manquent ; les autres non', () => {
    const plongees = [plongee({ seanceId: 2, date: '2027-06-06', ordre: 1 }), plongee({ seanceId: 1, date: '2027-06-04' })];
    expect(actionsAFaire(vue(plongees, true), 7, AUJOURDHUI).actions.map(x => [x.action, x.plongee.seanceId]))
      .toEqual([['etablir', 1], ['etablir', 2]]);
    expect(actionsAFaire(vue(plongees, false), 7, AUJOURDHUI).actions).toEqual([]);
  });

  it('une fiche de DP d’une plongée à venir est une signature à venir, pas une action', () => {
    const a = actionsAFaire(vue([plongee({ seanceId: 3, date: '2027-06-06', fiche: true, dpId: 7 })]), 7, AUJOURDHUI);
    expect(a.actions).toEqual([]);
    expect(a.signaturesAVenir.map(p => p.seanceId)).toEqual([3]);
  });
});

describe('Les fiches du séjour sans réseau', () => {
  const vue = (plongees: PlongeeSejourVue[], copie?: FichesSecuriteSejourVue['copie']): FichesSecuriteSejourVue =>
    ({ peutAjouter: true, peutEtablir: true, peutSupprimerFiche: false, plongees, copie });
  const demande = {
    dpId: 7, site: 'La Gabinière',
    palanquees: [
      { numero: 1, profondeurPrevue: 20, dureePrevue: 40, membres: [{}, {}] },
      { numero: 2, profondeurPrevue: 12, dureePrevue: 30, membres: [{}] }
    ]
  } as never;

  it('une fiche gardée sur le téléphone paraît établie, avec ses palanquées et son site', () => {
    const lue = avecEcrituresEnAttente(vue([plongee({ seanceId: 1, site: 'Ancien' }), plongee({ seanceId: 2 })]),
      [{ type: 'fiche', seanceId: 1, demande }]);
    expect(lue.plongees[0]).toMatchObject({
      fiche: true, enAttente: true, dpId: 7, palanquees: 2, plongeurs: 3, site: 'La Gabinière', supprimable: false
    });
    expect(etatFiche(lue.plongees[0]).libelle).toBe('Établie');
    expect(lue.plongees[1].fiche).toBe(false);
    expect(lue.plongees[1].enAttente).toBeFalsy();
  });

  it('garde le nom du DP s’il n’a pas changé, ne l’invente pas s’il a changé', () => {
    const lue = (dpId: number) => avecEcrituresEnAttente(vue([plongee({ fiche: true, dpId: 7, dp: 'Gwendoline M.' })]),
      [{ type: 'fiche', seanceId: 1, demande: { ...(demande as object), dpId } as never }]).plongees[0].dp;
    expect(lue(7)).toBe('Gwendoline M.');
    expect(lue(9)).toBeNull();
  });

  it('un site laissé absent reste celui de la plongée ; vide, il s’efface', () => {
    const lue = (site: string | null) => avecEcrituresEnAttente(vue([plongee({ site: 'Ancien' })]),
      [{ type: 'fiche', seanceId: 1, demande: { ...(demande as object), site } as never }]).plongees[0].site;
    expect(lue(null)).toBe('Ancien');
    expect(lue('')).toBeNull();
  });

  it('un profil gardé sur le téléphone rend la fiche complétée au retour', () => {
    const lue = avecEcrituresEnAttente(vue([plongee({ fiche: true })]), [{ type: 'realise', seanceId: 1, profils: [] }]);
    expect(etatFiche(lue.plongees[0]).libelle).toBe('Complétée au retour');
    expect(lue.plongees[0].enAttente).toBe(true);
  });

  it('avec du réseau toutes les fiches s’ouvrent ; sans réseau, seulement celles emportées', () => {
    expect(ficheEmportee(vue([]), 1)).toBe(true);
    const copie = { du: 1000, fichesEmportees: [1] };
    expect(ficheEmportee(vue([], copie), 1)).toBe(true);
    expect(ficheEmportee(vue([], copie), 2)).toBe(false);
  });

  it('« À faire » ne propose sans réseau ni la signature, ni une fiche restée au serveur', () => {
    const plongees = [
      plongee({ seanceId: 1, date: '2027-06-04', fiche: true, dpId: 7 }),
      plongee({ seanceId: 2, date: '2027-06-04', ordre: 2 }),
      plongee({ seanceId: 3, date: '2027-06-04', ordre: 3 })
    ];
    const gestes = (v: FichesSecuriteSejourVue) =>
      actionsAFaire(v, 7, '2027-06-05').actions.map(a => `${a.action}:${a.plongee.seanceId}`);
    expect(gestes(vue(plongees))).toEqual(['etablir:2', 'etablir:3', 'completer:1', 'signer:1']);
    expect(gestes(vue(plongees, { du: 1000, fichesEmportees: [1, 2] }))).toEqual(['etablir:2', 'completer:1']);
  });
});
