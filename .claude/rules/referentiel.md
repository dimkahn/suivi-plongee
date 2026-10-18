---
paths:
  - "backend/src/main/java/fr/club/plongee/referentiel/**"
  - "backend/src/main/java/fr/club/plongee/delivrance/**"
  - "backend/src/main/resources/db/migration/*referentiel*"
  - "outils/generer_referentiel.py"
  - "frontend/src/app/features/admin/referentiel-admin.component.ts"
---

# Référentiel MFT et règles fédérales

- **Référentiel MFT en base, pas en dur** : un `Referentiel` = un niveau + une version datée du MFT.
- **Un cursus est figé sur son référentiel à l'inscription** : `Cursus` porte la copie des valeurs lues par `EvaluationService`/`RegleDelivranceService` au moment de l'inscription.
- **Nouvelle révision fédérale : `outils/generer_referentiel.py`** : un tuple par bloc dans `REFERENTIELS`, un `INSERT` par version, dans une migration Flyway dédiée. V7 : N1 PE20 (décembre 2025), désactive les anciennes versions. V8 : N2 PA20|PE40 (mai 2026), N3 PA40|PE60 (décembre 2025). PA60 hors périmètre (pas dans le brevet N3).
- **Corrections manuelles par l'écran `/admin/referentiel`** (`ReferentielController`, `hasRole('ADMIN')`) : référentiel, blocs, critères, y compris ceux de cursus en cours. La non-rétroactivité n'est donc plus automatique : à l'admin de ne pas toucher un référentiel figé sur des cursus en cours si elle n'est pas voulue.
- **Suppression bloquée** si la ligne est référencée par un cursus, si un critère porte une évaluation ou si un bloc porte une validation.
- **Jamais éditer une migration déjà appliquée ni retoucher le SQL généré** : nouvelle migration ou écran d'admin. `V2__referentiel_mft.sql` a été supprimé (exception de 2026, à ne pas reproduire).
- **`code` d'un bloc = identifiant unique par référentiel**, sans sens partagé entre niveaux ou révisions ; `C1`…`C9` plus garantis (le N1 PE20 a dix compétences nommées).
- **Comportement / Théorie / Modalités d'évaluation en texte libre sur un bloc** : colonnes nullable de `bloc_competence` (V7), vides pour les révisions antérieures ; la Technique reste faite de critères.
- **Un seul `Referentiel` par niveau, même scindé en qualifications** : N2 = PA20 (autonome 20 m) + PE40 (encadré 40 m), N3 = PA40 + PE60 + « compétences complémentaires N3 » (V8), chacune avec ses blocs, plus des blocs communs. Pas de niveau, de cursus ni de suivi séparé par qualification (« a le PA20 mais pas le PE40 ») sans un vrai chantier de modélisation. *Pourquoi :* cela toucherait `Cursus`, `HabilitationService`, `RegleDelivranceService` et les écrans d'admin.
- **`regroupement` (V8) = étiquette d'affichage** : « Commun », « PA20 », « PE40 », « PA40 », « PE60 », « N3 ». Tout se valide sous un même cursus N2 ou N3 ; le brevet n'est délivré que quand les qualifications requises sont acquises.
- **Règles du MFT dans le serveur** : `EvaluationService` et `RegleDelivranceService` comparent des valeurs de la table `referentiel` (milieu naturel exclusif N2/N3, âge minimum, brevet prérequis, RIFAP pour le N3, C6 du N2 validée en dernier). Nouvelle règle = nouvelle colonne, jamais une constante.
- **Profondeur maximale non opposée au moniteur qui note** : `referentiel.profondeur_max_formation` reste en base, éditable, indicative ; `EvaluationService.verifierSeance` ne la compare plus à `seance.profondeur_max` (ne pas réintroduire).

Historique des choix : `docs/decisions/referentiel.md`.
