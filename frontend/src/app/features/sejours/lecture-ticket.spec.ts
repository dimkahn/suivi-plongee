import { describe, expect, it } from 'vitest';
import { analyserTicket, enseigneDuTicket, leconDuTicket } from './lecture-ticket';

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

  it('corrige les confusions de lettres et de chiffres de la reconnaissance', () => {
    expect(analyserTicket('T0TAL TTC   3B,83 €\n').montantCentimes).toBe(3883);
    expect(analyserTicket('TOTA1   4O,5O\n').montantCentimes).toBe(4050);
    expect(analyserTicket('TOTAL A PAYER  1S,2O EUR\n').montantCentimes).toBe(1520);
  });

  it('lit un total dont la virgule a été perdue', () => {
    expect(analyserTicket('Boulangerie Ange\nBaguette 1,20\nTOTAL     12 40 €\n').montantCentimes).toBe(1240);
  });

  it('connaît d’autres façons d’écrire le total', () => {
    expect(analyserTicket('Fromages 12,10\nVins 18,00\nA REGLER : 30,10\n').montantCentimes).toBe(3010);
    expect(analyserTicket('Café 2,20\nSomme due 2,20\nVISA SANS CONTACT 2,20\n').montantCentimes).toBe(220);
    expect(analyserTicket('2 BIERES 9,00\nPAIEMENT CB      9,00\n').montantCentimes).toBe(900);
  });

  it('écarte le total hors taxes, la base, les titres-restaurant et le prix au kilo', () => {
    const texte = `
      TOMATES 1,234 KG X 3,99 EUR/KG   4,92
      PRIX AU KG 12,90
      TOTAL HT        50,00
      BASE TVA        50,00
      TOTAL TTC       55,00
      TICKET RESTO    25,00
      CB              30,00`;
    expect(analyserTicket(texte).montantCentimes).toBe(5500);
  });

  it('préfère « Total TTC » ou « Net à payer » au montant payé par carte (paiement en deux fois)', () => {
    expect(analyserTicket('TOTAL TTC 80,00\nCB 50,00\nESPECES 30,00\n').montantCentimes).toBe(8000);
  });

  it('ne devine pas quand deux totaux se contredisent', () => {
    expect(analyserTicket('TOTAL TTC 38,83\nNET A PAYER 36,83\n').montantCentimes).toBeNull();
  });

  it('lit d’autres formats de date', () => {
    expect(analyserTicket('Date : 2027-06-12 14:02\nTOTAL 5,00').jour).toBe('2027-06-12');
    expect(analyserTicket('LE 12 JUIN 27 A 14H02\nTOTAL 5,00').jour).toBe('2027-06-12');
    expect(analyserTicket('1er juillet 2027\nTOTAL 5,00').jour).toBe('2027-07-01');
  });

  it('ne prend pas la date d’expiration de la carte', () => {
    expect(analyserTicket('CARTE ****1234 EXP 12/28\nLE 03/07/2027\nTOTAL 5,00').jour).toBe('2027-07-03');
  });

  it('reconnaît les enseignes courantes et le vocabulaire de la plongée', () => {
    expect(analyserTicket('ibis budget Toulon\nNuit 1 personne\nTOTAL 59,00').categorie).toBe('HEBERGEMENT');
    expect(analyserTicket('TLV - TVM\nAller-retour Hyères Port-Cros\n4 x 28,50\nTOTAL 114,00').categorie)
      .toBe('TRANSPORT');
    expect(analyserTicket('ESCOTA\nGare de péage de Cuers\nTOTAL 3,40').categorie).toBe('TRANSPORT');
    expect(analyserTicket("McDonald's Hyères\n2 menus Best Of\nTOTAL 21,80").categorie).toBe('REPAS');
    expect(analyserTicket('Port-Cros Plongée\nBaptême x2\nExploration x6\nTOTAL 330,00').categorie).toBe('PLONGEE');
  });

  it('ne remplit rien quand le texte est illisible', () => {
    expect(analyserTicket('~~ ##@ ¤¤ ..')).toEqual({ montantCentimes: null, jour: null, categorie: null });
  });
});

const CHEZ_MARCEL = `
  * * *
Chez Marcel
Bienvenue
2 Pastis        7,00
1 Planche      18,50
Sous-total     25,50
Pourboire       2,00
Addition       27,50
CB 25,50
`;

describe('Apprendre des corrections', () => {
  it('reconnaît le commerçant à la première ligne lisible du ticket', () => {
    expect(enseigneDuTicket(CHEZ_MARCEL)).toBe('CHEZ MARCEL');
    expect(enseigneDuTicket("TICKET CLIENT\nMcDonald's Hyères\n")).toBe("MCDONALD'S HYERES");
    expect(enseigneDuTicket('12/06/2027\n~~ ##')).toBeNull();
  });

  it('retient la catégorie choisie et le libellé de la ligne qui portait le bon total', () => {
    const lue = analyserTicket(CHEZ_MARCEL);
    expect(lue.montantCentimes).toBe(2550);
    expect(leconDuTicket(CHEZ_MARCEL, lue, { montantCentimes: 2750, categorie: 'REPAS' }))
      .toEqual({ enseigne: 'CHEZ MARCEL', categorie: 'REPAS', libelleTotal: 'ADDITION' });
  });

  it("ne retient pas de libellé quand le total lu était juste, ni de catégorie laissée sur « Autre »", () => {
    expect(leconDuTicket('Chez Marcel\nTOTAL 27,50', { montantCentimes: 2750, jour: null, categorie: null },
      { montantCentimes: 2750, categorie: 'AUTRE' })).toBeNull();
  });

  it('applique les règles apprises : la catégorie du commerçant et la ligne de son total', () => {
    const regles = [{ enseigne: 'CHEZ MARCEL', categorie: 'TRANSPORT' as const, libelleTotal: 'ADDITION' }];
    expect(analyserTicket(CHEZ_MARCEL, regles)).toMatchObject({ montantCentimes: 2750, categorie: 'TRANSPORT' });
    // Une règle ne vaut que pour son commerçant.
    expect(analyserTicket('Autre commerce\nAddition 3,00\nTOTAL 5,00', regles).montantCentimes).toBe(500);
  });
});
