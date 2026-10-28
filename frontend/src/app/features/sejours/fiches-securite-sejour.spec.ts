import { describe, expect, it } from 'vitest';
import {
  FichesSecuriteSejourVue, PlongeeSejourVue, actionsAFaire, etatFiche, nouvellePlongee, plongeesParJour
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
