import { describe, expect, it } from 'vitest';
import { LigneTrombinoscopeSejour, SANS_GROUPE, duGroupe, filtresGroupes } from './trombinoscope-sejour';

function ligne(participantId: number, prenom: string, groupe: string | null): LigneTrombinoscopeSejour {
  return { participantId, nom: 'Test', prenom, plongeur: groupe !== null, groupe, aptitude: null, aPhoto: false };
}

const lignes = [ligne(1, 'Lou', 'Requins'), ligne(2, 'Noé', 'Mérous'), ligne(3, 'Sam', null), ligne(4, 'Inès', 'Requins')];

describe('Trombinoscope du séjour', () => {
  it('propose « Tous », chaque groupe une fois par ordre alphabétique, puis « Sans groupe »', () => {
    expect(filtresGroupes(lignes).map(o => o.libelle)).toEqual(['Tous', 'Mérous', 'Requins', 'Sans groupe']);
  });

  it("ne propose pas « Sans groupe » quand chacun est dans un groupe", () => {
    expect(filtresGroupes([lignes[0], lignes[1]]).map(o => o.libelle)).toEqual(['Tous', 'Mérous', 'Requins']);
  });

  it('ne garde que les participants du groupe choisi', () => {
    expect(duGroupe(lignes, 'Requins').map(l => l.prenom)).toEqual(['Lou', 'Inès']);
    expect(duGroupe(lignes, SANS_GROUPE).map(l => l.prenom)).toEqual(['Sam']);
    expect(duGroupe(lignes, '')).toHaveLength(4);
  });
});
