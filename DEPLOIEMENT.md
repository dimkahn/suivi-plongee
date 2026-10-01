# Déployer gratuitement sur internet

Ce guide met l'application en ligne 24h/24, sans coût, sur une machine
virtuelle **Oracle Cloud Always Free** (offre gratuite à vie, sans limite de
durée — contrairement aux essais gratuits classiques). Ça reste la solution
la plus proche d'une vraie mise en production parmi les options gratuites,
au prix d'un peu d'administration Linux.

Tout le nécessaire est déjà dans le dépôt : `docker-compose.prod.yml`,
`Caddyfile` (HTTPS automatique), `.env.example`. Rien à écrire, seulement à
configurer et lancer.

## 1. Créer la VM

1. Créer un compte sur [cloud.oracle.com](https://www.oracle.com/cloud/free/)
   (carte bancaire demandée pour vérification, jamais débitée sur l'offre
   Always Free).
2. **Compute → Instances → Create instance**.
   - Image : Ubuntu 24.04 (ou 22.04).
   - Shape : `VM.Standard.A1.Flex` (ARM Ampere), **4 OCPU / 24 Go RAM**,
     gratuit à vie. Si la capacité ARM n'est pas disponible dans ta région
     au moment de la création, réessayer plus tard (c'est fréquent et
     temporaire), ou prendre à la place un `VM.Standard.E2.1.Micro` (AMD,
     1 OCPU/1 Go — largement suffisant pour un club).
   - Ajouter ta clé SSH publique (`~/.ssh/id_ed25519.pub` ou équivalent).
3. Noter l'**adresse IP publique** de l'instance (page de détail de
   l'instance). Elle reste fixe tant que l'instance n'est pas supprimée.

## 2. Ouvrir les ports 80 et 443

Deux pare-feux à ouvrir séparément (c'est le piège classique d'Oracle Cloud) :

- **Côté cloud** : `Networking → Virtual Cloud Networks → (ton VCN) →
  Security Lists → Default Security List → Add Ingress Rules` : autoriser
  TCP 80 et TCP 443 depuis `0.0.0.0/0`. Le port 22 (SSH) y est déjà présent.
- **Côté machine** (`iptables`/`netfilter` actif par défaut sur les images
  Oracle) :

  ```bash
  sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save   # ou: sudo iptables-save > /etc/iptables/rules.v4
  ```

Ne jamais ouvrir 5432 (Postgres) ni 8080 (backend) vers l'extérieur : dans
`docker-compose.prod.yml` ils ne sont de toute façon pas publiés, seul Caddy
(80/443) l'est.

## 3. Un nom de domaine (gratuit)

Caddy a besoin d'un vrai nom de domaine pour obtenir un certificat HTTPS
(Let's Encrypt) — une adresse IP nue ne suffit pas.

Le plus simple et gratuit : [DuckDNS](https://www.duckdns.org/) (connexion
via Google/GitHub), créer un sous-domaine du type
`suivi-cppjvo.duckdns.org` et le faire pointer vers l'IP publique de la VM.
Une astuce cron sur la page DuckDNS permet de le garder à jour si l'IP change
un jour.

Si le club possède déjà un nom de domaine (`cppjvo.fr`), un sous-domaine
classique (`suivi.cppjvo.fr` en enregistrement `A` vers l'IP) fonctionne
tout aussi bien.

## En une commande : `outils/installer-serveur.sh`

Une fois la VM créée (étape 1) et le nom de domaine pointé vers elle
(étape 3), le script fait le reste des étapes 2 à 6 : paquets et Docker,
pare-feu de la machine (80/443), `.env` (questions sur le domaine et le
SMTP, mot de passe de la base et secret JWT générés), démarrage, premier
compte administrateur. Il propose ensuite le déploiement automatique
(« Déploiement automatique » plus bas) et les outils de tournage des
vidéos d'aide.

```bash
ssh ubuntu@<IP_PUBLIQUE>
git clone https://github.com/dimkahn/suivi-plongee.git
cd suivi-plongee
outils/installer-serveur.sh
```

Il se relance sans risque : un `.env` existant est gardé, une application
déjà démarrée n'est pas reconstruite, le compte admin n'est créé que si
la base n'en a aucun. Reste à faire à la main le pare-feu de l'hébergeur
(étape 2, côté cloud). Les étapes ci-dessous détaillent ce qu'il fait.

## 4. Installer Docker sur la VM

```bash
ssh ubuntu@<IP_PUBLIQUE>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # ou se reconnecter en SSH
```

## 5. Déployer l'application

```bash
git clone https://github.com/<toi>/suivi-plongee.git
cd suivi-plongee
cp .env.example .env
```

Éditer `.env` et remplir les trois valeurs (voir les commentaires du
fichier) :
- `DOMAINE` : le nom de domaine choisi à l'étape 3 ;
- `DB_PASSWORD` : un mot de passe fort quelconque ;
- `JWT_SECRET` : le résultat de `openssl rand -base64 48`.

Puis :

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Premier démarrage : Caddy obtient automatiquement le certificat HTTPS (peut
prendre une minute), Flyway applique les migrations sur une base Postgres
vide — **sans** les données de démonstration (`V100__donnees_demo.sql` ne se
charge qu'en profil `dev`, jamais en `prod`).

L'application est ensuite accessible sur `https://<DOMAINE>`.

## 6. Créer le premier compte ADMIN

La base de production démarre vide (aucun utilisateur). Le plus simple pour
créer le tout premier compte ADMIN est d'insérer une ligne directement en
base, une seule fois. D'abord générer un hash bcrypt du mot de passe choisi
(`apache2-utils` fournit `htpasswd` ; sinon `sudo apt install apache2-utils`) :

```bash
htpasswd -bnBC 12 "" 'ton-mot-de-passe-fort' | cut -d: -f2
```

Copier le hash affiché (commence par `$2y$12$…`), puis :

```bash
docker compose -f docker-compose.prod.yml exec db psql -U plongee -d plongee
```

```sql
INSERT INTO utilisateur (email, nom, prenom, mot_de_passe, actif, niveau_encadrement)
VALUES ('presidente@club.fr', 'Nom', 'Prénom', '<coller le hash ici>', true, 'E4');
INSERT INTO utilisateur_role (utilisateur_id, role)
VALUES (lastval(), 'ADMIN'), (lastval(), 'MONITEUR');
```

Une fois connecté en ADMIN, tous les autres comptes moniteurs se créent
depuis l'écran d'administration (avec un vrai lien d'invitation, cf. § 7).

## 7. Limitation connue : pas d'envoi d'e-mail réel

`ServiceNotificationConsole` (voir chantier ouvert n°6 du `CLAUDE.md`) se
contente de tracer les liens d'invitation et de réinitialisation dans les
logs — aucun serveur SMTP n'est configuré. En attendant un vrai envoi
(Brevo et Resend ont un palier gratuit de quelques centaines d'e-mails par
jour, largement suffisant pour un club), l'administrateur doit récupérer le
lien manuellement et le transmettre au moniteur :

```bash
docker compose -f docker-compose.prod.yml logs backend | grep "invitation\|reinitialisation"
```

## Tests et images (GitHub Actions)

Chaque **tag `v…` posé sur un commit de `master`** lance
`.github/workflows/deploiement.yml` (« Tests et images ») :

1. vérification que le commit tagué est bien sur `master` ;
2. tests d'intégration du backend (`mvn test`) ;
3. construction des images backend et frontend (x86 et ARM) et publication
   sur `ghcr.io/dimkahn/suivi-plongee-backend` / `-frontend`.

Ce workflow **ne met plus rien en production** : il n'a plus d'étape SSH, et
les secrets `SSH_*` ainsi que l'environnement `production` peuvent être
supprimés de GitHub. La mise en production est faite par le serveur lui-même
(section suivante). Attention : le serveur n'attend pas le résultat des
tests ; regarder l'onglet *Actions* avant de poser le tag sur un commit
douteux, ou faire tourner `mvn test` en local d'abord.

Les images de ghcr.io restent utilisables à la main sur un serveur trop
petit pour construire (1 Go de mémoire) :

```bash
git fetch --tags && git checkout --detach v2026.09.1
./outils/deployer.sh v2026.09.1
```

### Livrer une version

```bash
git checkout master && git pull
git tag v2026.09.1          # année.mois.numéro, par exemple
git push origin v2026.09.1
```

Dans les 5 minutes, le serveur voit le tag et le déploie (compter une
dizaine de minutes de construction, surtout la première fois). Éviter de
livrer pendant une séance : l'application est coupée une ou deux minutes au
redémarrage (les notations hors ligne attendent dans la file du téléphone et
repartent ensuite).

## Déploiement automatique (surveillance des tags)

Sur le serveur, qui doit être assez puissant pour construire lui-même les
images (compter plusieurs Go de mémoire) :
`outils/surveiller-tags.sh`, lancé par cron toutes les 5 minutes, regarde
s'il y a un nouveau **tag `v…` sur `master`** et le déploie :

1. construction des images du tag sur la machine : si elle échoue, la
   version en ligne n'est pas touchée ;
2. les images de la version en ligne sont mises de côté sous le tag d'image
   `avant-<tag>` ;
3. **sauvegarde de la base** (les 10 dernières sont gardées) ; si elle
   échoue, rien ne redémarre ;
4. démarrage de tout le `docker-compose.prod.yml` sur le nouveau tag, puis
   attente que `/actuator/health` réponde (5 minutes au plus) ;
5. s'il ne répond pas : **retour arrière automatique**, backend arrêté,
   restauration de la sauvegarde (une migration Flyway a pu passer), puis
   redémarrage des images `avant-<tag>`. Aucune saisie n'est perdue : le
   backend n'a jamais répondu entre la sauvegarde et la restauration. Le tag
   est noté en échec et n'est plus retenté tout seul.

Seul un tag plus récent que la version en ligne est déployé : le script ne
revient jamais en arrière de lui-même. Les images des 5 dernières versions
déployées restent sur la machine.


### Mise en place (une seule fois)

Sur la machine, depuis un clone du dépôt qui contient le `.env` de prod
(étape 5), avec un utilisateur du groupe `docker` et une clé SSH GitHub sans
phrase de passe (cron n'a pas d'agent SSH) :

```bash
outils/surveiller-tags.sh --installer
```

Cela crée `~/suivi-plongee-deploiement/` (un autre dossier avec
`DOSSIER_DEPLOIEMENT=…`), y clone le dépôt, y copie le `.env` et le script,
puis ajoute la ligne cron. Le dossier de développement n'est ensuite plus
jamais utilisé par le déploiement. Le nom de projet docker compose reste
`suivi-plongee` : mêmes conteneurs, **même volume de base** qu'avant.

Pour modifier le `.env` de prod, c'est désormais
`~/suivi-plongee-deploiement/depot/.env`. Pour une nouvelle version du
script lui-même, relancer `--installer` depuis un dépôt à jour.

### Suivre et intervenir

```bash
cd ~/suivi-plongee-deploiement
tail -f journal.log          # ce qui s'est passé, construction comprise
cat version-en-ligne         # dernier tag déployé avec succès
cat tags-en-echec            # tags abandonnés après un échec
ls sauvegardes/              # avant-<tag>-<date>.sql.gz
./surveiller-tags.sh v2026.10.1   # (re)déployer ce tag tout de suite,
                                  # même noté en échec, même plus ancien
```

### Revenir en arrière

Si un tag déployé avec succès se révèle fautif à l'usage :

```bash
~/suivi-plongee-deploiement/surveiller-tags.sh v2026.09.1   # le tag précédent
```

Il est reconstruit et redéployé de la même façon (sauvegarde comprise).
Attention : si la version annulée contenait une **migration Flyway**,
l'ancienne version tourne sur le schéma déjà migré, ce qui convient pour un
ajout de colonne ou de table mais pas toujours. En cas de doute, restaurer la
sauvegarde prise juste avant le déploiement fautif, **backend arrêté** :

```bash
cd ~/suivi-plongee-deploiement/depot
dc() { docker compose -p suivi-plongee -f docker-compose.prod.yml "$@"; }
dc stop backend
ls ../sauvegardes/                           # avant-<tag>-<date>.sql.gz
dc exec -T db psql -U plongee -d plongee -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c ../sauvegardes/avant-v2026.09.2-2026-09-30-2130.sql.gz | \
  dc exec -T db psql -U plongee -d plongee
```

puis redéployer le tag précédent (ci-dessus). Les saisies faites entre ce
déploiement et la restauration sont perdues.

C'est aussi la marche à suivre si le journal finit par « intervention
manuelle nécessaire » : ni le nouveau tag ni la version précédente n'ont
redémarré.

## Maintenir en conditions

**Mettre à jour** : voir « Déploiement automatique » ci-dessus. Sans la
surveillance des tags, la mise à jour à la main reste possible (le serveur compile alors
lui-même, ce qui peut manquer de mémoire sur une VM de 1 Go) :

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Sauvegarder la base** (à mettre en cron, par exemple quotidien) :

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U plongee plongee | gzip > "sauvegarde-$(date +%F).sql.gz"
```

Penser à rapatrier ces fichiers hors de la VM de temps en temps (une simple
synchronisation vers son propre poste suffit pour un club).

**Consulter les logs** :

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

## Vidéos d'aide

La page publique `/videos` de l'appli (sans connexion, liée depuis la page
de connexion et le menu) présente les vidéos de prise en main. Les fichiers
ne sont ni dans le dépôt ni dans les images : Caddy les sert sous
`/medias/videos/` depuis un dossier de la machine, monté en lecture seule
(`VIDEOS` dans le `.env`, `videos-publiees/` du dépôt par défaut). Tant que
le dossier est vide, la page annonce que les vidéos ne sont pas encore
publiées.

Pour les tourner puis les publier, sur la machine de production (le
tournage lance un backend `dev` à part, sur le port 8080 de l'hôte, sans
toucher à la prod) :

```bash
outils/videos/tourner.sh     # ~30 min, Chromium sans écran
outils/videos/publier.sh     # copie dans le dossier servi par Caddy
```

Ni tag ni redéploiement : la page relit `catalogue.json` à chaque visite.
Installer `ffmpeg` et `pip` (`sudo apt install ffmpeg python3-pip`) : ffmpeg
monte la voix off (les sous-titres lus par Piper, synthèse vocale installée
par `tourner.sh` dans `outils/videos/.piper/`) et produit les MP4, que les
iPhone lisent mieux que le WebM. Sans eux, les vidéos restent muettes, en
WebM. Détails dans `outils/videos/LISEZ-MOI.md`.

## Changer de machine

Toutes les données vivent dans la base PostgreSQL, photos des élèves
comprises (table `photo_eleve`) : il n'y a aucun autre fichier à copier, hormis
les vidéos d'aide, qui se retournent (voir ci-dessus).
Deux choses suffisent à tout retrouver sur une nouvelle VM : **un dump de
la base** et **le fichier `.env`**.

Prévenir les moniteurs : aucune saisie ne doit être faite sur l'ancienne
machine entre le dump et la bascule, sinon elle est perdue. Les notations
saisies hors ligne restent dans la file du téléphone et partiront vers le
nouveau serveur, à condition que le nom de domaine ne change pas.

**1. Sur l'ancienne machine, exporter la base :**

```bash
cd suivi-plongee
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U plongee --clean --if-exists plongee | gzip > plongee-transfert.sql.gz
zcat plongee-transfert.sql.gz | head    # vérifier que le fichier n'est pas vide
```

**2. Copier le dump et le `.env` vers la nouvelle machine** (`scp`, clé
USB...) :

```bash
scp plongee-transfert.sql.gz .env utilisateur@nouvelle-machine:~/
```

Le `.env` n'est pas dans git et contient des secrets (`DB_PASSWORD`,
`JWT_SECRET`, identifiants SMTP) : ne pas le faire transiter par e-mail ni
par un service de partage public. Garder le même `JWT_SECRET` évite que tout
le monde doive se reconnecter.

**3. Sur la nouvelle machine**, installer Docker (étape 4), cloner le dépôt,
y placer `.env` et le dump, puis **démarrer la base seule** avant
d'importer : si le backend démarre en premier, Flyway crée un schéma vide.

```bash
git clone <adresse-du-depot> suivi-plongee && cd suivi-plongee
mv ~/.env ~/plongee-transfert.sql.gz .

docker compose -f docker-compose.prod.yml up -d db
gunzip -c plongee-transfert.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U plongee -d plongee

docker compose -f docker-compose.prod.yml up -d --build
```

Au démarrage, Flyway retrouve dans la base importée les migrations déjà
appliquées et n'exécute que les nouvelles, s'il y en a.

**4. Faire pointer le domaine** vers l'adresse IP de la nouvelle VM (étape 3)
et ouvrir les ports 80 et 443 (étape 2). Caddy obtient un nouveau certificat
tout seul. Si le domaine change, mettre à jour `DOMAINE` dans `.env` : les
moniteurs devront alors ouvrir la nouvelle adresse sur leur téléphone, et
les notations hors ligne encore en attente sur l'ancienne ne suivront pas.

**5. Vérifier** en se connectant avec un compte existant (évaluations,
photos, fiches de sécurité) avant d'éteindre l'ancienne machine.
