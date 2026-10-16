import { describe, expect, it } from 'vitest';
import { analyserTicket } from './lecture-ticket';

// Textes tels que les rend la reconnaissance de caractères : majuscules,
// espaces en trop, lettres mal lues, lignes inutiles.

const SUPERMARCHE = `
CARREFOUR MARKET
HYERES
TEL 04 94 12 34 56
PAIN DE MIE        2,15
EAU PLATE X6       3,48
TOMATES            4,20
SOUS-TOTAL        39,83
REMISE FIDELITE   -1,00
TOTAL TTC         38,83 EUR
CB                38,83
RENDU              0,00
TVA 5,5%           2,02
12/06/2027 18:42  CAISSE 04
`;

const STATION = `
TotalEnergies Relais
Station de La Londe
le 10.06.27 a 08:12
GAZOLE  41,32 L
PRIX 1,789 EUR/L
MONTANT    73,92 €
MERCI DE VOTRE VISITE
`;

const RESTAURANT = `
Brasserie du Port
Table 12 - 4 couverts
2 Menu du jour       58,00
1 Pichet rosé        14,50
Net à payer :
86,50
TVA 10%     7,86
Vendredi 11 juin 2027
`;

describe('Lecture du texte d’un ticket', () => {
  it('trouve le total payé, pas le sous-total, la TVA ni la monnaie rendue', () => {
    expect(analyserTicket(SUPERMARCHE).montantCentimes).toBe(3883);
  });

  it('trouve le montant de la ligne « Montant » d’une station-service', () => {
    expect(analyserTicket(STATION).montantCentimes).toBe(7392);
  });

  it('lit le total écrit sur la ligne sous « Net à payer »', () => {
    expect(analyserTicket(RESTAURANT).montantCentimes).toBe(8650);
  });

  it('prend le plus gros montant quand aucune ligne ne dit « total »', () => {
    expect(analyserTicket('Glacier\nCornet 2 boules 3,50\nCoupe 7,90\n').montantCentimes).toBe(790);
  });

  it('lit la date en chiffres, sur deux ou quatre chiffres pour l’année, ou en toutes lettres', () => {
    expect(analyserTicket(SUPERMARCHE).jour).toBe('2027-06-12');
    expect(analyserTicket(STATION).jour).toBe('2027-06-10');
    expect(analyserTicket(RESTAURANT).jour).toBe('2027-06-11');
  });

  it('ignore une date impossible', () => {
    expect(analyserTicket('le 31/02/2027\nTOTAL 5,00').jour).toBeNull();
  });

  it('devine la catégorie d’après le commerçant et les achats', () => {
    expect(analyserTicket(SUPERMARCHE).categorie).toBe('REPAS');
    expect(analyserTicket(STATION).categorie).toBe('TRANSPORT');
    expect(analyserTicket(RESTAURANT).categorie).toBe('REPAS');
    expect(analyserTicket('CENTRE DE PLONGEE PORT-CROS\nGonflage Nitrox x4\nTOTAL 32,00').categorie).toBe('PLONGEE');
    expect(analyserTicket('Hôtel des Iles\nNuitée chambre double\nTaxe de séjour\nTOTAL 142,00').categorie)
      .toBe('HEBERGEMENT');
  });

  it('ne remplit rien quand le texte est illisible', () => {
    expect(analyserTicket('~~ ##@ ¤¤ ..')).toEqual({ montantCentimes: null, jour: null, categorie: null });
  });
});
