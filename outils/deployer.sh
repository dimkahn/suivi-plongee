#!/usr/bin/env bash
# Met en production une version déjà construite et publiée sur ghcr.io.
# Lancé sur le serveur, depuis le dossier du dépôt, par le workflow GitHub
# « Déploiement » (.github/workflows/deploiement.yml) ; peut aussi servir à
# la main pour revenir à une version précédente :
#
#   git fetch --tags && git checkout --detach v2026.09.1
#   ./outils/deployer.sh v2026.09.1
#
# Étapes : sauvegarde de la base (avant que Flyway n'applique de nouvelles
# migrations), téléchargement des images, redémarrage, contrôle de santé.
set -euo pipefail

VERSION="${1:?usage : outils/deployer.sh <tag>, par exemple v2026.09.1}"
export VERSION
compose=(docker compose -f docker-compose.prod.yml)

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Fichier .env absent dans $(pwd) : voir DEPLOIEMENT.md, étape 5." >&2
  exit 1
fi

# 1. Sauvegarde : une migration Flyway ne se défait pas, le dump si.
mkdir -p sauvegardes
if [[ -n "$("${compose[@]}" ps -q db 2>/dev/null)" ]]; then
  sauvegarde="sauvegardes/avant-${VERSION}-$(date +%F-%H%M).sql.gz"
  echo "Sauvegarde de la base dans $sauvegarde"
  "${compose[@]}" exec -T db pg_dump -U plongee plongee | gzip > "$sauvegarde"
  # On garde les 10 dernières sauvegardes de déploiement.
  ls -1t sauvegardes/avant-*.sql.gz | tail -n +11 | xargs -r rm --
else
  echo "Base pas encore démarrée : premier déploiement, pas de sauvegarde."
fi

# 2. Images de la version demandée, puis redémarrage sans rien construire.
echo "Téléchargement des images $VERSION"
"${compose[@]}" pull backend frontend
"${compose[@]}" up -d --no-build --remove-orphans

# 3. Contrôle de santé, vu depuis le conteneur frontend (le backend n'est pas
#    publié sur l'hôte). Flyway peut prendre un moment sur une grosse migration.
echo "Attente du démarrage du backend"
for _ in $(seq 1 60); do
  if "${compose[@]}" exec -T frontend wget -qO- http://backend:8080/actuator/health 2>/dev/null | grep -q '"UP"'; then
    echo "Version $VERSION en ligne."
    docker image prune -f > /dev/null
    exit 0
  fi
  sleep 5
done

echo "Le backend ne répond pas après 5 minutes. Derniers journaux :" >&2
"${compose[@]}" logs --tail 80 backend >&2
echo "Pour revenir à la version précédente : voir DEPLOIEMENT.md, « Revenir en arrière »." >&2
exit 1
