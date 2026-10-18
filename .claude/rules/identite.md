---
paths:
  - "backend/src/main/java/fr/club/plongee/identite/**"
  - "frontend/src/app/core/identite.service.ts"
  - "frontend/src/app/features/admin/identite-admin.component.ts"
  - "frontend/src/styles.css"
  - "backend/src/main/java/fr/club/plongee/formation/**/FicheSecurite*Service.java"
---

# Identité de la structure

- Identité visuelle du club (cppjvo.fr) : palette océan/corail, Poppins (titres), Nunito (texte). Jetons dans `frontend/src/styles.css`. Pas de bibliothèque de composants.
- **Réglable par structure** (2026, une installation par club ou centre) : table `identite_structure` (V74, une ligne), écran `/admin/identite`, `IdentiteStructureService` (JdbcTemplate, pas d'entité). Nom, nom court, texte d'accueil, trois couleurs (`--profond`, `--profond-fonce`, `--accent`, posées par `core/identite.service.ts`), logo (PNG ≤ 512 px).
- **Vide = l'identité d'origine** (logo embarqué, couleurs de styles.css, nom de `CLUB_NOM`) : la production ne change pas tant que rien n'est saisi.
- `GET /api/identite/**` est public (page de connexion) ; manifeste et icônes passent par `/api/identite/manifest.webmanifest` seulement si l'identité est réglée.
- Les exports (fiche de sécurité PDF/Excel, compte rendu TIV, courriels de fin de séjour) lisent `nom()` et `logoPng()` à chaque génération ; ne plus utiliser `app.club.nom` directement.
