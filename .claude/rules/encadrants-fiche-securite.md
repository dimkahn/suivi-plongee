---
paths:
  - "backend/src/main/java/fr/club/plongee/formation/**"
  - "backend/src/main/java/fr/club/plongee/securite/**"
  - "backend/src/main/java/fr/club/plongee/admin/**"
  - "frontend/src/app/features/fiche-securite/**"
  - "frontend/src/app/features/groupes/**"
  - "frontend/src/app/features/admin/moniteurs.component.ts"
  - "frontend/src/app/features/admin/comptes-securite-surface.component.ts"
---

# Encadrants, fiche de sécurité, groupes de plongeurs

**Encadrants : niveau d'encadrement et niveau de plongeur sont distincts.**
`utilisateur.niveau_plongeur` (N1 à N5, V25, saisi par un ADMIN dans l'écran
Moniteurs) n'est pas déduit de `niveau_encadrement` : un E1 peut n'être que
N2. `utilisateur.niveau_encadrement_prepare` (V49, saisi par un ADMIN,
toujours au-dessus du niveau détenu) : un moniteur en formation. Seul le
stagiaire E3 en tire un droit (choix du club, 2026,
`ProposeurPalanquees.NIVEAUX_STAGIAIRE_AUTORISES`) : il encadre comme un E3
dans la proposition des palanquées, avec un avertissement sur la présence
du tuteur ; la notation (`HabilitationService`) et le choix du DP n'en
tiennent pas compte. Le **directeur de plongée d'une fiche de sécurité est E3 minimum, quel
que soit le milieu** (choix du club, 2026 ; `FicheSecuriteService`,
constante `NIVEAU_DP_MINIMUM` — règle de sécurité générale, pas du MFT,
donc pas une colonne du référentiel). **Droits sur la fiche (choix du club,
2026, V71)** : l'établir ou la modifier (et proposer les palanquées, lier
les séances) est réservé aux E3/E4, aux ADMIN et aux moniteurs qui ont le
rôle `FICHE_SECURITE` (donné dans l'écran Moniteurs ; ne fait pas d'eux
des DP) — `HabilitationService.peutEtablirFicheSecurite`, refus 422 lisible ;
pour les autres l'écran est en lecture seule. La compléter au retour
(`PUT …/fiche-securite/realise`) est ouvert à tous les moniteurs et au rôle
`SECURITE_SURFACE` : un compte qui n'est **pas** moniteur (sécurité surface
d'une sortie), créé en bas de l'écran Moniteurs
(`AdminSecuriteSurfaceController`), qui ne voit que la liste des fiches et
l'écran de complément (`gardeFichesSecurite`). Démo : `e2@club.fr` a le
droit, `surface@club.fr` (V116).

**Sans rapport avec `GroupePlongeurs`** (V13), qui
compose les palanquées d'un séjour (**modifié par son créateur et les
organisateurs qu'il désigne, seulement**, choix du club 2026, V81 :
`groupe_plongeurs.createur_id` posé à la création, ici ou depuis une fiche
de sécurité, `groupe_plongeurs_organisateur`, `DroitsGroupePlongeurs` dans
les `@PreAuthorize`, `PUT …/organisateurs` ; un ADMIN désigne seulement ;
les groupes d'avant V81 n'ont pas de créateur, l'entité n'étant pas
auditée ; les autres encadrants les lisent, les reprennent dans une fiche
et envoient les paramètres ; le report nom/e-mail depuis un séjour lié
reste ouvert aux organisateurs du séjour ; écran : une ligne par membre,
ajout en tête depuis les plongeurs connus) (e-mail facultatif par membre, V44 —
vide, celui du dossier ; en fin de séjour `EnvoiParametresSejourService`
envoie à chacun les seules plongées de la sortie où il figure, lues sur les
fiches de sécurité ; des séances du même jour peuvent être
**liées**, V43 `LiaisonSeances`, depuis la fiche de sécurité : deux bateaux
se partagent un groupe, chaque fiche ne propose que les plongeurs absents
des palanquées des fiches liées ; `FicheSecuriteVue.seancesLiees`, simple
avertissement si un plongeur est sur les deux). **Proposition automatique
des palanquées** (2026, milieu naturel seulement, choix du club) : bouton
de la fiche de sécurité, `POST /api/seances/{id}/fiche-securite/proposition`,
calcul pur dans `ProposeurPalanquees` (aptitudes lues par `AptitudePlongeur`
dans le texte libre, complétées par le compte lié), à partir des membres du
groupe absents des fiches liées et de critères (profondeur, exploration /
enseignement, plongeurs par palanquée ≤ 4, autonomes par 2 ou 3, niveaux
séparés, encadrants retenus, paires ensemble / séparées). **N'écrit rien** :
remplit le formulaire, que le DP relit et enregistre ; ne place jamais un
plongeur au-delà de son aptitude, renvoie les non placés avec leur raison.
Lecture des annexes III-16/17 du Code du sport à confirmer par le club
(exploration au-delà de 40 m : E4, choix prudent). Réseau obligatoire.
