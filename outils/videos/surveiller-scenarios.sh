#!/usr/bin/env bash
# Tournage et publication automatiques des vidéos d'aide.
#
# Lancé toutes les 5 minutes par cron sur la machine de production. À chaque
# passage : se place sur la version en ligne de l'appli (celle déployée par
# outils/surveiller-tags.sh), cherche les scénarios de outils/videos/scenarios/
# nouveaux ou modifiés depuis leur dernier tournage, et s'il y en a :
#   1. les tourne avec tourner.sh (backend dev neuf, voix off, MP4) ;
#   2. les publie avec publier.sh (dossier servi par Caddy sous /medias/videos/).
#
# Les vidéos suivent la version en ligne, pas master : un scénario poussé sans
# tag attend le prochain déploiement, et la vidéo montre ce que voient les
# utilisateurs.
#
# Un scénario est reconnu à l'empreinte (sha256) de son fichier : en modifier
# un le fait retourner. Trois scénarios en suivent un autre (voir LISEZ-MOI.md,
# « Pour retourner une vidéo ») : leur prédécesseur est retourné avec eux.
# Un scénario qui échoue est noté en échec et n'est retenté que quand son
# fichier change. Si le tournage échoue sans qu'aucun scénario soit en cause
# (backend qui ne démarre pas…), on attend une heure avant de retenter.
#
# Tout vit dans un dossier à part (~/suivi-plongee-videos par défaut), jamais
# dans le dossier de développement :
#   depot/          clone du dépôt ; vidéos tournées dans depot/outils/videos/sorties/
#   empreintes      « nom empreinte » des scénarios tournés
#   echecs          « nom empreinte » des scénarios en échec
#   journal.log     ce qui s'est passé, horodaté ; tournage.log : le dernier tournage
#
# Usage :
#   outils/videos/surveiller-scenarios.sh --installer   première mise en place + cron
#   surveiller-scenarios.sh                             un passage (ce que lance cron)
#   surveiller-scenarios.sh D10 M03                     retourner et publier ceux-là
#                                                       tout de suite, même en échec
#
# Le tournage occupe les ports 8080 et 4200 de l'hôte : si l'un d'eux est déjà
# pris (un développeur au travail sur la machine), le passage est remis à plus tard.
set -euo pipefail

DOSSIER="${DOSSIER_VIDEOS:-$HOME/suivi-plongee-videos}"
DEPOT="$DOSSIER/depot"
DEPOT_DISTANT="git@github.com-dimkahn:dimkahn/suivi-plongee.git"
DEPLOIEMENT="${DOSSIER_DEPLOIEMENT:-$HOME/suivi-plongee-deploiement}"
PAUSE_APRES_PANNE=3600

# Scénario → celui qu'il suit sur les mêmes données (LISEZ-MOI.md).
declare -A PREALABLE=(
  [A07]=A06   # A7 inscrit l'élève créé par A6
  [D07]=D06   # D7 rend le prêt photographié par D6
  [D08]=D02   # D8 prête le bloc ajouté par D2
)

journal() { echo "$(date '+%F %T') $*" >> "$DOSSIER/journal.log"; }
# Même message qu'au passage précédent : pas besoin de le répéter toutes les 5 minutes.
journal_une_fois() {
  [[ "$(tail -n 1 "$DOSSIER/journal.log" 2>/dev/null | cut -d' ' -f3-)" == "$*" ]] || journal "$*"
}

