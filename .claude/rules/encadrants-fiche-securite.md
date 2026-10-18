---
paths:
  - "backend/src/main/java/fr/club/plongee/formation/**/*FicheSecurite*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*Palanquee*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*GroupePlongeurs*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*LiaisonSeances*"
  - "backend/src/main/java/fr/club/plongee/formation/**/AptitudePlongeur.java"
  - "backend/src/main/java/fr/club/plongee/formation/**/FeuilleSecurite.java"
  - "backend/src/main/java/fr/club/plongee/formation/**/ClasseurHtml.java"
  - "backend/src/main/java/fr/club/plongee/formation/**/EnvoiParametresSejourService.java"
  - "backend/src/main/java/fr/club/plongee/formation/**/PlongeurConnu*"
  - "backend/src/main/java/fr/club/plongee/evaluation/service/HabilitationService.java"
  - "backend/src/main/java/fr/club/plongee/admin/**"
  - "frontend/src/app/features/fiche-securite/**"
  - "frontend/src/app/features/groupes/**"
  - "frontend/src/app/features/admin/moniteurs.component.ts"
  - "frontend/src/app/features/admin/comptes-securite-surface.component.ts"
  - "frontend/src/app/core/fiche-securite*.ts"
  - "frontend/src/app/core/niveaux-plongeur*.ts"
---

# Encadrants, fiche de sécurité, groupes de plongeurs

## Niveaux des encadrants
- **Niveau de plongeur distinct du niveau d'encadrement, jamais déduit** : `utilisateur.niveau_plongeur` (N1 à N5, V25) ≠ `niveau_encadrement` ; un E1 peut n'être que N2. Saisi par un ADMIN (écran Moniteurs).
- **Niveau d'encadrement préparé** (moniteur en formation) : `utilisateur.niveau_encadrement_prepare` (V49, ADMIN), toujours au-dessus du niveau détenu.
- **Seul le stagiaire E3 en tire un droit** : encadre comme un E3 dans la proposition des palanquées, avec avertissement sur la présence du tuteur (`ProposeurPalanquees.NIVEAUX_STAGIAIRE_AUTORISES`). *Pourquoi :* choix du club, 2026.
- **Notation et choix du DP ignorent le niveau préparé** : `HabilitationService` ne lit que le niveau détenu.

## DP et droits sur la fiche
- **DP E3 minimum, quel que soit le milieu** : `FicheSecuriteService.NIVEAU_DP_MINIMUM`. *Pourquoi :* choix du club, 2026 ; règle de sécurité générale, pas du MFT, donc pas une colonne du référentiel.
- **Établir/modifier une fiche (y compris proposer les palanquées, lier les séances) : E3/E4, ADMIN, ou rôle `FICHE_SECURITE`** (V71, donné dans l'écran Moniteurs ; ne fait pas d'un moniteur un DP). `HabilitationService.peutEtablirFicheSecurite`, refus 422 lisible ; les autres voient l'écran en lecture seule. *Pourquoi :* choix du club, 2026.
- **Compléter au retour : tous les moniteurs et le rôle `SECURITE_SURFACE`** (`PUT …/fiche-securite/realise`).
- **Compte `SECURITE_SURFACE` = non moniteur** (sécurité surface d'une sortie) : créé en bas de l'écran Moniteurs (`AdminSecuriteSurfaceController`), ne voit que la liste des fiches et l'écran de complément (`gardeFichesSecurite`).
- Démo : `e2@club.fr` a `FICHE_SECURITE`, `surface@club.fr` est sécurité surface (V116).

## Proposition automatique des palanquées
- **Milieu naturel seulement, réseau obligatoire** : bouton de la fiche, `POST /api/seances/{id}/fiche-securite/proposition`. *Pourquoi :* choix du club, 2026.
- **Calcul pur `ProposeurPalanquees`**, à partir des membres du groupe absents des fiches liées ; aptitudes lues par `AptitudePlongeur` dans le texte libre, complétées par le compte lié.
- **Critères** : profondeur, exploration / enseignement, ≤ 4 plongeurs par palanquée, autonomes par 2 ou 3, niveaux séparés, encadrants retenus, paires ensemble / séparées.
- **N'écrit rien** : remplit le formulaire, que le DP relit et enregistre.
- **Jamais au-delà de l'aptitude d'un plongeur** : non placés renvoyés avec leur raison.
- **Exploration au-delà de 40 m : E4** (choix prudent ; lecture des annexes III-16/17 du Code du sport à confirmer par le club).

## Groupes de plongeurs (palanquées d'un séjour)
- **`GroupePlongeurs` (V13) ≠ groupes d'entraînement** : compose les palanquées d'un séjour.
- **Modifié seulement par son créateur et les organisateurs qu'il désigne** (V81) : `groupe_plongeurs.createur_id` posé à la création (ici ou depuis une fiche de sécurité), `groupe_plongeurs_organisateur`, `DroitsGroupePlongeurs` dans les `@PreAuthorize`, `PUT …/organisateurs`. Un ADMIN désigne les organisateurs mais ne modifie pas le groupe. Groupes d'avant V81 sans créateur (entité non auditée). *Pourquoi :* choix du club, 2026.
- **Les autres encadrants lisent les groupes**, les reprennent dans une fiche et envoient les paramètres.
- **Report nom/e-mail depuis un séjour lié : ouvert aux organisateurs du séjour.**
- **E-mail facultatif par membre** (V44) : vide = celui du dossier.
- **Fin de séjour : `EnvoiParametresSejourService` envoie à chacun les seules plongées de la sortie où il figure**, lues sur les fiches de sécurité.
- **Écran** : une ligne par membre, ajout en tête depuis les plongeurs connus.

## Fiche imprimée (PDF et Excel)
- **Modèle papier du club : deux plongées du même jour au même lieu sur une A4 paysage** (1er et 2e tour, sans exiger de liaison), une colonne par encadrant puis « Autonomes » (pas de palanquées numérotées), la case du plongeur dit le tour (« 1-2 »). Calcul pur `FeuilleSecurite`, partagé par `FicheSecuritePdfService` et `FicheSecuriteExcelService`. Tests : `FeuilleSecuriteTest`, `FicheSecuriteTest.deuxToursSurUneFeuille`. *Pourquoi :* modèle du club, 2026.
- **Une plongée s'imprime avec l'autre plongée de sa feuille** (`FicheSecuriteService.feuilleDe`) ; journée et sortie : deux plongées par page.
- **Le PDF est la feuille Excel redessinée** (`ClasseurHtml`) : toute retouche de mise en page dans `FicheSecuriteExcelService`, jamais dans le PDF.
- **Regroupement choisi à l'impression** : case cochée par défaut, paramètre `regrouper` des exports ; décochée = une feuille par plongée. *Pourquoi :* demande du club, 2026.

## Séances liées
- **Séances du même jour liables depuis la fiche** (V43, `LiaisonSeances`) : deux bateaux se partagent un groupe.
- **Chaque fiche ne propose que les plongeurs absents des palanquées des fiches liées** ; un plongeur sur deux fiches liées n'est qu'un avertissement (`FicheSecuriteVue.seancesLiees`).

Historique des choix : `docs/decisions/encadrants-fiche-securite.md`.
