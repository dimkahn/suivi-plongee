# Les manuels d'utilisation

Un petit manuel par fonctionnalité de l'appli, en Markdown. La page
**Aide** (`/aide`, publique comme `/videos`) les présente sous forme de
questions fréquentes : on tape sa question, l'appli retrouve le manuel qui
y répond et montre la ou les vidéos d'aide qui vont avec.

Ils sont embarqués dans l'appli (`index.ts`) : la FAQ marche sans réseau
et change avec les écrans, au même commit. Ils complètent les scénarios
des vidéos (`outils/videos/scenarios/`) : la vidéo montre le geste, le
manuel se relit, se cherche, et décrit aussi ce qu'aucune vidéo ne montre.

## Ajouter ou modifier un manuel

1. Un fichier `nom-du-manuel.md` ici (le nom sert d'adresse :
   `/aide?m=nom-du-manuel`).
2. L'ajouter à la liste de `index.ts`.
3. Si une vidéo existe, mettre son code dans `videos:` ; à l'inverse,
   un nouveau scénario de vidéo demande de citer son code dans un manuel
   (`node enregistrer.mjs` signale les vidéos qu'aucun manuel ne cite).

## Le format

```markdown
---
titre: Faire l'appel d'une séance
rubrique: Moniteur
videos: M3, M17
ecran: /presences
mots: présence, absent, feuille, appel
questions:
- Comment faire l'appel ?
- Comment noter qu'un élève est absent ?
---
Le premier paragraphe est la réponse courte, affichée sous la question.

## Pas à pas

1. Menu, puis « Présences ».
2. …

## Bon à savoir

- **En gras** pour ce qui compte, [un lien](/presences) vers un écran.
```

- `rubrique` : `Découverte`, `Moniteur`, `Administrateur`,
  `Directeur technique` ou `Élève` (les rubriques des vidéos).
- `videos` : les codes des vidéos (`M3`, `A10`…), séparés par des virgules.
- `ecran` : l'adresse de l'écran, pour le bouton « Ouvrir l'écran ».
- `mots` : les synonymes qu'on taperait sans qu'ils soient dans le texte.
- `questions` : les questions telles qu'un moniteur les poserait ; elles
  comptent triple dans la recherche, avec le titre et les mots.
- Dans le texte : titres `##`, listes `-` ou `1.`, `**gras**`,
  `[texte](/adresse)` (liens vers l'appli seulement).

Rester court : une page de téléphone, des phrases simples, les noms des
boutons entre « guillemets » tels qu'ils sont à l'écran. Pas de nom réel :
les exemples sont ceux des données de démonstration.
