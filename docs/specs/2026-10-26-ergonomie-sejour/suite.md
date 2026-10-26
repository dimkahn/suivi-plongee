# Ergonomie de la page du séjour : la suite

Demande du club (2026-10-26) : « la page séjour est très compliquée ».
Cinq pistes ont été proposées ; les trois premières sont faites (voir
`docs/decisions/sejour.md`, « Page du séjour allégée : cinq onglets ») :

1. ~~Supprimer les doublons~~ : encart « Frais du séjour » retiré,
   « Demander les informations… » à un seul endroit. **Fait.**
2. ~~Passer de 10 à 5 onglets~~ : Programme, Qui et où, Repas, Frais,
   Pratique, avec un sommaire par onglet. **Fait.**
3. ~~Ranger les actions d'organisation~~ : « Version imprimable » et
   « Partager et organiser… » dans le bandeau. **Fait.**

Restent les deux pistes ci-dessous, à reprendre une fois que le club aura
utilisé la nouvelle page.

## 4. Une page qui s'adapte au moment du séjour

**Le constat** : le même écran sert un mois avant le départ (on prépare),
sur place (on cherche le programme du jour) et au retour (on fait les
comptes). L'utile change selon le moment, mais l'ordre de la page ne bouge pas.

**La proposition** : choisir l'onglet ouvert et ce qui passe en tête selon la
date du téléphone, comme le fait déjà l'encart « Aujourd'hui ».

| Moment | En tête de page | Onglet ouvert d'abord |
|---|---|---|
| Avant (jusqu'à la veille du premier aller) | « Mon séjour » et ce qui reste à compléter | Programme (organisateur : Qui et où) |
| Pendant (du premier aller au dernier retour) | « Aujourd'hui » seul ; « Mon séjour » replié | Programme, sur le jour même |
| Après (dès le lendemain du dernier retour) | Mes comptes | Frais |

**Points à trancher** :
- Garder « Mon séjour » replié pendant le séjour, ou le laisser déplié et
  seulement plus bas ?
- Un lien `?onglet=…` (retour d'une fiche de sécurité) l'emporte toujours
  sur le choix automatique.
- « Après » : à partir de quand le séjour est-il « fini » pour un participant
  qui rentre plus tard que les autres ? (Même règle que l'effacement des cartes
  d'embarquement : le lendemain de son retour.)

**Comment le faire** :
- Une fonction pure `momentDuSejour(dateDebut, dateFin, voyages, aujourdhui)`
  → `'avant' | 'pendant' | 'apres'`, à côté de `programme-du-jour.ts` (qui
  calcule déjà « du premier aller au dernier retour »), testée par Vitest
  d'abord (veille, jour même, vol de nuit, retour tardif d'un seul).
- `SejourComponent` : l'onglet initial et l'ordre des encarts en dépendent ;
  rien ne change côté serveur.
- Manuels « Organiser un séjour » et « Le carnet du séjour », scénarios A17 et
  E02 (l'horloge y est déjà avancée par `page.clock.setFixedTime`).

## 5. Une liste « À faire » pour l'organisateur

**Le constat** : ce qui reste à régler est éparpillé : « À compléter : … » sur
chaque participant, attestations d'assurance manquantes (un compteur), points
à vérifier des voitures et des chambres (rond orange sur « Qui et où »),
plongées sans fiche de sécurité, participants qui n'ont pas répondu pour le
matériel, menus où tout le monde n'a pas choisi.

**La proposition** : une carte « À faire » en tête de page, pour le créateur et
les organisateurs seulement (`s.gere`), une ligne par sujet, chacune touchable
et menant à la bonne section (`ouvrirSection`, déjà là) :

- « 3 participants n'ont pas donné leur arrivée ou leur départ » → Qui et où, participants ;
- « 2 attestations d'assurance manquantes » → Qui et où, participants ;
- « Mateo n'a pas de chambre » → Qui et où, logements ;
- « Voiture de Gwendoline : trop pleine » → Qui et où, voitures ;
- « 2 plongées sans fiche de sécurité » → Programme, fiches ;
- « 4 n'ont pas répondu pour le matériel » → Pratique, matériel ;
- « Dîner du samedi : 5 n'ont pas choisi » → Repas, restaurant.

La carte disparaît quand tout est réglé (« Tout est prêt »), et se replie
pendant le séjour pour laisser la place à « Aujourd'hui ».

**Points à trancher** :
- Quelles lignes bloquent vraiment ? Les avertissements du séjour ne bloquent
  jamais rien : la liste informe, elle n'empêche rien.
- Un bouton « Relancer » à côté des lignes « n'ont pas donné » (il ouvrirait
  « Demander les informations… » avec les bonnes personnes cochées, comme
  « Ceux à qui il manque des infos ») ?

**Comment le faire** :
- Une fonction pure `aFaire(sejour, prets, fiches, menus)` → lignes
  `{ texte, ouverture }`, testée par Vitest. Les données sont déjà dans
  `SejourVue` (participants, avertissements, attestations), `PretsDuSejour`
  (`sansReponse`), les fiches et les menus ; fiches et menus demandent le
  réseau : sans lui, leurs lignes ne s'affichent pas.
- Données personnelles : seuls les organisateurs voient la carte, avec ce
  qu'ils voient déjà ailleurs ; rien de nouveau n'est renvoyé par le serveur.
  Faire relire par l'agent `relecteur-donnees-personnelles` quand même.
- Manuel « Organiser un séjour », scénario A17.

## Autre piste notée en passant

- `sejour.component.ts` fait plus de 2 000 lignes : découper chaque onglet en
  composant (`sejour-qui-et-ou.component.ts`, …) rendrait les prochaines
  modifications plus sûres. Refactorisation pure, invisible à l'écran (ni
  manuel ni vidéo), à faire avant la piste 4 ou 5.
