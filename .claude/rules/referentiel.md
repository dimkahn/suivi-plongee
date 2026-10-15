---
paths:
  - "backend/src/main/java/fr/club/plongee/referentiel/**"
  - "backend/src/main/java/fr/club/plongee/delivrance/**"
  - "backend/src/main/resources/db/migration/**"
  - "outils/generer_referentiel.py"
  - "frontend/src/app/features/admin/referentiel-admin.component.ts"
---

# Référentiel MFT et règles fédérales

**Le référentiel MFT est en base, pas en dur.** Un `Referentiel` = un niveau +
une version datée du MFT ; un `Cursus` y est figé à l'inscription (la copie
des valeurs utilisées par `EvaluationService`/`RegleDelivranceService` reste
celle du moment de l'inscription, portée par le cursus lui-même). Le contenu
initial de chaque révision fédérale a été importé via
`outils/generer_referentiel.py` (un tuple par bloc dans la liste
`REFERENTIELS`, un `INSERT` par version dans une migration Flyway dédiée) ;
ce script reste la référence pour importer une **nouvelle** révision publiée
par la fédération, avec une migration Flyway dédiée. **Choix révisé (2026) :**
l'écran `/admin/referentiel` permet désormais d'éditer un référentiel, ses
blocs et ses critères directement en base (`ReferentielController`,
`hasRole('ADMIN')`), y compris ceux déjà utilisés par des cursus en cours —
l'ancienne garantie « une révision fédérale ne s'applique jamais
rétroactivement » n'est donc plus automatique pour ces corrections manuelles :
c'est à l'admin de ne pas modifier un référentiel figé sur des cursus en
cours si la rétroactivité n'est pas voulue. La suppression reste bloquée si
la ligne est référencée par un cursus, un critère porte une évaluation, ou un
bloc porte une validation. Ne jamais éditer le SQL déjà généré dans une
migration passée à la main : cette liberté est réservée à l'écran d'admin,
pas aux fichiers de migration. **Exception ponctuelle (2026) :** les trois
premières versions du MFT (N1 2016-11-15, N2 2015-01-02, N3 2016-01-01),
générées par une version antérieure du script et intégralement désactivées
depuis par V7/V8, ont été retirées de `V2__referentiel_mft.sql` (fichier
supprimé) et de `REFERENTIELS` — possible uniquement parce qu'aucune base
n'avait encore exécuté ces migrations. Ne plus jamais éditer une migration
déjà appliquée quelque part : passer par une nouvelle migration ou par
l'écran d'admin.
Historiquement les codes de bloc `C1` à `C9` étaient communs aux trois
niveaux (intitulés et critères différents par niveau) — **ce n'est plus
garanti** : la révision PE20 (décembre 2025) du N1 les a abandonnés au profit
de dix compétences nommées, structurées en Technique (des critères, comme
avant) / Comportement / Théorie / Modalités d'évaluation (texte libre, porté
par des colonnes nullable sur `bloc_competence` ajoutées en V7 — vide sur les
blocs des révisions antérieures). Ne pas supposer que `code` a un sens
partagé entre niveaux ou révisions : c'est un simple identifiant unique par
référentiel.

**Le N2 et le N3 se scindent maintenant en plusieurs qualifications.** Les
révisions PA20|PE40 (N2, mai 2026, V8) et PA40|PE60 (N3, décembre 2025, V8)
remplacent chacune un bloc unique de compétences par deux qualifications
(PA20 « plongeur autonome à 20 m » + PE40 « plongeur encadré à 40 m » pour le
N2 ; PA40 + PE60, plus des « compétences complémentaires N3 », pour le N3),
chacune avec ses propres blocs, plus des blocs communs. Le brevet N2/N3 n'est
délivré que quand les qualifications requises sont acquises. **Choix de
modélisation délibéré :** un seul `Referentiel` par niveau, comme avant —
pas un « niveau » à part entière par qualification, ce qui aurait touché
`Cursus`, `HabilitationService`, `RegleDelivranceService` et les écrans
d'admin. Chaque bloc porte juste une étiquette d'affichage dans la colonne
`regroupement` (« Commun », « PA20 », « PE40 », « PA40 », « PE60 », « N3 »,
ajoutée en V8) : il n'y a **aucun suivi séparé** de la progression par
qualification, tout se valide sous un même cursus N2 ou N3. Si le club a
besoin un jour de distinguer formellement « a le PA20 mais pas le PE40 »,
c'est un vrai chantier de modélisation, pas une simple mise à jour du
référentiel. PA60 (plongeur autonome à 60 m, sans DP, obtenu après le N3)
n'est pas importé : hors périmètre du brevet N3 lui-même.

**Les règles du MFT sont dans le serveur.** `EvaluationService` et
`RegleDelivranceService` comparent des valeurs issues de la table
`referentiel` : milieu naturel exclusif pour N2 et N3, âge minimum, brevet
prérequis, RIFAP pour le N3, C6 du N2 validée en dernier. Ajouter une règle =
ajouter une colonne au référentiel plutôt qu'une constante dans le code.
**Choix révisé (2026) :** la vérification de la profondeur maximale
d'évolution (`referentiel.profondeur_max_formation` vs `seance.profondeur_max`)
a été retirée de `EvaluationService.verifierSeance` — la colonne reste en
base et éditable dans l'écran d'admin du référentiel, à titre indicatif, mais
n'est plus opposée au moniteur qui note un critère.
