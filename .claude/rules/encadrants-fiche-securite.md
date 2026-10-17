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

## Règles

### Niveaux des encadrants
- **Le niveau de plongeur ne se déduit pas du niveau d'encadrement** : `utilisateur.niveau_plongeur` (N1 à N5, V25) est distinct de `niveau_encadrement` ; un E1 peut n'être que N2. Saisi par un ADMIN dans l'écran Moniteurs.
- **Le niveau d'encadrement préparé est toujours au-dessus du niveau détenu** : `utilisateur.niveau_encadrement_prepare` (V49, saisi par un ADMIN), pour un moniteur en formation.
- **Seul le stagiaire E3 en tire un droit** : il encadre comme un E3 dans la proposition des palanquées, avec un avertissement sur la présence du tuteur (`ProposeurPalanquees.NIVEAUX_STAGIAIRE_AUTORISES`). *Pourquoi :* choix du club, 2026.
- **La notation et le choix du DP ignorent le niveau préparé** : `HabilitationService` ne lit que le niveau détenu.

### Directeur de plongée et droits sur la fiche
- **Le DP d'une fiche de sécurité est E3 minimum, quel que soit le milieu** : `FicheSecuriteService`, constante `NIVEAU_DP_MINIMUM`. *Pourquoi :* choix du club, 2026 ; règle de sécurité générale, pas du MFT, donc pas une colonne du référentiel.
- **Établir ou modifier une fiche est réservé aux E3/E4, aux ADMIN et aux moniteurs qui ont le rôle `FICHE_SECURITE`** (V71) : cela couvre aussi proposer les palanquées et lier les séances. Contrôle par `HabilitationService.peutEtablirFicheSecurite`, refus 422 lisible ; pour les autres, l'écran est en lecture seule. *Pourquoi :* choix du club, 2026.
- **Le rôle `FICHE_SECURITE` ne fait pas d'un moniteur un DP** : il est donné dans l'écran Moniteurs.
- **Compléter la fiche au retour est ouvert à tous les moniteurs et au rôle `SECURITE_SURFACE`** : `PUT …/fiche-securite/realise`.
- **Un compte `SECURITE_SURFACE` n'est pas moniteur** (sécurité surface d'une sortie) : créé en bas de l'écran Moniteurs (`AdminSecuriteSurfaceController`), il ne voit que la liste des fiches et l'écran de complément (`gardeFichesSecurite`).

### Proposition automatique des palanquées
- **Milieu naturel seulement** : bouton de la fiche de sécurité, `POST /api/seances/{id}/fiche-securite/proposition`. *Pourquoi :* choix du club, 2026.
- **Calcul pur dans `ProposeurPalanquees`** : aptitudes lues par `AptitudePlongeur` dans le texte libre, complétées par le compte lié ; à partir des membres du groupe absents des fiches liées.
- **Critères** : profondeur, exploration / enseignement, plongeurs par palanquée ≤ 4, autonomes par 2 ou 3, niveaux séparés, encadrants retenus, paires ensemble / séparées.
- **La proposition n'écrit rien** : elle remplit le formulaire, que le DP relit et enregistre.
- **Ne jamais placer un plongeur au-delà de son aptitude** : les non placés sont renvoyés avec leur raison.
- **Exploration au-delà de 40 m : E4** (choix prudent). La lecture des annexes III-16/17 du Code du sport reste à confirmer par le club.
- **Réseau obligatoire.**

### Groupes de plongeurs (palanquées d'un séjour)
- **`GroupePlongeurs` (V13) n'a aucun rapport avec les groupes d'entraînement** : il compose les palanquées d'un séjour.
- **Seuls son créateur et les organisateurs qu'il désigne le modifient** (V81) : `groupe_plongeurs.createur_id` posé à la création (ici ou depuis une fiche de sécurité), `groupe_plongeurs_organisateur`, `DroitsGroupePlongeurs` dans les `@PreAuthorize`, `PUT …/organisateurs`. *Pourquoi :* choix du club, 2026.
- **Un ADMIN désigne seulement les organisateurs**, il ne modifie pas le groupe.
- **Les groupes d'avant V81 n'ont pas de créateur** : l'entité n'étant pas auditée.
- **Les autres encadrants lisent les groupes**, les reprennent dans une fiche et envoient les paramètres.
- **Le report nom/e-mail depuis un séjour lié reste ouvert aux organisateurs du séjour.**
- **E-mail facultatif par membre** (V44) : vide, c'est celui du dossier.
- **En fin de séjour, `EnvoiParametresSejourService` envoie à chacun les seules plongées de la sortie où il figure**, lues sur les fiches de sécurité.
- **Écran** : une ligne par membre, ajout en tête depuis les plongeurs connus.

