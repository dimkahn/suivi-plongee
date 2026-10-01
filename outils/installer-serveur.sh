#!/usr/bin/env bash
# Installe tout ce qu'il faut pour faire tourner l'application sur un serveur
# Ubuntu (ou Debian) neuf : c'est DEPLOIEMENT.md, étapes 2 à 6, en un script.
#
#   1. paquets système (git, curl, openssl, htpasswd, cron…) et Docker ;
#   2. pare-feu de la machine : ports 80 et 443 ouverts ;
#   3. fichier .env : questions sur le domaine et l'envoi d'e-mails, mots de
#      passe de la base et secret JWT générés ;
#   4. démarrage de l'application (base, backend, frontend, Caddy et HTTPS) ;
#   5. premier compte administrateur, si la base n'en a pas ;
#   6. au choix : déploiement automatique sur les tags v… (surveiller-tags.sh) ;
#   7. au choix : outils de tournage des vidéos d'aide (Java, Maven, Node,
#      Chromium, ffmpeg, pip).
#
# À lancer depuis un clone du dépôt, avec un utilisateur qui a sudo (pas root) :
#
#   git clone https://github.com/dimkahn/suivi-plongee.git
#   cd suivi-plongee
#   outils/installer-serveur.sh
#
# Peut être relancé sans risque : chaque étape déjà faite est sautée (le .env
# existant est gardé, le compte admin n'est créé que s'il n'y en a aucun).
# Reste à faire à la main : la VM, le nom de domaine qui pointe vers elle, et
# le pare-feu côté hébergeur (Oracle Cloud : « Security List », ports 80/443).
set -euo pipefail

DEPOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJET=suivi-plongee
cd "$DEPOT"

etape() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
echec() { printf '\nÉchec : %s\n' "$*" >&2; exit 1; }

# Question avec valeur par défaut : demander "Texte" "défaut" → réponse sur stdout.
demander() {
  local reponse
  read -r -p "    $1${2:+ [$2]} : " reponse < /dev/tty
  printf '%s' "${reponse:-$2}"
}
# Oui/non, non par défaut.
oui() {
  local reponse
  read -r -p "    $1 [o/N] : " reponse < /dev/tty
  [[ "$reponse" =~ ^[oOyY] ]]
}
# Docker sans sudo si l'utilisateur est déjà dans le groupe docker, avec sinon
# (juste après l'installation, le groupe ne vaut qu'à la prochaine connexion).
docker_() { if docker info > /dev/null 2>&1; then docker "$@"; else sudo docker "$@"; fi; }
compose() { docker_ compose -p "$PROJET" -f "$DEPOT/docker-compose.prod.yml" --project-directory "$DEPOT" "$@"; }

[[ $EUID -ne 0 ]] || echec "lancer ce script avec votre utilisateur habituel, pas root (il demande sudo quand il faut)."
command -v apt-get > /dev/null || echec "ce script est écrit pour Ubuntu ou Debian (apt-get introuvable)."
[[ -f docker-compose.prod.yml && -f .env.example ]] || echec "lancer le script depuis un clone complet du dépôt."

# ---------------------------------------------------------------------------
etape "1. Paquets système et Docker"
# ---------------------------------------------------------------------------
sudo apt-get update -qq
# apache2-utils : htpasswd, pour le mot de passe du premier compte admin.
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  git curl ca-certificates openssl apache2-utils cron > /dev/null
if command -v docker > /dev/null; then
  info "Docker déjà installé ($(docker --version 2>/dev/null || sudo docker --version))."
else
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo systemctl enable --now docker > /dev/null 2>&1 || true
if ! id -nG "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  info "$USER ajouté au groupe docker (valable à la prochaine connexion SSH)."
fi

# ---------------------------------------------------------------------------
etape "2. Pare-feu de la machine (ports 80 et 443)"
# ---------------------------------------------------------------------------
if command -v ufw > /dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 80/tcp > /dev/null
  sudo ufw allow 443/tcp > /dev/null
  info "ufw : 80 et 443 autorisés."
