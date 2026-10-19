import { blocsDuFormat, lireManuel } from './manuel';

const source = `---
titre: Trombinoscope
rubrique: Moniteur
videos: M15
questions:
- Où voir les photos ?
---
La réponse courte.

## Pas à pas

::: telephone
1. « Plus », en bas de l'écran, puis « Trombinoscope ».
:::
::: ordinateur
1. Dans le menu en haut, « Trombinoscope ».
:::

Commun aux deux.
`;

describe('Manuel avec des passages propres au téléphone ou à l\'ordinateur', () => {
  const m = lireManuel('trombinoscope', source);

  it('Un passage « ::: telephone » ou « ::: ordinateur » ne se lit que dans son format', () => {
    const texte = (format: 'telephone' | 'ordinateur') => blocsDuFormat(m, format)
      .map(b => b.type === 'liste' ? b.elements.flat().map(s => s.texte).join('') : b.type === 'titre' ? b.texte
        : b.segments.map(s => s.texte).join(''));
    expect(texte('telephone')).toEqual(['Pas à pas', '« Plus », en bas de l\'écran, puis « Trombinoscope ».', 'Commun aux deux.']);
    expect(texte('ordinateur')).toEqual(['Pas à pas', 'Dans le menu en haut, « Trombinoscope ».', 'Commun aux deux.']);
  });

  it('Le manuel sait s\'il a des passages propres à un format', () => {
    expect(m.parFormat).toBe(true);
    expect(lireManuel('simple', '---\ntitre: S\n---\nRéponse.\n\nTexte.').parFormat).toBe(false);
  });

  it('Une étape propre à un format garde son numéro dans la liste', () => {
    const etapes = lireManuel('etapes', '---\ntitre: E\n---\nRéponse.\n\n1. Ouvrir.\n2. Choisir.\n::: telephone\n3. « Plus ».\n:::\n'
      + '::: ordinateur\n3. Le menu en haut.\n:::\n4. Enregistrer.');
    const listes = blocsDuFormat(etapes, 'ordinateur').filter(b => b.type === 'liste');
    expect(listes.map(b => b.type === 'liste' ? b.debut : null)).toEqual([1, 3, 4]);
  });

  it('La recherche trouve les mots des deux formats', () => {
    expect(m.recherche.faible.some(r => r.startsWith('menu'))).toBe(true);
  });
});
