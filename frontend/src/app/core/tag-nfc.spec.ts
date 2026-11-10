import { adresseFicheEquipement, contenuTagNfc, EnregistrementNfc, LecteurNfc, programmerTag } from './tag-nfc';

function enregistrement(recordType: string, texte: string, encoding?: string): EnregistrementNfc {
  return { recordType, data: new DataView(new TextEncoder().encode(texte).buffer), encoding };
}

describe('Le contenu d\'un tag NFC collé sur le matériel', () => {
  it('Un tag programmé par l\'appli porte l\'adresse de la fiche', () => {
    expect(contenuTagNfc([enregistrement('url', 'https://club.fr/materiel/42')])).toBe('https://club.fr/materiel/42');
    expect(contenuTagNfc([enregistrement('absolute-url', 'https://club.fr/materiel/7')])).toBe('https://club.fr/materiel/7');
  });

  it('Un tag écrit à la main avec une référence (« B-12 ») est lu aussi', () => {
    expect(contenuTagNfc([enregistrement('text', ' B-12 ', 'utf-8')])).toBe('B-12');
  });

  it('Les enregistrements qu\'on ne sait pas lire sont sautés', () => {
    expect(contenuTagNfc([enregistrement('mime', 'xx'), enregistrement('url', 'https://club.fr/materiel/3')]))
      .toBe('https://club.fr/materiel/3');
  });

  it('Un tag vierge ne donne rien', () => {
    expect(contenuTagNfc([])).toBeNull();
    expect(contenuTagNfc([{ recordType: 'empty' }])).toBeNull();
    expect(contenuTagNfc([enregistrement('text', '   ')])).toBeNull();
  });

  it('L\'adresse écrite sur le tag est celle du QR code : l\'id, pas la référence', () => {
    expect(adresseFicheEquipement('https://club.fr', 42)).toBe('https://club.fr/materiel/42');
    expect(adresseFicheEquipement('https://club.fr/', 42)).toBe('https://club.fr/materiel/42');
  });
});

/** Faux lecteur : note les opérations, et échoue sur celles qu'on lui demande. */
function fauxLecteur(echecs: { ecriture?: string; verrouillage?: string } = {}) {
  const operations: string[] = [];
  const lecteur = {
    async write(message: { records: { recordType: string; data: string }[] }) {
      if (echecs.ecriture) throw new DOMException('échec', echecs.ecriture);
      operations.push(`écrit ${message.records[0].data}`);
    },
    async makeReadOnly() {
      if (echecs.verrouillage) throw new DOMException('échec', echecs.verrouillage);
      operations.push('verrouillé');
    }
  } as unknown as LecteurNfc;
  return { lecteur, operations };
}

describe('Programmer le tag NFC d\'un équipement', () => {
  const adresse = 'https://club.fr/materiel/42';

  it('Case cochée : l\'adresse est écrite, puis le tag verrouillé', async () => {
    const { lecteur, operations } = fauxLecteur();
    expect(await programmerTag(lecteur, adresse, true)).toBe('VERROUILLE');
    expect(operations).toEqual([`écrit ${adresse}`, 'verrouillé']);
  });

  it('Case décochée : le tag reste réinscriptible', async () => {
    const { lecteur, operations } = fauxLecteur();
    expect(await programmerTag(lecteur, adresse, false)).toBe('ECRIT');
    expect(operations).toEqual([`écrit ${adresse}`]);
  });

  it('Le verrouillage échoue : le tag écrit marche quand même, on le dit', async () => {
    const { lecteur, operations } = fauxLecteur({ verrouillage: 'NetworkError' });
    expect(await programmerTag(lecteur, adresse, true)).toBe('NON_VERROUILLE');
    expect(operations).toEqual([`écrit ${adresse}`]);
  });

  it('L\'écriture échoue : rien n\'est verrouillé et l\'erreur remonte', async () => {
    const { lecteur, operations } = fauxLecteur({ ecriture: 'NotAllowedError' });
    await expect(programmerTag(lecteur, adresse, true)).rejects.toThrow();
    expect(operations).toEqual([]);
  });

  it('Annulé pendant le verrouillage : l\'annulation remonte', async () => {
    const { lecteur } = fauxLecteur({ verrouillage: 'AbortError' });
    await expect(programmerTag(lecteur, adresse, true)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
