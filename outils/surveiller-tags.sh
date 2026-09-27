#!/usr/bin/env bash
# Déploiement automatique par surveillance des tags, sans GitHub Actions.
#
# Lancé toutes les 5 minutes par cron sur la machine de production. À chaque
# passage : récupère les tags de GitHub ; si un tag `v…` porté par master est
# plus récent que la version en ligne, il
#   1. construit les images de ce tag sur place (rien n'est encore touché :
#      un échec de construction laisse la version en ligne tranquille) ;
#   2. garde de côté les images de la version en ligne (tag `avant-<tag>`) ;
#   3. sauvegarde la base (une migration Flyway ne se défait pas, le dump si) ;
#   4. démarre tout le docker compose de prod sur la nouvelle version ;
#   5. vérifie que le backend répond. Sinon : restaure la sauvegarde, remet les
#      images gardées de côté et note le tag comme « en échec » pour ne pas
#      recommencer toutes les 5 minutes.
#
# Tout vit dans un dossier à part (~/suivi-plongee-deploiement par défaut),
# jamais dans le dossier de développement :
#   depot/          clone du dépôt, placé sur le tag déployé, avec le .env de prod
#   sauvegardes/    dumps de la base avant chaque déploiement (10 derniers)
#   journal.log     ce qui s'est passé, horodaté
#   version-en-ligne, tags-en-echec
#
# Usage :
#   outils/surveiller-tags.sh --installer   première mise en place + cron
#   surveiller-tags.sh                      un passage (ce que lance cron)
#   surveiller-tags.sh v2026.10.1           déployer ce tag tout de suite,
#                                           même s'il est noté en échec
#
# Le nom de projet docker compose reste « suivi-plongee » : mêmes conteneurs
# et surtout même volume de base que la prod lancée jusqu'ici à la main.
set -euo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
DOSSIER="${DOSSIER_DEPLOIEMENT:-$HOME/suivi-plongee-deploiement}"
DEPOT="$DOSSIER/depot"
DEPOT_DISTANT="git@github.com-dimkahn:dimkahn/suivi-plongee.git"
PROJET=suivi-plongee
IMAGES=(ghcr.io/dimkahn/suivi-plongee-backend ghcr.io/dimkahn/suivi-plongee-frontend)
VERSIONS_GARDEES=5        # images de versions déployées conservées pour un retour arrière
SAUVEGARDES_GARDEES=10

journal() { echo "$(date '+%F %T') $*" | tee -a "$DOSSIER/journal.log"; }
compose() { (cd "$DEPOT" && docker compose -p "$PROJET" -f docker-compose.prod.yml "$@"); }

# ---------------------------------------------------------------------------
#  Installation : clone, .env de prod, copie du script, ligne cron.
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--installer" ]]; then
  source_env="$(cd "$(dirname "$0")/.." && pwd)/.env"
  mkdir -p "$DOSSIER/sauvegardes"
  [[ -d "$DEPOT/.git" ]] || git clone -q "$DEPOT_DISTANT" "$DEPOT"
  if [[ ! -f "$DEPOT/.env" ]]; then
    [[ -f "$source_env" ]] || { echo "Pas de .env à copier ($source_env) : voir DEPLOIEMENT.md, étape 5." >&2; exit 1; }
    install -m 600 "$source_env" "$DEPOT/.env"
  fi
  # Le script tourne depuis sa copie : un checkout du dépôt pendant qu'il
  # s'exécute ne doit pas le modifier sous ses pieds.
  install -m 755 "$0" "$DOSSIER/surveiller-tags.sh"
  ligne="*/5 * * * * $DOSSIER/surveiller-tags.sh >> $DOSSIER/cron.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v 'surveiller-tags.sh' || true; echo "$ligne" ) | crontab -
  echo "Installé dans $DOSSIER. Tâche cron :"
  echo "  $ligne"
  exit 0
fi

