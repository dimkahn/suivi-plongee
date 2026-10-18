---
paths:
  - "frontend/src/app/core/file-attente.service.ts"
  - "frontend/src/app/core/file-ecritures.service.ts"
  - "frontend/src/app/core/base-locale.ts"
  - "frontend/src/app/core/reseau.service.ts"
  - "frontend/src/app/features/synchronisation/**"
  - "backend/src/main/java/fr/club/plongee/evaluation/SynchronisationController.java"
---

# Hors ligne : des files, pas un cache d'écriture

- **Notation** : écrite dans IndexedDB avec une référence client (UUID), rejouée par `POST /api/synchronisation/evaluations`, qui répond élément par élément. Référence unique en base : rejouer ne duplique pas. Un refus différé remonte au moniteur dans un bandeau, jamais absorbé en silence.
- **Écritures qui remplacent un état** (présence, fiche de sécurité, profil réalisé) : seconde file, `FileEcrituresService`. Idempotentes côté serveur : on garde la dernière version par cible, envoyées dans l'ordre de leur première saisie (une fiche avant son profil réalisé).
- **« Préparer hors ligne »** embarque aussi feuilles de présence et fiches de sécurité des séances à ±30 jours, moniteurs, plongeurs connus, groupes et planning du bassin de la saison ouverte.
