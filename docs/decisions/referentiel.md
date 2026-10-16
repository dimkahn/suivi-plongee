# Référentiel MFT : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/referentiel.md`.

## Référentiel en base, figé à l'inscription
- **Date :** origine du projet.
- **Contexte :** le MFT évolue par révisions fédérales datées.
- **Décision :** un `Referentiel` par niveau et version, importé par `outils/generer_referentiel.py` dans une migration Flyway dédiée ; un `Cursus` y est figé à l'inscription.
- **Conséquences :** à l'origine, garantie qu'une révision fédérale ne s'applique jamais rétroactivement.

## Édition du référentiel depuis l'écran d'admin
- **Date :** 2026, choix révisé.
- **Contexte :** besoin de corriger référentiels, blocs et critères sans migration.
- **Décision :** l'écran `/admin/referentiel` (`ReferentielController`, `hasRole('ADMIN')`) édite en base, y compris les référentiels utilisés par des cursus en cours.
- **Conséquences :** l'ancienne garantie de non-rétroactivité n'est plus automatique pour ces corrections manuelles ; elle repose sur l'admin. La suppression reste bloquée (cursus, évaluation, validation). Les fichiers de migration restent intouchables.

## Retrait des trois premières versions du MFT
- **Date :** 2026, exception ponctuelle.
- **Contexte :** N1 2016-11-15, N2 2015-01-02 et N3 2016-01-01, générés par une version antérieure du script, étaient intégralement désactivés par V7/V8.
- **Décision :** retirés de `V2__referentiel_mft.sql` (fichier supprimé) et de `REFERENTIELS`.
- **Conséquences :** possible uniquement parce qu'aucune base n'avait encore exécuté ces migrations. Ne plus jamais éditer une migration déjà appliquée quelque part.

## Abandon des codes de bloc communs C1 à C9
- **Date :** révision PE20 du N1 (décembre 2025), V7.
- **Contexte :** historiquement, les codes `C1` à `C9` étaient communs aux trois niveaux (intitulés et critères différents par niveau).
- **Décision :** le N1 PE20 les remplace par dix compétences nommées, structurées en Technique (des critères, comme avant) / Comportement / Théorie / Modalités d'évaluation (texte libre, colonnes nullable de `bloc_competence` ajoutées en V7).
- **Conséquences :** `code` n'est plus qu'un identifiant unique par référentiel ; les colonnes texte libre sont vides sur les blocs antérieurs.

## N2 et N3 scindés en qualifications, un seul référentiel par niveau
- **Date :** V8 (N2 PA20|PE40 de mai 2026, N3 PA40|PE60 de décembre 2025).
- **Contexte :** chaque révision remplace un bloc unique de compétences par deux qualifications, plus des blocs communs (et des « compétences complémentaires N3 »).
- **Décision :** choix de modélisation délibéré : un seul `Referentiel` par niveau, comme avant ; étiquette d'affichage `regroupement` sur chaque bloc. Écarté : un « niveau » par qualification, qui aurait touché `Cursus`, `HabilitationService`, `RegleDelivranceService` et les écrans d'admin.
- **Conséquences :** aucun suivi séparé par qualification. Distinguer « a le PA20 mais pas le PE40 » serait un vrai chantier de modélisation. PA60 (plongeur autonome à 60 m, sans DP, obtenu après le N3) n'est pas importé, hors périmètre du brevet N3.

## Retrait du contrôle de profondeur maximale à la notation
- **Date :** 2026, choix révisé.
- **Contexte :** `EvaluationService.verifierSeance` comparait `referentiel.profondeur_max_formation` à `seance.profondeur_max`.
- **Décision :** vérification retirée.
- **Conséquences :** la colonne reste en base et éditable dans l'écran d'admin, à titre indicatif, mais n'est plus opposée au moniteur qui note un critère.