fi
# Images Oracle Cloud : iptables refuse tout par défaut, sauf SSH.
if command -v iptables > /dev/null && sudo iptables -S INPUT 2>/dev/null | grep -q -- '-j REJECT'; then
  for port in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
      || sudo iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
  done
  if command -v netfilter-persistent > /dev/null; then
    sudo netfilter-persistent save > /dev/null 2>&1
  else
    sudo mkdir -p /etc/iptables && sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
  fi
  info "iptables : 80 et 443 autorisés, règles enregistrées."
fi
info "Pensez au pare-feu de l'hébergeur (Oracle : Security List), voir DEPLOIEMENT.md étape 2."

# ---------------------------------------------------------------------------
etape "3. Configuration (.env)"
# ---------------------------------------------------------------------------
if [[ -f .env ]]; then
  info ".env déjà présent : gardé tel quel."
else
  info "Le nom de domaine doit déjà pointer vers l'adresse IP de cette machine (DEPLOIEMENT.md étape 3)."
  DOMAINE="$(demander "Nom de domaine (ex. suivi-cppjvo.duckdns.org)" "")"
  [[ -n "$DOMAINE" ]] || echec "le nom de domaine est obligatoire (certificat HTTPS)."
  CLUB_NOM="$(demander "Nom du club (en-tête de la fiche de sécurité)" "")"
  echo
  info "Envoi des e-mails (invitations des moniteurs, mots de passe oubliés)."
  info "Avec Gmail : un « mot de passe d'application », pas le mot de passe du compte."
  SMTP_HOTE="$(demander "Serveur SMTP" "smtp.gmail.com")"
  SMTP_UTILISATEUR="$(demander "Utilisateur SMTP (adresse e-mail)" "")"
  read -r -s -p "    Mot de passe SMTP : " SMTP_MOT_DE_PASSE < /dev/tty; echo
  [[ -n "$SMTP_UTILISATEUR" && -n "$SMTP_MOT_DE_PASSE" ]] \
    || echec "l'utilisateur et le mot de passe SMTP sont obligatoires (le backend ne démarre pas sans)."
  # Gmail affiche le mot de passe d'application par groupes de 4, espaces compris.
  [[ "$SMTP_HOTE" == *gmail* ]] && SMTP_MOT_DE_PASSE="${SMTP_MOT_DE_PASSE// /}"
  MAIL_EXPEDITEUR="$(demander "Expéditeur affiché" "${CLUB_NOM:-Club de plongée} <$SMTP_UTILISATEUR>")"
  # Hexadécimal : aucun caractère qui gêne dans une URL JDBC ou un shell.
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  export DOMAINE CLUB_NOM SMTP_HOTE SMTP_UTILISATEUR SMTP_MOT_DE_PASSE MAIL_EXPEDITEUR DB_PASSWORD JWT_SECRET
  # Remplit les lignes « CLE= » de .env.example, commentaires compris gardés.
  # ENVIRON plutôt que sed : les valeurs peuvent contenir / & ou espaces.
  # Entre apostrophes dès qu'un caractère sort de l'ordinaire : docker
  # compose les lit telles quelles (pas d'interprétation de $).
  umask 077
  awk -F= '
    /^[A-Z_]+=/ && ($1 in ENVIRON) && ENVIRON[$1] != "" {
      v = ENVIRON[$1]
      if (v !~ /^[A-Za-z0-9@._\/+=:-]+$/) {
        if (index(v, "\047")) { print "apostrophe interdite dans " $1 > "/dev/stderr"; exit 1 }
        v = "\047" v "\047"
      }
      print $1 "=" v; next
    }
    { print }' .env.example > .env || { rm -f .env; echec "valeur refusée (voir ci-dessus), relancer le script."; }
  umask 022
  info ".env écrit (lisible par vous seul). DB_PASSWORD et JWT_SECRET générés :"
  info "gardez une copie de .env en lieu sûr, hors de la machine."
fi
DOMAINE="$(grep -E '^DOMAINE=' .env | cut -d= -f2- | tr -d '"')"

