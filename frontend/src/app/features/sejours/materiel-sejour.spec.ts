import { contientUnDetendeur, filtrerDisponibles } from './materiel-sejour';
import { EquipementSejourVue } from './sejour-api';

const GILET: EquipementSejourVue = { id: 1, type: 'GILET', typeLibelle: 'Gilet', reference: 'G-12',
  description: 'Aqualung Pro HD, taille M' };
const DETENDEUR: EquipementSejourVue = { id: 2, type: 'DETENDEUR', typeLibelle: 'Détendeur', reference: 'D-03',
  description: 'Scubapro MK25' };
const BLOC: EquipementSejourVue = { id: 3, type: 'BLOC', typeLibelle: 'Bloc', reference: 'B-07',
  description: '12 L acier' };

describe('Matériel déclaré depuis le séjour', () => {
  it('Le choix se filtre par type, puis par référence ou description, sans tenir compte des accents ni de la casse', () => {
    const tous = [GILET, DETENDEUR, BLOC];
    expect(filtrerDisponibles(tous, null, '')).toEqual(tous);
    expect(filtrerDisponibles(tous, 'BLOC', '')).toEqual([BLOC]);
    expect(filtrerDisponibles(tous, null, 'g-12')).toEqual([GILET]);
    expect(filtrerDisponibles(tous, null, 'ACIER')).toEqual([BLOC]);
    expect(filtrerDisponibles(tous, 'GILET', 'scubapro')).toEqual([]);
  });

  it('La désinfection n\'est demandée que si un détendeur est choisi', () => {
    const tous = [GILET, DETENDEUR, BLOC];
    expect(contientUnDetendeur([1, 3], tous)).toBe(false);
    expect(contientUnDetendeur([1, 2], tous)).toBe(true);
    expect(contientUnDetendeur([], tous)).toBe(false);
  });
});
