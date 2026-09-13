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

## Maintenir en conditions

**Mettre à jour** après un nouveau commit :

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
