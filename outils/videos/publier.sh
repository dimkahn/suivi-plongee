#!/usr/bin/env bash
# Publie les vidéos tournées (outils/videos/sorties/) dans le dossier que
# Caddy sert sous /medias/videos/, lu par la page publique /videos de l'appli.
#
# Ni tag ni redéploiement : la page relit catalogue.json à chaque visite.
# À lancer sur la machine de production, après tourner.sh (ou après avoir
# copié le dossier sorties/ d'une autre machine).
#
# Usage :
#   outils/videos/publier.sh                  vers le dossier de la prod
#   outils/videos/publier.sh /autre/dossier   vers ce dossier
#
# Dossier par défaut : VIDEOS du .env de la prod
# (~/suivi-plongee-deploiement/depot/.env), sinon videos-publiees/ dans ce
# même dépôt de prod, comme le prévoit docker-compose.prod.yml.
set -euo pipefail

VIDEOS_DIR="$(cd "$(dirname "$0")" && pwd)"
SORTIES="$VIDEOS_DIR/sorties"
DEPOT_PROD="${DOSSIER_DEPLOIEMENT:-$HOME/suivi-plongee-deploiement}/depot"

echec() { printf 'Échec : %s\n' "$*" >&2; exit 1; }

[ -f "$SORTIES/catalogue.json" ] || echec "pas de catalogue dans $SORTIES : tourner les vidéos d'abord (tourner.sh)."
ls "$SORTIES"/*.webm >/dev/null 2>&1 || echec "aucune vidéo dans $SORTIES."

if [ $# -ge 1 ]; then
  CIBLE="$1"
elif [ -n "${VIDEOS:-}" ]; then
  CIBLE="$VIDEOS"
elif [ -f "$DEPOT_PROD/.env" ] && grep -q '^VIDEOS=' "$DEPOT_PROD/.env"; then
  CIBLE="$(grep '^VIDEOS=' "$DEPOT_PROD/.env" | tail -1 | cut -d= -f2-)"
else
  CIBLE="$DEPOT_PROD/videos-publiees"
fi
case "$CIBLE" in /*) ;; *) CIBLE="$DEPOT_PROD/$CIBLE" ;; esac

mkdir -p "$CIBLE"
[ -w "$CIBLE" ] || echec "$CIBLE n'est pas modifiable (créé par Docker en root ? le recréer à la main)."

if ! ls "$SORTIES"/*.mp4 >/dev/null 2>&1; then
  echo "Attention : aucune vidéo MP4. Les iPhone lisent mal le WebM ;"
  echo "installer ffmpeg (ou désigner FFMPEG) puis relancer tourner.sh."
fi

# Vidéos et aperçus d'abord, catalogue en dernier : la page ne l'annonce
# qu'une fois ses fichiers en place. --delete retire les vidéos abandonnées.
rsync -a --delete --include='*.webm' --include='*.mp4' --include='*.jpg' --exclude='*' \
  "$SORTIES/" "$CIBLE/"
cp "$SORTIES/catalogue.json" "$CIBLE/catalogue.json.tmp"
mv "$CIBLE/catalogue.json.tmp" "$CIBLE/catalogue.json"

nb=$(ls "$CIBLE"/*.webm | wc -l)
taille=$(du -sh "$CIBLE" | cut -f1)
echo "Publié : $nb vidéo(s), $taille, dans $CIBLE"
echo "Page : https://<votre domaine>/videos"
