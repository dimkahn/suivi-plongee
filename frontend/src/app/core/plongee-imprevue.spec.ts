import { describe, expect, it } from 'vitest';
import type { EcritureEnAttente } from './file-ecritures.service';
import { estProvisoire, ficheVide, rattacherALaSeance, seanceImprevue, seanceProvisoire } from './plongee-imprevue';

const demande = {
  date: '2027-06-04', ordre: null, milieu: 'NATUREL' as const, lieu: 'Port-Cros', site: 'La Gabinière',
  profondeurMax: 20, commentaire: null
};

function entree(e: EcritureEnAttente['ecriture'], ordre: number): EcritureEnAttente {
  const cle = e.type === 'presence' ? `presence:${e.seanceId}:${e.cursusId}` : `${e.type}:${e.seanceId}`;
  return { cle, ecriture: e, libelle: 'Plongée', dateSeance: '2027-06-04', ordre, majLe: ordre };
}

describe('Une plongée imprévue ajoutée sans réseau', () => {
  it('porte un n° provisoire, négatif, que le serveur ne donne jamais', () => {
    expect(estProvisoire(-1732000000000)).toBe(true);
    expect(estProvisoire(42)).toBe(false);
  });

  it('se montre comme une séance de son jour, modifiable, sans fiche encore', () => {
    expect(seanceProvisoire({ type: 'plongee', seanceId: -5, sortieId: 3, reference: 'r', demande }, 2)).toEqual({
      id: -5, date: '2027-06-04', ordre: 2, milieu: 'NATUREL', lieu: 'Port-Cros', site: 'La Gabinière',
      profondeurMax: 20, commentaire: null, modifiable: true, ficheSecurite: false, ficheSignee: false, ficheDpId: null
    });
  });

  it('prend le n° suivant ceux de son jour, sauf si on en a choisi un', () => {
    const seances = [{ date: '2027-06-04', ordre: 1 }, { date: '2027-06-04', ordre: 2 }, { date: '2027-06-05', ordre: 4 }] as never;
    const e = { type: 'plongee' as const, seanceId: -5, sortieId: 3, reference: 'r', demande };
    expect(seanceImprevue(e, seances)?.ordre).toBe(3);
    expect(seanceImprevue({ ...e, demande: { ...demande, ordre: 5 } }, seances)?.ordre).toBe(5);
    expect(seanceImprevue(undefined, seances)).toBeNull();
  });

  it('s’ouvre sur une fiche vide, sans palanquée', () => {
    expect(ficheVide()).toMatchObject({ id: null, dpId: null, palanquees: [], seancesLiees: [] });
  });

  it('une fois créée par le serveur, sa fiche et son profil réalisé partent sur la vraie séance, dans leur ordre', () => {
    const fiche = { dpId: 7, palanquees: [] };
    const entrees = [
      entree({ type: 'plongee', seanceId: -5, sortieId: 3, reference: 'r', demande }, 1),
      entree({ type: 'fiche', seanceId: -5, demande: fiche }, 2),
      entree({ type: 'realise', seanceId: -5, profils: [] }, 3),
      entree({ type: 'fiche', seanceId: 9, demande: fiche }, 4)
    ];
    const { retirees, rattachees } = rattacherALaSeance(entrees, -5, 120);
    expect(retirees).toEqual(['fiche:-5', 'realise:-5']);
    expect(rattachees.map(e => [e.cle, e.ecriture.seanceId, e.ordre])).toEqual([
      ['fiche:120', 120, 2], ['realise:120', 120, 3]
    ]);
  });
});
