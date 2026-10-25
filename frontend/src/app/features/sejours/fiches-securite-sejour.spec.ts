import { describe, expect, it } from 'vitest';
import { PlongeeSejourVue, etatFiche, nouvellePlongee, plongeesParJour } from './fiches-securite-sejour';

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
