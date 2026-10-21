# Être prévenu avant qu'un CACI n'expire

- **Statut :** validée (Dimitri, 2026-10-21)
- **Demandeur (PO) :** Dimitri
- **Date :** 2026-10-21

## Le problème
Aujourd'hui, l'appli montre l'état du CACI (valide, bientôt échu, expiré, non
renseigné) dans « Infos élèves », dans l'écran Moniteurs et dans « Mon compte »,
et l'administrateur peut filtrer sur « À vérifier ». Mais personne n'est
prévenu : il faut ouvrir l'écran et penser à regarder. Un CACI expiré se
découvre donc tard, parfois au bord du bassin, le jour où l'élève ou le moniteur
doit plonger. La fin de validité est calculée : examen + 1 an.

## Pour qui
- Administrateur du club : celui qui saisit et suit les CACI.
- Élèves (dont des mineurs, donc leurs responsables) et moniteurs : ceux dont le
  CACI arrive à échéance.
- Directeur technique : veut éviter qu'une personne sans CACI valide plonge.

## La valeur
- Le renouvellement du certificat se fait avant l'échéance, pas après.
- Moins de séances perturbées par un CACI découvert périmé au dernier moment.
- Le club tient plus facilement son obligation de contrôle du certificat.
- L'administrateur n'a plus à surveiller la liste à la main.

## Critère de succès
- Une personne dont le CACI expire bientôt est prévenue, sans qu'un
  administrateur ait à y penser, assez tôt pour renouveler.
- Après la mise en production, il n'y a plus de séance où un CACI périmé n'avait
  pas été signalé à l'avance (à confirmer sur une saison).

## Hors sujet
- Les relances RIFAP échus et les 4 plongées en milieu naturel d'un N1 certifié
  en piscine (autres volets du même chantier).
- Le CACI des clients de passage (séjours).
- Toute évolution de ce qui est stocké du CACI.
- Blocage de l'inscription ou de la notation d'une personne au CACI périmé.

## Points d'attention
- Mineurs : le message doit-il aller à l'élève ou à son responsable ? Aucune
  adresse de responsable n'est connue de l'appli à ce jour.
- Santé : le message dit seulement que le CACI expire à telle date, jamais le
  contenu du certificat, ni les cases cochées, ni la qualité du médecin
  (`.claude/rules/donnees-personnelles.md`). Aucun champ libre de santé.
- Comptes élèves fermés : un élève ne se connecte pas, donc une alerte dans
  l'appli ne l'atteint pas (`.claude/rules/comptes.md`).
- E-mail : l'envoi existe (`ServiceNotificationEmail` en production, simple
  affichage console en dev). Les moniteurs sont déjà joignables par e-mail ; la
  disponibilité d'une adresse pour les élèves est à vérifier.
- Le « bientôt échu » existe déjà à l'écran : le délai doit rester cohérent avec
  lui.
- Repose sur la règle examen + 1 an (choix du club 2026).

## Réponses du PO (2026-10-21)
1. **Qui est relancé :** l'administrateur (liste récapitulative) et les
   moniteurs eux-mêmes. Les élèves ne reçoivent rien directement.
2. **Élèves mineurs :** l'administrateur transmet à l'élève ou à son
   responsable. On n'ajoute pas d'adresse de responsable.
3. **Préavis :** aligné sur le délai « bientôt échu » déjà affiché à l'écran ;
   un rappel à J-30 et un le jour de l'expiration, puis plus rien.
4. **Moyen :** e-mail seulement.
5. **Périmètre :** élèves de la saison en cours et moniteurs actifs.
6. **Trace :** oui, date et destinataire seulement, pour ne pas relancer deux
   fois.
7. **Sans CACI renseigné :** ils figurent seulement dans la liste de
   l'administrateur, sans relance individuelle.
