import { of } from 'rxjs';
import { PretsDuSejour, contientUnDetendeur, filtrerDisponibles, monMateriel } from './materiel-sejour';
import { EquipementSejourVue, PortPrets, PretSejourVue, PretsSejourVue } from './sejour-api';

const GILET: EquipementSejourVue = { id: 1, type: 'GILET', typeLibelle: 'Gilet', reference: 'G-12',
  ancienneReference: null, description: 'Aqualung Pro HD, taille M' };
const DETENDEUR: EquipementSejourVue = { id: 2, type: 'DETENDEUR', typeLibelle: 'Détendeur', reference: 'D-03',
  ancienneReference: null, description: 'Scubapro MK25' };
const BLOC: EquipementSejourVue = { id: 3, type: 'BLOC', typeLibelle: 'Bloc', reference: 'B-07',
  ancienneReference: 'Vieux-7', description: '12 L acier' };

describe('Matériel déclaré depuis le séjour', () => {
  it('Le choix se filtre par type, puis par référence ou description, sans tenir compte des accents ni de la casse', () => {
    const tous = [GILET, DETENDEUR, BLOC];
    expect(filtrerDisponibles(tous, null, '')).toEqual(tous);
    expect(filtrerDisponibles(tous, 'BLOC', '')).toEqual([BLOC]);
    expect(filtrerDisponibles(tous, null, 'g-12')).toEqual([GILET]);
    expect(filtrerDisponibles(tous, null, 'ACIER')).toEqual([BLOC]);
    expect(filtrerDisponibles(tous, 'GILET', 'scubapro')).toEqual([]);
  });

  it('Un matériel renuméroté se retrouve aussi par son ancien numéro', () => {
    expect(filtrerDisponibles([GILET, DETENDEUR, BLOC], null, 'vieux-7')).toEqual([BLOC]);
  });

  it('La désinfection n\'est demandée que si un détendeur est choisi', () => {
    const tous = [GILET, DETENDEUR, BLOC];
    expect(contientUnDetendeur([1, 3], tous)).toBe(false);
    expect(contientUnDetendeur([1, 2], tous)).toBe(true);
    expect(contientUnDetendeur([], tous)).toBe(false);
  });
});

function pret(id: number, participantId: number | null): PretSejourVue {
  return { id, participantId, emprunteur: '?', datePret: '2027-06-12', dateRetourPrevue: '2027-06-15',
           dateRetour: null, enRetard: false, annulable: true, equipements: [GILET] };
}

function vue(prets: PretSejourVue[], rienEmprunte = false, peutDeclarer = true): PretsSejourVue {
  return { prets, disponibles: [], participants: [], rienEmprunte, rienEmpruntePar: [], sansReponse: [],
           droits: { moiId: 7, peutDeclarer, pourLesAutres: false } };
}

describe('« Avez-vous emprunté du matériel ? » dans la carte « Mon séjour »', () => {
  it('La question est posée tant que le participant n\'a ni déclaré d\'emprunt ni dit n\'avoir rien emprunté', () => {
    expect(monMateriel(vue([pret(1, 8)]), 7)).toEqual({ etat: 'question' });
  });

  it('Ses emprunts déclarés remplacent la question, même s\'il avait dit n\'avoir rien emprunté', () => {
    const p = pret(2, 7);
    expect(monMateriel(vue([pret(1, 8), p], true), 7)).toEqual({ etat: 'emprunts', prets: [p] });
  });

  it('« Rien emprunté » est rappelé sans reposer la question', () => {
    expect(monMateriel(vue([], true), 7)).toEqual({ etat: 'rien' });
  });

  it('Rien n\'est montré avant la lecture, ni à qui ne peut pas déclarer', () => {
    expect(monMateriel(null, 7)).toBeNull();
    expect(monMateriel(vue([], false, false), 7)).toBeNull();
  });

  it('La carte et l\'onglet « Matériel » partagent la même vue, mise à jour à chaque réponse du serveur', () => {
    const apres = vue([], true);
    const port: PortPrets = {
      lire: () => of(vue([])), declarer: () => of(vue([])), annuler: () => of(vue([])),
      rienEmprunte: () => of(apres)
    };
    const prets = new PretsDuSejour(port);
    prets.lire().subscribe();
    expect(prets.vue()?.rienEmprunte).toBe(false);
    prets.rienEmprunte(true).subscribe();
    expect(prets.vue()).toBe(apres);
  });
});
