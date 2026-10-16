---
paths:
  - "backend/src/main/java/fr/club/plongee/referentiel/**"
  - "backend/src/main/java/fr/club/plongee/delivrance/**"
  - "backend/src/main/resources/db/migration/**"
  - "outils/generer_referentiel.py"
  - "frontend/src/app/features/admin/referentiel-admin.component.ts"
---

# Référentiel MFT et règles fédérales

## Règles
- **Le référentiel MFT est en base, pas en dur** : un `Referentiel` = un niveau + une version datée du MFT.
- **Un cursus est figé sur son référentiel à l'inscription** : un `Cursus` porte lui-même la copie des valeurs utilisées par `EvaluationService`/`RegleDelivranceService`, celles du moment de l'inscription.
- **Importer une nouvelle révision fédérale avec `outils/generer_referentiel.py`** : un tuple par bloc dans la liste `REFERENTIELS`, un `INSERT` par version, dans une migration Flyway dédiée.
- **Les corrections manuelles passent par l'écran `/admin/referentiel`** : il édite un référentiel, ses blocs et ses critères directement en base (`ReferentielController`, `hasRole('ADMIN')`), y compris ceux déjà utilisés par des cursus en cours. La non-rétroactivité n'est donc plus automatique : c'est à l'admin de ne pas modifier un référentiel figé sur des cursus en cours si la rétroactivité n'est pas voulue.
- **La suppression reste bloquée** si la ligne est référencée par un cursus, si un critère porte une évaluation, ou si un bloc porte une validation.
- **Ne jamais éditer une migration déjà appliquée quelque part** : passer par une nouvelle migration ou par l'écran d'admin. La liberté d'édition est réservée à l'écran, pas aux fichiers de migration ; ne jamais retoucher à la main le SQL déjà généré.
- **`code` d'un bloc n'est qu'un identifiant unique par référentiel** : ne pas lui supposer un sens partagé entre niveaux ou révisions. Les codes `C1` à `C9` ne sont plus garantis (le N1 PE20 a dix compétences nommées).
- **Un bloc peut porter Comportement / Théorie / Modalités d'évaluation en texte libre** : colonnes nullable de `bloc_competence` (V7), vides sur les blocs des révisions antérieures ; la partie Technique reste faite de critères.
- **Un seul `Referentiel` par niveau, même scindé en qualifications** : N2 PA20|PE40 et N3 PA40|PE60 (V8) ont chacun deux qualifications (PA20 « plongeur autonome à 20 m » + PE40 « plongeur encadré à 40 m » ; PA40 + PE60, plus des « compétences complémentaires N3 »), chacune avec ses blocs, plus des blocs communs. *Pourquoi :* un « niveau » par qualification aurait touché `Cursus`, `HabilitationService`, `RegleDelivranceService` et les écrans d'admin.
- **`regroupement` n'est qu'une étiquette d'affichage** : « Commun », « PA20 », « PE40 », « PA40 », « PE60 », « N3 » (V8). Aucun suivi séparé par qualification : tout se valide sous un même cursus N2 ou N3. Le brevet N2/N3 n'est délivré que quand les qualifications requises sont acquises.
- **Les règles du MFT sont dans le serveur** : `EvaluationService` et `RegleDelivranceService` comparent des valeurs de la table `referentiel` (milieu naturel exclusif pour N2 et N3, âge minimum, brevet prérequis, RIFAP pour le N3, C6 du N2 validée en dernier).
- **Nouvelle règle = nouvelle colonne du référentiel**, pas une constante dans le code.
- **La profondeur maximale n'est pas opposée au moniteur qui note** : `referentiel.profondeur_max_formation` reste en base et éditable dans l'écran d'admin, à titre indicatif ; `EvaluationService.verifierSeance` ne la compare plus à `seance.profondeur_max`.

## À ne pas faire
- Éditer à la main une migration passée (ni `V2__referentiel_mft.sql` ni aucune autre) : l'exception de 2026 ne se reproduit pas.
- Supposer que `code` (`C1`…`C9`) a le même sens d'un niveau ou d'une révision à l'autre.
- Créer un niveau ou un cursus par qualification, ou un suivi séparé « a le PA20 mais pas le PE40 » sans un vrai chantier de modélisation.
- Coder une règle du MFT en constante.
- Réintroduire le contrôle de profondeur dans `EvaluationService.verifierSeance`.
- Importer PA60 : hors périmètre du brevet N3.

## Repères
- `Referentiel`, table `referentiel` : niveau + version du MFT, valeurs des règles.
- `bloc_competence` : blocs, `code`, `regroupement`, colonnes texte libre (V7).
- `Cursus` : formation d'un élève, figée sur un référentiel.
- `EvaluationService`, `RegleDelivranceService`, `HabilitationService` : appliquent les règles.
- `ReferentielController`, `/admin/referentiel` : édition par un ADMIN.
- `outils/generer_referentiel.py`, liste `REFERENTIELS` : import d'une révision.
- V7 : révision N1 PE20 (décembre 2025), colonnes texte libre ; désactive les anciennes versions.
- V8 : N2 PA20|PE40 (mai 2026), N3 PA40|PE60 (décembre 2025), colonne `regroupement`.
- `V2__referentiel_mft.sql` : supprimé (voir l'historique).
- `referentiel.profondeur_max_formation`, `seance.profondeur_max` : indicatifs.

Historique des choix : `docs/decisions/referentiel.md`.