# ---------------------------------------------------------------------------
#  Installation : clone, vidéos déjà tournées, environnement, copie, cron.
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--installer" ]]; then
  ICI="$(cd "$(dirname "$0")" && pwd)"
  mkdir -p "$DOSSIER"
  [[ -d "$DEPOT/.git" ]] || git clone -q "$DEPOT_DISTANT" "$DEPOT"

  # cron n'a qu'un PATH minimal : on garde celui de l'installation (node par
  # nvm, mvn, java par sdkman…).
  for outil in mvn npm node java curl ffmpeg; do
    command -v "$outil" > /dev/null || echo "Attention : $outil introuvable dans le PATH." >&2
  done
  {
    printf 'export PATH=%q\n' "$PATH"
    [[ -n "${JAVA_HOME:-}" ]] && printf 'export JAVA_HOME=%q\n' "$JAVA_HOME"
    [[ -n "${FFMPEG:-}" ]] && printf 'export FFMPEG=%q\n' "$FFMPEG"
  } > "$DOSSIER/environnement"

  # Les vidéos déjà tournées dans ce dépôt-ci servent de point de départ :
  # publier.sh recopie tout le dossier, il ne doit pas en manquer.
  touch "$DOSSIER/empreintes" "$DOSSIER/echecs"
  if [[ -d "$ICI/sorties" && ! -e "$DEPOT/outils/videos/sorties" ]]; then
    rsync -a --exclude='*.log' --exclude='*-ECHEC.png' --exclude='.*' \
      "$ICI/sorties/" "$DEPOT/outils/videos/sorties/"
    for f in "$ICI"/scenarios/*.mjs; do
      nom="$(basename "$f" .mjs)"
      [[ -f "$ICI/sorties/$nom.webm" ]] || continue
      echo "$nom $(sha256sum < "$f" | cut -d' ' -f1)" >> "$DOSSIER/empreintes"
    done
    echo "Vidéos déjà tournées reprises de $ICI/sorties."
  fi

  # Le script tourne depuis sa copie : un checkout du dépôt pendant qu'il
  # s'exécute ne doit pas le modifier sous ses pieds.
  install -m 755 "$0" "$DOSSIER/surveiller-scenarios.sh"
  ligne="*/5 * * * * $DOSSIER/surveiller-scenarios.sh >> $DOSSIER/cron.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v 'surveiller-scenarios.sh' || true; echo "$ligne" ) | crontab -
  echo "Installé dans $DOSSIER. Tâche cron :"
  echo "  $ligne"
  exit 0
fi

[[ -d "$DEPOT/.git" ]] || { echo "Lancer d'abord : outils/videos/surveiller-scenarios.sh --installer" >&2; exit 1; }
# shellcheck source=/dev/null
source "$DOSSIER/environnement"

# Un seul passage à la fois : un tournage dure de quelques minutes à une demi-heure.
exec 9> "$DOSSIER/.verrou"
flock -n 9 || exit 0