[[ -d "$DEPOT/.git" ]] || { echo "Lancer d'abord : outils/surveiller-tags.sh --installer" >&2; exit 1; }
[[ -f "$DEPOT/.env" ]] || { echo "Fichier $DEPOT/.env absent : voir DEPLOIEMENT.md, étape 5." >&2; exit 1; }

# Un seul passage à la fois : une construction peut dépasser 5 minutes.
exec 9> "$DOSSIER/.verrou"
flock -n 9 || exit 0

# ---------------------------------------------------------------------------
#  Y a-t-il un tag à déployer ?
# ---------------------------------------------------------------------------
git -C "$DEPOT" fetch -q --tags --force --prune origin
en_ligne="$(cat "$DOSSIER/version-en-ligne" 2>/dev/null || true)"
touch "$DOSSIER/tags-en-echec"

if [[ -n "${1:-}" ]]; then
  TAG="$1"
  git -C "$DEPOT" rev-parse -q --verify "refs/tags/$TAG" > /dev/null \
    || { journal "Tag $TAG inconnu sur GitHub."; exit 1; }
else
  TAG="$(git -C "$DEPOT" tag --merged origin/master --list 'v*' --sort=-v:refname | head -n 1)"
  [[ -z "$TAG" || "$TAG" == "$en_ligne" ]] && exit 0
  # Seulement un tag plus récent que celui en ligne : pas de retour arrière automatique.
  if [[ -n "$en_ligne" && "$(printf '%s\n%s\n' "$en_ligne" "$TAG" | sort -V | tail -n 1)" != "$TAG" ]]; then
    exit 0
  fi
  grep -qxF "$TAG" "$DOSSIER/tags-en-echec" && exit 0
fi

journal "=== Déploiement de $TAG (en ligne : ${en_ligne:-inconnue}) ==="

echec() {
  journal "ÉCHEC : $*"
  grep -qxF "$TAG" "$DOSSIER/tags-en-echec" || echo "$TAG" >> "$DOSSIER/tags-en-echec"
  journal "$TAG noté en échec, il ne sera plus retenté automatiquement."
  journal "Pour le relancer une fois corrigé : $DOSSIER/surveiller-tags.sh $TAG"
  exit 1
}

backend_repond() {
  local _
  for _ in $(seq 1 60); do
    if compose exec -T frontend wget -qO- http://backend:8080/actuator/health 2>/dev/null | grep -q '"UP"'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# ---------------------------------------------------------------------------
#  1. Construction, avant de toucher à quoi que ce soit.
# ---------------------------------------------------------------------------
git -C "$DEPOT" checkout -q --detach "$TAG"
journal "Construction des images $TAG"
if ! VERSION="$TAG" compose build --pull backend frontend >> "$DOSSIER/journal.log" 2>&1; then
  [[ -n "$en_ligne" ]] && git -C "$DEPOT" checkout -q --detach "$en_ligne"
  echec "la construction a échoué, la version en ligne n'a pas été touchée."
fi

# ---------------------------------------------------------------------------
#  2. Images de la version en ligne mises de côté pour un retour arrière.
# ---------------------------------------------------------------------------
SECOURS="avant-$TAG"
secours_ok=true
for service in backend frontend; do
  conteneur="$(compose ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$conteneur" ]]; then secours_ok=false; continue; fi
  image="$(docker inspect -f '{{.Image}}' "$conteneur")"
  docker tag "$image" "ghcr.io/dimkahn/suivi-plongee-$service:$SECOURS"
done
$secours_ok && journal "Version en ligne gardée sous le tag d'image $SECOURS" \
            || journal "Pas de version en ligne complète : premier déploiement, pas de retour arrière possible."