# Le domaine pointe-t-il bien ici ? Avertissement seulement.
ip_publique="$(curl -fsS --max-time 5 https://api.ipify.org || true)"
ip_domaine="$(getent ahostsv4 "$DOMAINE" 2>/dev/null | awk 'NR==1 { print $1 }' || true)"
if [[ -n "$ip_publique" && "$ip_domaine" != "$ip_publique" ]]; then
  info "Attention : $DOMAINE pointe vers « ${ip_domaine:-rien} », cette machine est $ip_publique."
  info "Caddy n'obtiendra pas de certificat HTTPS tant que ce n'est pas corrigé."
fi

# ---------------------------------------------------------------------------
etape "4. Démarrage de l'application"
# ---------------------------------------------------------------------------
# Construire sur place demande plusieurs Go de mémoire ; en dessous, on prend
# les images du dernier tag publiées par GitHub Actions (outils/deployer.sh).
memoire_mo=$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
git fetch -q --tags || true
dernier_tag="$(git tag --list 'v*' --sort=-creatordate | head -1)"
if [[ -n "$(compose ps -q backend 2>/dev/null)" ]]; then
  # Déjà en place (relance du script, ou prod tenue par surveiller-tags.sh) :
  # ne rien reconstruire depuis ce clone, qui peut être en retard.
  info "L'application tourne déjà : laissée telle quelle."
elif [[ "$memoire_mo" -lt 3500 && -n "$dernier_tag" ]] \
   && VERSION="$dernier_tag" compose pull -q backend frontend; then
  info "Machine de ${memoire_mo} Mo : images $dernier_tag téléchargées, pas de construction."
  export VERSION="$dernier_tag"
  compose up -d --no-build --remove-orphans
else
  info "Construction des images sur place (une dizaine de minutes la première fois)…"
  compose up -d --build --remove-orphans
fi

info "Attente du backend (migrations de la base au premier démarrage)…"
pret=""
for _ in $(seq 1 60); do
  if compose exec -T frontend wget -qO- http://backend:8080/actuator/health 2>/dev/null | grep -q '"UP"'; then
    pret=1; break
  fi
  sleep 5
done
if [[ -z "$pret" ]]; then
  compose logs --tail 60 backend >&2
  echec "le backend ne répond pas après 5 minutes (journaux ci-dessus)."
fi
info "Application en ligne : https://$DOMAINE"

# ---------------------------------------------------------------------------
etape "5. Premier compte administrateur"
# ---------------------------------------------------------------------------
sql() { compose exec -T db psql -U plongee -d plongee -v ON_ERROR_STOP=1 -qtA "$@"; }
if [[ "$(sql -c "SELECT count(*) FROM utilisateur_role WHERE role = 'ADMIN'")" != "0" ]]; then
  info "Un compte administrateur existe déjà."
