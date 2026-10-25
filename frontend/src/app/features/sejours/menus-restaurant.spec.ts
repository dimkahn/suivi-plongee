import { describe, expect, it } from 'vitest';
import { MenuVue, parCategorie, texteDeLaCommande, totalDuChoix } from './menus-restaurant';

const menu: MenuVue = {
  id: 1, jour: '2027-06-05', repas: 'DINER', restaurant: 'Le Sémaphore',
  plats: [
    { id: 10, categorie: 'Entrée', nom: 'Soupe de poissons', description: null, prixCentimes: 950 },
    { id: 11, categorie: 'Plat', nom: 'Daurade grillée', description: 'Légumes', prixCentimes: 2100 },
    { id: 12, categorie: 'Plat', nom: 'Risotto', description: null, prixCentimes: null },
    { id: 13, categorie: null, nom: 'Pain', description: null, prixCentimes: null },
    { id: 14, categorie: 'Entrée', nom: 'Salade', description: null, prixCentimes: 800 }
  ],
  monChoix: [],
  reglement: null,
  commande: {
    plats: [{ platId: 10, nombre: 1 }, { platId: 11, nombre: 2 }],
    participants: [
      { participantId: 1, nom: 'Berthier', prenom: 'Camille', platIds: [10, 11], totalCentimes: 3050, payeDeSonCote: false },
      { participantId: 2, nom: 'Durand', prenom: 'Léo', platIds: [11], totalCentimes: 2100, payeDeSonCote: false }
    ],
    sansChoix: [{ participantId: 3, nom: 'Roux', prenom: 'Inès' }],
    totalCentimes: 5150
  }
};

describe('Menus des restaurants du séjour', () => {
  it('range les plats par catégorie, dans l’ordre de leur première apparition, sans catégorie à la fin', () => {
    const groupes = parCategorie(menu.plats);
    expect(groupes.map(g => g.categorie)).toEqual(['Entrée', 'Plat', 'Autres']);
    expect(groupes[0].plats.map(p => p.nom)).toEqual(['Soupe de poissons', 'Salade']);
  });

  it('additionne le prix des plats choisis, un plat sans prix compte pour rien', () => {
    expect(totalDuChoix(menu.plats, [10, 11, 12])).toBe(3050);
  });

  it('met la commande en texte pour le restaurant : plats par catégorie, puis le détail par personne', () => {
    const texte = texteDeLaCommande(menu);
    expect(texte).toContain('Commande — Le Sémaphore, dîner du samedi 05/06/2027');
    expect(texte).toContain('Entrée\n- 1 × Soupe de poissons');
    expect(texte).toContain('Plat\n- 2 × Daurade grillée');
    expect(texte).toContain('Camille B. : Soupe de poissons, Daurade grillée');
  });

  it('ne donne au restaurant ni les noms complets ni ceux qui n’ont pas choisi (des mineurs sont suivis)', () => {
    const texte = texteDeLaCommande(menu);
    expect(texte).not.toContain('Berthier');
    expect(texte).not.toContain('Inès');
    expect(texte).toMatch(/Total : 51,50\s€/);
  });
});