FORCES=("$@")
if [[ ${#FORCES[@]} -eq 0 && -f "$DOSSIER/pause-jusqu-a" ]]; then
  (( $(date +%s) < $(cat "$DOSSIER/pause-jusqu-a") )) && exit 0
  rm -f "$DOSSIER/pause-jusqu-a"
fi

# ---------------------------------------------------------------------------
#  Version à filmer : celle en ligne.
# ---------------------------------------------------------------------------
git -C "$DEPOT" fetch -q --tags --force --prune origin
VERSION="$(cat "$DEPLOIEMENT/version-en-ligne" 2>/dev/null || true)"
[[ -n "$VERSION" ]] || VERSION="$(git -C "$DEPOT" tag --merged origin/master --list 'v*' --sort=-v:refname | head -n 1)"
[[ -n "$VERSION" ]] || { journal_une_fois "Aucune version en ligne ni tag v… : rien à filmer."; exit 0; }
# --force : le tournage réécrit SCENARIOS.md, versionné.
git -C "$DEPOT" checkout -q --force --detach "$VERSION"

VIDEOS="$DEPOT/outils/videos"
SORTIES="$VIDEOS/sorties"
touch "$DOSSIER/empreintes" "$DOSSIER/echecs"

empreinte() { sha256sum < "$VIDEOS/scenarios/$1.mjs" | cut -d' ' -f1; }
# Nom de fichier (sans .mjs) d'un identifiant de scénario (D10 → D10-fiche-…).
nom_de() {
  local f
  for f in "$VIDEOS"/scenarios/"$1"-*.mjs; do [[ -f "$f" ]] && basename "$f" .mjs; done
  return 0
}

# ---------------------------------------------------------------------------
#  Scénarios à tourner.
# ---------------------------------------------------------------------------
declare -A A_TOURNER=()
if [[ ${#FORCES[@]} -gt 0 ]]; then
  for id in "${FORCES[@]}"; do
    nom="$(nom_de "${id^^}")"
    [[ -n "$nom" ]] || { journal "Scénario ${id^^} inconnu dans $VERSION."; exit 1; }
    A_TOURNER[$nom]=1
  done
else
  for f in "$VIDEOS"/scenarios/*.mjs; do
    nom="$(basename "$f" .mjs)"
    ligne="$nom $(empreinte "$nom")"
    grep -qxF "$ligne" "$DOSSIER/empreintes" && continue
    grep -qxF "$ligne" "$DOSSIER/echecs" && continue
    A_TOURNER[$nom]=1
  done
fi
[[ ${#A_TOURNER[@]} -gt 0 ]] || exit 0

for nom in "${!A_TOURNER[@]}"; do
  prealable="${PREALABLE[${nom%%-*}]:-}"
  [[ -n "$prealable" ]] && A_TOURNER[$(nom_de "$prealable")]=1
done
mapfile -t NOMS < <(printf '%s\n' "${!A_TOURNER[@]}" | sort)

port_pris() { [[ "$(curl -s -o /dev/null -w '%{http_code}' "$1" || true)" != "000" ]]; }
if port_pris http://localhost:8080/ || port_pris http://localhost:4200/; then
  journal_une_fois "À tourner : ${NOMS[*]%%-*}. Ports 8080 ou 4200 occupés, on retentera."
  exit 0
fi

# ---------------------------------------------------------------------------
#  Dépendances npm : réinstallées quand le package-lock.json a changé
#  (tourner.sh ne les installe que si node_modules manque).
# ---------------------------------------------------------------------------
dependances_a_jour() {
  local dossier="$1" etat="$DOSSIER/.npm-$2" actuel
  actuel="$(sha256sum < "$dossier/package-lock.json" | cut -d' ' -f1)"
  if [[ "$(cat "$etat" 2>/dev/null)" != "$actuel" ]]; then
    rm -rf "$dossier/node_modules"
    echo "$actuel" > "$etat"
  fi
}
dependances_a_jour "$DEPOT/frontend" frontend
dependances_a_jour "$VIDEOS" videos

# ---------------------------------------------------------------------------
#  1. Tournage.
# ---------------------------------------------------------------------------
journal "=== Tournage de ${NOMS[*]%%-*} ($VERSION) ==="
repere="$DOSSIER/.debut-tournage"
touch "$repere"
resultat=0
"$VIDEOS/tourner.sh" "${NOMS[@]}" > "$DOSSIER/tournage.log" 2>&1 || resultat=$?

reussis=() ; rates=()
for nom in "${NOMS[@]}"; do
  ligne="$nom $(empreinte "$nom")"
  if [[ "$SORTIES/$nom.webm" -nt "$repere" && "$SORTIES/$nom.mp4" -nt "$SORTIES/$nom.webm" ]]; then
    reussis+=("$nom")
    grep -v "^$nom " "$DOSSIER/empreintes" > "$DOSSIER/empreintes.tmp" || true
    echo "$ligne" >> "$DOSSIER/empreintes.tmp"
    mv "$DOSSIER/empreintes.tmp" "$DOSSIER/empreintes"
    grep -v "^$nom " "$DOSSIER/echecs" > "$DOSSIER/echecs.tmp" || true
    mv "$DOSSIER/echecs.tmp" "$DOSSIER/echecs"
  elif [[ -f "$SORTIES/$nom-ECHEC.png" && "$SORTIES/$nom-ECHEC.png" -nt "$repere" ]]; then
    rates+=("$nom")
    grep -qxF "$ligne" "$DOSSIER/echecs" || echo "$ligne" >> "$DOSSIER/echecs"
  fi
done

[[ ${#rates[@]} -eq 0 ]] || journal "ÉCHEC de ${rates[*]%%-*} : écran au moment du problème dans $SORTIES/<nom>-ECHEC.png, détails dans $DOSSIER/tournage.log. Pas retentés tant que leur fichier ne change pas."

if [[ ${#reussis[@]} -eq 0 ]]; then
  if [[ ${#rates[@]} -eq 0 ]]; then
    echo $(( $(date +%s) + PAUSE_APRES_PANNE )) > "$DOSSIER/pause-jusqu-a"
    journal "Le tournage n'a pas abouti (code $resultat) sans qu'un scénario soit en cause : voir $DOSSIER/tournage.log. Nouvel essai dans une heure."
  fi
  exit 1
fi
journal "Tournés : ${reussis[*]%%-*}."

# ---------------------------------------------------------------------------
#  2. Publication.
# ---------------------------------------------------------------------------
if DOSSIER_DEPLOIEMENT="$DEPLOIEMENT" "$VIDEOS/publier.sh" >> "$DOSSIER/journal.log" 2>&1; then
  journal "Publiés."
else
  journal "ÉCHEC de la publication, voir ci-dessus. Les vidéos restent dans $SORTIES : relancer $VIDEOS/publier.sh."
  exit 1
fi