else
  info "La base est vide : création du compte qui ouvrira l'administration."
  email="$(demander "Adresse e-mail (identifiant de connexion)" "")"
  prenom="$(demander "Prénom" "")"
  nom="$(demander "Nom" "")"
  niveau="$(demander "Niveau d'encadrement (E1 à E4, vide si non encadrant)" "")"
  [[ -n "$email" && -n "$prenom" && -n "$nom" ]] || echec "e-mail, prénom et nom sont obligatoires."
  [[ -z "$niveau" || "$niveau" =~ ^E[1-4]$ ]] || echec "niveau d'encadrement : E1, E2, E3, E4 ou vide."
  while true; do
    read -r -s -p "    Mot de passe (10 caractères au moins) : " mdp < /dev/tty; echo
    read -r -s -p "    Le même, encore une fois : " mdp2 < /dev/tty; echo
    [[ "$mdp" == "$mdp2" ]] || { info "Les deux saisies diffèrent."; continue; }
    [[ ${#mdp} -ge 10 ]] || { info "Trop court."; continue; }
    break
  done
  # Haché en bcrypt (accepté par Spring Security) ; mot de passe lu sur
  # l'entrée standard, jamais sur la ligne de commande.
  hache="$(printf '%s' "$mdp" | htpasswd -inBC 12 "" | cut -d: -f2)"
  unset mdp mdp2
  # Variables psql (:'nom') : aucune valeur n'est collée dans le SQL.
  sql -v email="$email" -v prenom="$prenom" -v nom="$nom" -v hache="$hache" -v niveau="$niveau" <<'SQL'
WITH u AS (
  INSERT INTO utilisateur (email, nom, prenom, mot_de_passe, actif, niveau_encadrement)
  VALUES (:'email', :'nom', :'prenom', :'hache', TRUE, NULLIF(:'niveau', ''))
  RETURNING id
)
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT u.id, r.role FROM u, (VALUES ('ADMIN'), ('MONITEUR')) AS r(role);
SQL
  info "Compte $email créé (ADMIN et MONITEUR). Les autres comptes se créent depuis l'administration."
fi

# ---------------------------------------------------------------------------
etape "6. Déploiement automatique (facultatif)"
# ---------------------------------------------------------------------------
info "Chaque tag v… posé sur master serait déployé ici dans les 5 minutes,"
info "avec sauvegarde de la base et retour arrière automatique (DEPLOIEMENT.md)."
info "Il faut une clé SSH GitHub sans phrase de passe et plusieurs Go de mémoire."
if oui "Installer le déploiement automatique ?"; then
  # surveiller-tags.sh clone git@github.com-dimkahn:… : cet alias doit mener
  # à GitHub avec une clé sans phrase de passe (cron n'a pas d'agent SSH).
  if ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@github.com-dimkahn 2>&1 \
       | grep -q "successfully authenticated"; then
    outils/surveiller-tags.sh --installer
  else
    info "GitHub injoignable en SSH par l'alias « github.com-dimkahn ». À faire d'abord :"
    info "  ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_github"
    info "  ajouter ~/.ssh/id_github.pub dans GitHub (dépôt → Settings → Deploy keys) ;"
    info "  dans ~/.ssh/config :"
    info "    Host github.com-dimkahn"
    info "      HostName github.com"
    info "      User git"
    info "      IdentityFile ~/.ssh/id_github"
    info "puis : outils/surveiller-tags.sh --installer"
  fi
else
  info "Passé. Pour plus tard : outils/surveiller-tags.sh --installer"
fi

# ---------------------------------------------------------------------------
etape "7. Outils de tournage des vidéos d'aide (facultatif)"
# ---------------------------------------------------------------------------
info "Seulement pour tourner les vidéos sur cette machine (outils/videos/tourner.sh) :"
info "Java 25, Maven, Node 22, Chromium et ses bibliothèques, ffmpeg, pip (voix off)."
if oui "Installer les outils de tournage ?"; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg python3-pip maven wget gpg > /dev/null
  if ! java -version 2>&1 | grep -q 'version "25'; then
    # Temurin (Adoptium), comme les images Docker du backend.
    wget -qO- https://packages.adoptium.net/artifactory/api/gpg/key/public \
      | sudo gpg --dearmor --yes -o /usr/share/keyrings/adoptium.gpg
    echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(. /etc/os-release && echo "$VERSION_CODENAME") main" \
      | sudo tee /etc/apt/sources.list.d/adoptium.list > /dev/null
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq temurin-25-jdk > /dev/null
  fi
  if ! node --version 2>/dev/null | grep -q '^v2[2-9]'; then
    # Node 22, comme l'image Docker du frontend.
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs > /dev/null
  fi
  (cd outils/videos && npm ci --no-audit --no-fund > /dev/null && sudo npx playwright install-deps chromium > /dev/null)
  info "Prêt : $(java -version 2>&1 | head -1), Maven $(mvn -v 2>/dev/null | head -1 | awk '{ print $3 }'), Node $(node --version)."
  info "Piper (voix off) s'installe au premier outils/videos/tourner.sh."
else
  info "Passé."
fi

etape "Terminé"
info "Application : https://$DOMAINE"
info "Journaux : docker compose -p $PROJET -f docker-compose.prod.yml logs -f backend"
id -nG "$USER" | grep -qw docker && docker info > /dev/null 2>&1 \
  || info "Reconnectez-vous en SSH pour utiliser docker sans sudo."
