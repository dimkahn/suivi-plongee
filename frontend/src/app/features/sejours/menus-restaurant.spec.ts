import { describe, expect, it } from 'vitest';
import { MenuVue, PAYEUR_CLUB, parCategorie, payeursPossibles, prixEnCentimes, prixEnTexte, texteDeLaCommande, totalDuChoix } from './menus-restaurant';

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

describe('Qui peut payer l’addition', () => {
  it('tous les participants, même sans choix, par ordre alphabétique, puis le club', () => {
    const payeurs = payeursPossibles(menu.commande!);
    expect(payeurs.map(p => p.libelle)).toEqual(['Camille Berthier', 'Léo Durand', 'Inès Roux', 'Le club']);
    expect(payeurs.find(p => p.libelle === 'Inès Roux')?.detail).toBe('n’a pas choisi');
    expect(payeurs.at(-1)?.id).toBe(PAYEUR_CLUB);
    expect(payeurs.find(p => p.libelle === 'Léo Durand')?.detail).toBeNull();
  });
});

describe('Prix saisi dans le menu modifié', () => {
  it('lit les euros avec virgule, point ou symbole, et rien pour « sans prix »', () => {
    expect(prixEnCentimes('12,50')).toBe(1250);
    expect(prixEnCentimes(' 12.5 € ')).toBe(1250);
    expect(prixEnCentimes('9')).toBe(900);
    expect(prixEnCentimes('')).toBeNull();
  });

  it('refuse ce qui n’est pas un prix', () => {
    expect(prixEnCentimes('douze')).toBeUndefined();
    expect(prixEnCentimes('12,555')).toBeUndefined();
    expect(prixEnCentimes('-3')).toBeUndefined();
  });

  it('réécrit un prix en euros pour le modifier', () => {
    expect(prixEnTexte(1250)).toBe('12,50');
    expect(prixEnTexte(900)).toBe('9,00');
    expect(prixEnTexte(null)).toBe('');
  });
});

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