# ---------------------------------------------------------------------------
#  3. Sauvegarde de la base.
# ---------------------------------------------------------------------------
sauvegarde=""
if [[ -n "$(compose ps -q db 2>/dev/null)" ]]; then
  sauvegarde="$DOSSIER/sauvegardes/avant-$TAG-$(date +%F-%H%M).sql.gz"
  journal "Sauvegarde de la base dans $sauvegarde"
  if ! compose exec -T db pg_dump -U plongee plongee | gzip > "$sauvegarde" \
     || ! gzip -t "$sauvegarde" || [[ $(gunzip -c "$sauvegarde" | head -c 1000 | wc -c) -lt 1000 ]]; then
    rm -f "$sauvegarde"
    [[ -n "$en_ligne" ]] && git -C "$DEPOT" checkout -q --detach "$en_ligne"
    echec "la sauvegarde de la base a échoué, déploiement abandonné avant tout redémarrage."
  fi
  ls -1t "$DOSSIER"/sauvegardes/avant-*.sql.gz | tail -n +$((SAUVEGARDES_GARDEES + 1)) | xargs -r rm --
else
  journal "Base pas encore démarrée : pas de sauvegarde."
fi

# ---------------------------------------------------------------------------
#  4. Démarrage de toute la prod sur la nouvelle version.
# ---------------------------------------------------------------------------
journal "Démarrage de $TAG"
VERSION="$TAG" compose up -d --no-build --remove-orphans >> "$DOSSIER/journal.log" 2>&1 || true

if backend_repond; then
  echo "$TAG" > "$DOSSIER/version-en-ligne"
  journal "Version $TAG en ligne."

  # Ménage : les VERSIONS_GARDEES dernières versions déployées et le dernier
  # jeu d'images « avant-… » restent disponibles pour un retour arrière.
  for depot_image in "${IMAGES[@]}"; do
    docker image ls "$depot_image" --format '{{.Tag}}' | grep '^v' | sort -Vr \
      | tail -n +$((VERSIONS_GARDEES + 1)) | sed "s|^|$depot_image:|" | xargs -r docker rmi > /dev/null 2>&1 || true
    docker image ls "$depot_image" --format '{{.Tag}}' | grep '^avant-' | grep -vxF "$SECOURS" \
      | sed "s|^|$depot_image:|" | xargs -r docker rmi > /dev/null 2>&1 || true
  done
  docker image prune -f > /dev/null
  exit 0
fi

# ---------------------------------------------------------------------------
#  5. Retour arrière : base d'avant le déploiement, images d'avant.
# ---------------------------------------------------------------------------
journal "Le backend ne répond pas après 5 minutes. Derniers journaux :"
compose logs --tail 80 backend >> "$DOSSIER/journal.log" 2>&1 || true

if ! $secours_ok; then
  echec "pas de version précédente à remettre en ligne ; voir les journaux ci-dessus."
fi

journal "Retour arrière vers la version précédente (${en_ligne:-images $SECOURS})"
compose stop backend >> "$DOSSIER/journal.log" 2>&1 || true
# Le fichier compose de la version précédente, si on la connaît.
[[ -n "$en_ligne" ]] && git -C "$DEPOT" checkout -q --detach "$en_ligne"

if [[ -n "$sauvegarde" ]]; then
  # Une migration Flyway a pu passer : on revient au schéma d'avant. Aucune
  # saisie n'est perdue, le backend n'a jamais répondu depuis la sauvegarde.
  journal "Restauration de $sauvegarde"
  compose exec -T db psql -q -U plongee -d plongee \
    -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >> "$DOSSIER/journal.log" 2>&1 \
    || journal "Attention : la base n'a pas pu être vidée avant restauration."
  gunzip -c "$sauvegarde" | compose exec -T db psql -q -U plongee -d plongee >> "$DOSSIER/journal.log" 2>&1 \
    || journal "Attention : la restauration a signalé des erreurs, voir ci-dessus."
fi

VERSION="$SECOURS" compose up -d --no-build --remove-orphans >> "$DOSSIER/journal.log" 2>&1 || true
if backend_repond; then
  journal "Version précédente remise en ligne."
  echec "$TAG n'a pas démarré ; la prod tourne sur la version précédente."
fi
echec "$TAG n'a pas démarré ET la version précédente non plus : intervention manuelle nécessaire (voir DEPLOIEMENT.md, « Revenir en arrière »)."
