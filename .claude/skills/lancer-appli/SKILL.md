---
name: lancer-appli
description: Démarre suivi-plongee en local (backend Spring profil dev + H2 + données de démo, frontend Angular) pour vérifier un écran ou une API dans le vrai navigateur avant de dire « c'est fait ». À utiliser après toute modification visible, ou quand on demande de lancer, tester à la main ou faire une capture de l'appli.
argument-hint: "[écran à ouvrir, ex. /planning]"
model: sonnet
---

# Lancer l'appli pour vérifier

L'appli de **démonstration** seulement (profil `dev`, base H2 en mémoire,
données fictives `db/demo`). Jamais contre la production.

## 1. Démarrer (deux processus en arrière-plan)

Vérifier d'abord ce qui tourne déjà :

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/actuator/health   # 200 = backend prêt
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4200/                  # 200 = frontend prêt
```

Sinon, lancer chacun avec `run_in_background: true` (pas de `&`) :

```bash
cd backend && mvn -q spring-boot:run          # profil dev par défaut, port 8080
cd frontend && npm start                       # ng serve, port 4200, proxifie /api vers 8080
```

Attendre que les deux répondent 200 avec l'outil Monitor (boucle `until curl …; do sleep 2; done`),
jamais avec un `sleep` au premier plan. Le backend met 30 à 60 s (Flyway rejoue
toutes les migrations sur une H2 neuve). Un échec au démarrage : lire la sortie du
processus en arrière-plan et le dire, sans masquer l'erreur.

## 2. Se connecter et vérifier

Comptes de démonstration (mot de passe `plongee2026`, détail dans le README) :

| Compte | Pour vérifier |
|---|---|
| `presidente@club.fr` | ADMIN + E4 : tout, écrans d'administration |
| `e3@club.fr` | E3, directeur technique : notation N1-N3, matériel |
| `e2@club.fr` | E2, TIV, FICHE_SECURITE |
| `e1@club.fr` | E1 : notation N1 seulement, refus attendus ailleurs |
| `surface@club.fr` | sécurité surface : fiches de sécurité au retour seulement |
| `eleve@club.fr` | élève (ouvert en dev seulement) |

- **Écran :** ouvrir `http://localhost:4200$ARGUMENTS` dans le navigateur (outils
  Claude in Chrome : charger le skill `claude-in-chrome` d'abord), se connecter, faire
  le geste modifié. Vérifier aussi en largeur téléphone (moins de 860 px : barre
  d'onglets en bas) et avec un compte qui ne doit **pas** avoir le droit.
- **API :** `POST /api/auth/connexion` `{"email","motDePasse"}` rend `jetonAcces` ;
  l'envoyer en `Authorization: Bearer …`. Un refus métier est un 422 dont le
  `detail` est le message montré à l'utilisateur.

## 3. Rendre compte et arrêter

Dire ce qui a été vérifié à l'écran (compte, largeur, geste), avec une capture si
utile. Arrêter les deux processus lancés (TaskStop) si on les a démarrés soi-même ;
laisser tourner ceux qui tournaient déjà.
