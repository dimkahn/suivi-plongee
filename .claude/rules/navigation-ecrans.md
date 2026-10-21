---
paths:
  - "frontend/src/app/app.component.ts"
  - "frontend/src/app/app.routes.ts"
  - "frontend/src/app/core/navigation.ts"
  - "frontend/src/app/core/barre-page.component.ts"
  - "frontend/src/app/core/dialogue.component.ts"
  - "frontend/src/app/features/aide/comment-faire.ts"
  - "frontend/src/app/features/accueil/**"
---

# Navigation et écrans

- **Accueil des encadrants** `/aujourdhui` (`AujourdhuiComponent`) : la séance du jour ou la prochaine, liens vers l'appel, le programme, la fiche de sécurité.
- **Sous 860 px** : barre d'onglets fixe en bas (`app.component.ts`), « Plus » pour le reste du menu. Ce qui colle au bas se place au-dessus avec `--hauteur-onglets` (ou `z-index` > 32 pour une barre de choix temporaire).
- **Barre de page** (`core/barre-page.component.ts`, posée par `app.component.ts`) : à gauche le retour « ← … » vers le parent, calculé pour toute l'appli dans `core/navigation.ts` (on remonte d'un cran dans l'arborescence, jamais vers la page vue juste avant ; un écran qui ne connaît son parent qu'une fois chargé le donne par `NavigationService.preciserRetour`) ; à droite « Comment faire ? », manuels de l'écran (`features/aide/comment-faire.ts`, chargé au premier appui). Pas de lien de retour dans un écran ; un nouvel écran = une entrée dans ces deux fichiers.
- **Menu allégé** (choix du club, 2026) : groupes de plongeurs depuis « Séjours », « Se déconnecter » en bas de « Mon compte » (le nom dans le menu), matériel en rubrique d'« Administration » pour l'ADMIN (DT et TIV non admin gardent « Matériel » au menu).
- **Dialogues** : `<app-dialogue [ouvert] titre [erreur] (fermer)>`, boutons dans `.actions-dialogue`, plein écran sur téléphone ; `[choix]="true"` pour une fenêtre de choix (séance, date, actions : style `.dialogue-seance`, « Fermer »), jamais un `<dialog>` écrit à la main. Restent à part : les visionneuses (photo d'un prêt, lecteur vidéo) et la fenêtre du planning. Restent des pages entières : fiche d'un équipement, inspection TIV, fiche de sécurité, programme d'exercices, génération de saison. Un overlay ouvert depuis un dialogue (recadrage photo) se place dans son contenu : le reste de la page est inerte tant qu'il est ouvert.