### Fiche imprimée (PDF et Excel)
- **Le modèle papier du club : deux plongées du même jour au même lieu sur une page A4 portrait** (1er et 2e tour, sans exiger de liaison), une colonne par encadrant puis « Autonomes », la case du plongeur dit le tour (« 1-2 »). Calcul pur `FeuilleSecurite`, partagé par `FicheSecuritePdfService` et `FicheSecuriteExcelService`. *Pourquoi :* modèle du club, 2026.
- **La fiche d'une plongée s'imprime avec l'autre plongée de sa feuille** (`FicheSecuriteService.feuilleDe`) ; journée et sortie : deux plongées par page.
- **Le PDF est la feuille Excel redessinée** (`ClasseurHtml`) : toute retouche de mise en page se fait dans `FicheSecuriteExcelService`, jamais dans le PDF.
- **Le regroupement se choisit à l'impression** : case cochée par défaut, paramètre `regrouper` des exports ; décochée, une feuille par plongée. *Pourquoi :* demande du club, 2026.

### Séances liées
- **Des séances du même jour peuvent être liées depuis la fiche de sécurité** (V43, `LiaisonSeances`) : deux bateaux se partagent un groupe.
- **Chaque fiche ne propose que les plongeurs absents des palanquées des fiches liées.**
- **Un plongeur sur deux fiches liées n'est qu'un avertissement** : `FicheSecuriteVue.seancesLiees`.

## À ne pas faire
- Ne pas déduire `utilisateur.niveau_plongeur` de `niveau_encadrement`.
- Ne pas accorder au stagiaire E3 un droit de notation ou de DP.
- Ne pas mettre `NIVEAU_DP_MINIMUM` dans le référentiel, ni l'abaisser selon le milieu.
- Ne pas laisser un moniteur sans droit établir une fiche ; le rôle `FICHE_SECURITE` ne qualifie pas comme DP.
- Ne pas faire enregistrer quoi que ce soit par la proposition de palanquées, ni dépasser l'aptitude d'un plongeur.
- Ne pas confondre `GroupePlongeurs` et groupes d'entraînement.
- Ne pas revenir à une page par plongée ni aux palanquées numérotées sur la fiche imprimée.
- Ne pas redonner au PDF de la fiche une mise en page propre : il redessine l'Excel.
- Ne pas laisser un ADMIN ou un encadrant non organisateur modifier un groupe de plongeurs.

## Repères
- `utilisateur.niveau_plongeur` (V25), `utilisateur.niveau_encadrement_prepare` (V49), `niveau_encadrement` : niveaux d'un encadrant.
- `HabilitationService` : droits de notation ; `HabilitationService.peutEtablirFicheSecurite` : droit d'établir la fiche.
- `FicheSecuriteService`, `NIVEAU_DP_MINIMUM` : DP E3 minimum.
- Rôles : `FICHE_SECURITE` (V71, établir la fiche), `SECURITE_SURFACE` (compléter au retour, compte non moniteur).
- `AdminSecuriteSurfaceController` : création des comptes sécurité surface ; `gardeFichesSecurite` : garde de leurs écrans.
- `ProposeurPalanquees`, `ProposeurPalanquees.NIVEAUX_STAGIAIRE_AUTORISES`, `AptitudePlongeur` : proposition des palanquées.
- `GroupePlongeurs` (V13), `groupe_plongeurs.createur_id`, `groupe_plongeurs_organisateur`, `DroitsGroupePlongeurs` (V81) : groupes et leurs droits.
- `EnvoiParametresSejourService` : envoi des paramètres de fin de séjour.
- `LiaisonSeances` (V43), `FicheSecuriteVue.seancesLiees` : séances liées.
- `FeuilleSecurite`, `FicheSecuriteExcelService`, `ClasseurHtml`, `FicheSecuritePdfService` : fiche imprimée (test `FeuilleSecuriteTest`, `FicheSecuriteTest.deuxToursSurUneFeuille`).
- Endpoints : `POST /api/seances/{id}/fiche-securite/proposition`, `PUT …/fiche-securite/realise`, `PUT …/organisateurs`.
- Annotations : `@PreAuthorize`.
- Démo : `e2@club.fr` a le rôle `FICHE_SECURITE`, `surface@club.fr` est un compte sécurité surface (V116).

Historique des choix : `docs/decisions/encadrants-fiche-securite.md`.
