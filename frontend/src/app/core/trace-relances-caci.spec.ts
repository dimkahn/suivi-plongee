import { RelanceCaciVue } from './modeles';
import { filtrerTraceRelances } from './trace-relances-caci';

const trace: RelanceCaciVue[] = [
  {
    envoyeLe: '2026-11-20', destinataireNom: 'Marin', destinatairePrenom: 'Paul',
    destinataireEmail: 'paul.marin@exemple.fr', personnes: [{ nom: 'Marin', prenom: 'Paul' }]
  },
  {
    envoyeLe: '2026-10-21', destinataireNom: 'Durand', destinatairePrenom: 'Claire',
    destinataireEmail: 'presidente@club.fr',
    personnes: [{ nom: 'Lemaire', prenom: 'Hugo' }, { nom: 'Vidal', prenom: 'Tom' }]
  }
];

describe('La recherche dans l\'historique des relances CACI', () => {
  it('Sans texte cherché, tout l\'historique reste, dans le même ordre', () => {
    expect(filtrerTraceRelances(trace, '')).toEqual(trace);
    expect(filtrerTraceRelances(trace, '   ')).toEqual(trace);
  });

  it('Retrouve un envoi par une personne concernée, casse et accents ignorés', () => {
    expect(filtrerTraceRelances(trace, 'vidal')).toEqual([trace[1]]);
    expect(filtrerTraceRelances(trace, 'HÛGO')).toEqual([trace[1]]);
  });

  it('Retrouve un envoi par son destinataire : nom, prénom ou adresse', () => {
    expect(filtrerTraceRelances(trace, 'claire')).toEqual([trace[1]]);
    expect(filtrerTraceRelances(trace, 'paul.marin@')).toEqual([trace[0]]);
  });

  it('Prénom et nom ensemble, dans un sens ou dans l\'autre', () => {
    expect(filtrerTraceRelances(trace, 'Tom Vidal')).toEqual([trace[1]]);
    expect(filtrerTraceRelances(trace, 'marin paul')).toEqual([trace[0]]);
  });

  it('Rien ne correspond : liste vide', () => {
    expect(filtrerTraceRelances(trace, 'Berthier')).toEqual([]);
  });
});
