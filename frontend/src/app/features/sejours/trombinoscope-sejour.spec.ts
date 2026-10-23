import { describe, expect, it } from 'vitest';
import { LigneTrombinoscopeSejour, SANS_GROUPE, duGroupe, filtresGroupes, sousTitre, titreImage } from './trombinoscope-sejour';

function ligne(participantId: number, prenom: string, groupe: string | null): LigneTrombinoscopeSejour {
  return { participantId, nom: 'Test', prenom, plongeur: groupe !== null, groupe, aptitude: null, aPhoto: false, invite: false,
           visibleParticipants: false, niveauEncadrement: null, niveauPlongeur: null };
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

  it("montre le niveau d'encadrement d'un encadrant, et aussi son niveau de plongeur s'il est E1", () => {
    expect(sousTitre({ ...ligne(5, 'Yann', null), niveauEncadrement: 'E1', niveauPlongeur: 'N2' })).toBe('E1 · N2');
    expect(sousTitre({ ...ligne(6, 'Gwen', 'Requins'), aptitude: 'PE60', niveauEncadrement: 'E3', niveauPlongeur: 'N4' }))
      .toBe('E3');
    expect(sousTitre({ ...ligne(7, 'Léo', null), niveauEncadrement: 'E1' })).toBe('E1');
  });

  it("montre l'aptitude d'un plongeur, sinon plongeur ou accompagnant", () => {
    expect(sousTitre({ ...ligne(1, 'Lou', 'Requins'), aptitude: 'PE20' })).toBe('PE20');
    expect(sousTitre(ligne(2, 'Noé', 'Mérous'))).toBe('Plongeur');
    expect(sousTitre(ligne(3, 'Sam', null))).toBe('Accompagnant');
  });

  it("propose pour l'image le nom du séjour, suivi du groupe choisi", () => {
    expect(titreImage('Port-Cros 2027', '')).toBe('Port-Cros 2027');
    expect(titreImage('Port-Cros 2027', 'Requins')).toBe('Port-Cros 2027 — Requins');
    expect(titreImage('Port-Cros 2027', SANS_GROUPE)).toBe('Port-Cros 2027 — Sans groupe');
  });
});
