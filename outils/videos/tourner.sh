#!/usr/bin/env bash
# Tourne les vidéos explicatives d'un seul coup, sur des données neuves.
#
#   1. démarre un backend neuf en profil dev (base H2 en mémoire, données
#      de démonstration V100…V107) : chaque tournage part des mêmes données ;
#   2. démarre le frontend, sauf s'il tourne déjà sur le port 4200 ;
#   3. installe Playwright et Chromium la première fois ;
#   4. dépose les portraits dessinés (preparer-donnees.mjs) ;
#   5. enregistre les vidéos (enregistrer.mjs) dans outils/videos/sorties/ ;
#   6. monte la voix off (chaque sous-titre lu par Piper, installé la
#      première fois dans .piper/) et convertit chaque vidéo en MP4, si
#      ffmpeg est installé (ou désigné par la variable FFMPEG) : l'iPhone
#      lit le MP4 plus sûrement que le WebM. VOIX=0 : vidéos muettes ;
#   7. arrête ce qu'il a démarré, même en cas d'échec ou de Ctrl+C.
#
# Usage, depuis n'importe où :
#   outils/videos/tourner.sh              toutes les vidéos
#   outils/videos/tourner.sh M03 M04      seulement celles-là
#   RYTHME=1.5 outils/videos/tourner.sh   pauses 50 % plus longues
#   RYTHME_CLIC=2 outils/videos/tourner.sh  touchers deux fois plus lents, le reste inchangé
#   VOIX=0 outils/videos/tourner.sh       sans voix off (sous-titres à la place)
#   SOUS_TITRES=1 outils/videos/tourner.sh  voix off et sous-titres
#
# Un backend qui tourne déjà sur le port 8080 est refusé : ses données ont
# pu être modifiées (notes, présences…) et les vidéos ne montreraient plus
# la même chose. L'arrêter d'abord.
set -euo pipefail

VIDEOS="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$VIDEOS/../.." && pwd)"
SORTIES="$VIDEOS/sorties"
API=http://localhost:8080
APPLI=http://localhost:4200

PID_BACKEND=""
PID_FRONTEND=""

etape() { printf '\n==> %s\n' "$*"; }
echec() { printf '\nÉchec : %s\n' "$*" >&2; exit 1; }

# Vrai si l'adresse répond (n'importe quel code HTTP).
repond() { [ "$(curl -s -o /dev/null -w '%{http_code}' "$1" || true)" != "000" ]; }

# Attend qu'une adresse réponde ; abandonne si le processus meurt ou après le délai.
attendre() {
  local url="$1" pid="$2" delai="$3" journal="$4" i
  for ((i = 0; i < delai; i += 2)); do
    repond "$url" && return 0
    kill -0 "$pid" 2>/dev/null || echec "arrêté au démarrage, voir $journal"
    sleep 2
  done
  echec "ne répond toujours pas après ${delai} s, voir $journal"
}

# Lancés avec setsid : chacun a son propre groupe de processus, qu'on arrête
# en entier (mvn lance une JVM à part, npm lance ng serve).
arreter() {
  local pid
  for pid in "$PID_FRONTEND" "$PID_BACKEND"; do
    [ -n "$pid" ] && kill -- "-$pid" 2>/dev/null || true
  done
}
trap arreter EXIT

command -v mvn >/dev/null || echec "mvn introuvable dans le PATH."
command -v npm >/dev/null || echec "npm introuvable dans le PATH."
command -v curl >/dev/null || echec "curl introuvable dans le PATH."
mkdir -p "$SORTIES"

etape "Backend neuf (profil dev, données de démonstration)"
repond "$API/api-docs" && echec "un backend tourne déjà sur le port 8080. L'arrêter pour repartir de données neuves."
setsid mvn -q -f "$RACINE/backend/pom.xml" spring-boot:run > "$SORTIES/backend.log" 2>&1 < /dev/null &
PID_BACKEND=$!
attendre "$API/api-docs" "$PID_BACKEND" 300 "outils/videos/sorties/backend.log"
echo "Backend prêt."

etape "Frontend"
if repond "$APPLI"; then
  echo "Déjà lancé sur le port 4200 : on le réutilise."
else
  [ -d "$RACINE/frontend/node_modules" ] || (cd "$RACINE/frontend" && npm ci)
  (cd "$RACINE/frontend" && exec setsid npm start > "$SORTIES/frontend.log" 2>&1 < /dev/null) &
  PID_FRONTEND=$!
  attendre "$APPLI" "$PID_FRONTEND" 300 "outils/videos/sorties/frontend.log"
  echo "Frontend prêt."
fi

etape "Outils d'enregistrement"
cd "$VIDEOS"
[ -d node_modules/playwright ] || npm ci --no-audit --no-fund
npx playwright install chromium

etape "Voix off (Piper)"
MODELE_VOIX="${VOIX_MODELE:-fr_FR-siwis-medium}"
if [ "${VOIX:-1}" = "0" ]; then
  echo "VOIX=0 : vidéos muettes."
elif [ -f ".piper/voix/$MODELE_VOIX.onnx" ]; then
  echo "Déjà installée ($MODELE_VOIX)."
else
  # Dans .piper/ du dossier des vidéos, hors dépôt : ni venv ni droits root.
  if python3 -m pip install -q --target .piper piper-tts \
     && PYTHONPATH=.piper python3 -m piper.download_voices --data-dir .piper/voix "$MODELE_VOIX"; then
    echo "Voix $MODELE_VOIX installée."
  else
    echo "Installation de Piper impossible (python3 et pip requis) : vidéos muettes."
  fi
fi

etape "Portraits du trombinoscope"
node preparer-donnees.mjs

etape "Enregistrement"
resultat=0
node enregistrer.mjs "$@" || resultat=$?

FFMPEG="${FFMPEG:-$(command -v ffmpeg || true)}"
if [ -n "$FFMPEG" ]; then
  etape "Montage : voix off et MP4"
  FFMPEG="$FFMPEG" node monter.mjs || resultat=1
  node enregistrer.mjs --catalogue
else
  echo
  echo "ffmpeg absent : vidéos laissées en WebM, sans voix off (sudo apt install ffmpeg)."
fi

[ "$resultat" -eq 0 ] || echec "au moins une vidéo n'a pas pu être enregistrée ou montée (voir sorties/*-ECHEC.png et les messages ci-dessus)."
etape "Terminé : vidéos dans outils/videos/sorties/"
