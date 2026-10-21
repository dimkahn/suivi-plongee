# Spec : Relances automatiques des CACI qui arrivent à échéance

- **Statut :** validée (Dimitri, 2026-10-21), y compris les choix d'interprétation de R5, R12, R17, R19 et R20 (confirmés le même jour)
- **Intention :** [01-intention.md](01-intention.md) (validée par Dimitri le 2026-10-21 ; ses « Réponses du PO » font foi)

## Comportement actuel

- **Ce qui est stocké.** Pour un élève (dossier) comme pour un compte encadrant :
  la date de l'examen, le médecin signataire, les cases cochées du CACI FFESSM,
  et la fin de validité, que le serveur calcule (examen + 1 an ; examen un
  29 février : fin le 28 février de l'année suivante). Le certificat lui-même et
  le texte du médecin ne sont jamais stockés. Un dossier élève peut être
  rattaché à un compte (lien facultatif).
- **L'état « bientôt échu » n'existe qu'à l'écran.** Il est calculé par le
  navigateur (`frontend/src/app/core/caci.ts`, `JOURS_AVANT_ECHEANCE = 30`), à
  partir de la date de l'appareil. Le serveur ne calcule aucun état. Avec F la
  fin de validité et D la date du jour :
  - pas de F : « non renseigné » (« CACI non renseigné ») ;
  - F < D : « expiré » (« CACI expiré depuis le jj/mm/aaaa ») ;
  - D ≤ F ≤ D + 30 jours, bornes incluses : « bientôt échu »
    (« CACI expire le jj/mm/aaaa ») ; le jour F, le CACI est encore
    « bientôt échu », pas « expiré » ;
  - F > D + 30 jours : « valide » (« CACI valide jusqu'au jj/mm/aaaa »).
  - Couleurs : rouge à moins de 15 jours, orange de 15 à 30 jours, vert
    au-delà (`JOURS_URGENCE = 15`).
  - Le serveur considère un CACI valide le jour D si F ≥ D (le jour F compris).
- **Écrans qui le montrent :**
  - `/admin/eleves` (ADMIN) : état du CACI sur chaque carte ; filtre « CACI »
    → « À vérifier (expiré, bientôt échu ou non renseigné) » ; bandeau
    « N élève(s) de la saison … avec un CACI expiré, bientôt échu ou non
    renseigné. » Ce bandeau ne compte que les élèves rattachés à la saison
    choisie par une formation (quel que soit son statut) ou une adhésion.
  - `/admin/moniteurs` (ADMIN) : même filtre ; bandeau « N moniteur(s)
    actif(s) avec un CACI expiré, bientôt échu ou non renseigné. » (comptes
    actifs seulement).
  - « Infos élèves » (`/eleves`, moniteurs) : case CACI de chaque élève.
  - « Mon compte » (`/mon-compte`) : le CACI du compte connecté, avec la mention
    « date saisie par un administrateur, à qui remettre un nouveau certificat ».
- **Personne n'est prévenu.** Aucun e-mail ni message ne parle du CACI. L'envoi
  d'e-mails existe (liens de mot de passe, carnets de séjour, courriels libres) :
  par SMTP hors profil `dev` ; en profil `dev`, le message est seulement écrit
  dans le journal du serveur. Un échec d'envoi y est déjà détecté.
- **Tâches automatiques existantes.** Deux tâches de nuit (3 h 30 et 3 h 35,
  heure de Paris). La date du jour du club est celle de Europe/Paris.
- **Adresses.** Un compte (moniteur, administrateur) a toujours une adresse
  e-mail : obligatoire et unique, c'est l'identifiant de connexion. Les élèves
  ne se connectent pas (comptes élèves fermés) ; leur dossier peut avoir une
  adresse, facultative.
- **Comptes de démo** (profil `dev`, dates relatives au jour du lancement) :
  Claire (`presidente@club.fr`, ADMIN + E4) : CACI valable 8 mois ;
  Gwendoline (`e3@club.fr`, E3 + DIRECTEUR_TECHNIQUE, sans ADMIN) : fin dans
  12 jours ; Flora (`e2@club.fr`, E2) : expiré depuis 20 jours ; Tiago
  (`e1@club.fr`, E1) : non renseigné. Élève Hugo Lemaire (N1, saison
  2026-2027) : fin dans 12 jours.

## Comportement attendu

Chaque jour à 7 h, heure de Paris, sans action de personne, le serveur regarde
les CACI des élèves de la saison en cours et des moniteurs actifs :

- **Moniteur** : il reçoit un e-mail 30 jours avant la fin de validité de son
  CACI, puis un autre le dernier jour de validité. Rien d'autre, rien après.
  S'il renouvelle entre les deux, le second ne part pas.
- **Administrateur (tout compte ADMIN actif)** : les jours où au moins une
  personne atteint l'un de ces deux moments, il reçoit un récapitulatif : qui
  (élèves et moniteurs), jusqu'à quand le CACI est valable, qui n'a pas de CACI
  renseigné (au plus une fois par semaine pour une même personne), et quel
  moniteur l'e-mail n'a pas pu joindre. C'est lui qui transmet aux élèves (ou à
  leur responsable pour un mineur). Il peut consulter par l'API la trace des
  relances envoyées (pas d'écran dans cette évolution).
- **Élève** : ne reçoit rien.
- **Directeur technique non ADMIN, autres moniteurs, sécurité surface** : ne
  reçoivent rien qui concerne les autres, et n'ont pas accès à la trace.

Les écrans actuels (états, couleurs, filtres, bandeaux) ne changent pas.

## Règles métier

Notations : F = fin de validité du CACI en vigueur ; D = date du jour du club.
Les dates des e-mails s'écrivent jj/mm/aaaa. Un e-mail est « parti » quand le
serveur SMTP l'a accepté (un rejet signalé plus tard n'est pas détecté).

- **R1** — F = date de l'examen + 1 an (règle actuelle, inchangée ; examen un 29 février → F le 28 février). D est la date civile à Europe/Paris au moment de l'exécution, pas celle de la machine.
- **R2** — Le délai est de 30 jours. Le jour « J-30 » d'un CACI est F − 30 jours ; le jour « J » est F, le dernier jour de validité. La valeur 30 existe côté serveur et côté écran ; chacune est figée par un test.
- **R3** — Moniteurs concernés : comptes ayant le rôle MONITEUR, actifs le jour D (compte actif, et date de fin d'accès absente ou ≥ D). Un compte désactivé ou dont l'accès est terminé n'est ni relancé ni cité.
- **R4** — Élèves concernés : dossiers non archivés rattachés à la saison ouverte (la plus récente par date de début parmi les saisons ouvertes) par une formation, quel que soit son statut, ou par une adhésion. Un élève rattaché seulement à une saison passée n'est pas concerné.
- **R5** — Un dossier élève concerné (R4) rattaché au compte d'un moniteur concerné (R3) est la même personne : elle n'est traitée qu'une fois, comme moniteur, sur le CACI de son compte ; le CACI de son dossier élève est ignoré.
- **R6** — Relance « bientôt » : due le jour D si F − 30 ≤ D ≤ F − 1 et qu'elle n'a pas encore été faite pour cette F. Si la personne entre dans le périmètre après F − 30 (CACI saisi tard, première exécution après la mise en production), elle part à la première exécution de cette période.
- **R7** — Relance « jour J » : due le jour D = F seulement, si elle n'a pas encore été faite pour cette F. Aucune relance n'est due si F < D ni si F > D + 30. Une relance « jour J » non faite le jour F (pas d'exécution, envoi refusé) n'est jamais rattrapée.
- **R8** — Pour une même personne et une même F, il part au plus une relance « bientôt » et au plus une relance « jour J », pour l'e-mail du moniteur comme pour la mention au récapitulatif. Toute nouvelle F (renouvellement ou correction de la date d'examen) ouvre un nouveau cycle selon R6 et R7 ; les relances faites pour l'ancienne F n'empêchent pas celles de la nouvelle, et aucune relance ne part plus pour l'ancienne.
- **R9** — Pour chaque relance due d'un moniteur, un e-mail lui est envoyé à l'adresse de son compte, avec le texte exact de R13 ou R14. Un élève ne reçoit jamais d'e-mail de relance, même si son dossier a une adresse.
- **R10** — Destinataires du récapitulatif : chaque compte ayant le rôle ADMIN et actif le jour D (même définition qu'en R3) reçoit son propre e-mail. Le directeur technique ne le reçoit que s'il a aussi le rôle ADMIN. Un administrateur qui est aussi moniteur concerné reçoit son e-mail de moniteur et le récapitulatif.
- **R11** — Le récapitulatif part le jour D si et seulement si au moins une relance (élève ou moniteur) est due ce jour-là (R6, R7). Il cite : les personnes dont une relance est due ce jour-là, les personnes sans CACI selon R12, et les moniteurs de R16.
- **R12** — Une personne du périmètre (R3, R4, R5) sans CACI renseigné figure dans la rubrique « Sans CACI renseigné » d'un récapitulatif du jour D, sauf si elle a été citée dans cette rubrique par un récapitulatif parti entre D − 6 et D inclus (le jour même compte : un second passage le même jour ne la cite pas deux fois ; tranché par Dimitri le 2026-10-21). Elle ne reçoit jamais d'e-mail individuel.
- **R13** — E-mail « bientôt » au moniteur, mot pour mot (`{prénom}` : prénom du compte ; `{F}` : jj/mm/aaaa) :
  - Sujet : `Votre CACI expire le {F}`
  - Corps :
    ```
    Bonjour {prénom},

    Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au {F}.
    Pensez à le faire renouveler et à remettre le nouveau certificat à un administrateur du club avant cette date.

    Message envoyé automatiquement par le suivi des formations du club.
    ```
- **R14** — E-mail « jour J » au moniteur, mot pour mot :
  - Sujet : `Votre CACI expire aujourd'hui, le {F}`
  - Corps :
    ```
    Bonjour {prénom},

    Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au {F}, c'est-à-dire aujourd'hui. À partir de demain, il sera expiré.
    Remettez le nouveau certificat à un administrateur du club.

    Message envoyé automatiquement par le suivi des formations du club.
    ```
- **R15** — Récapitulatif à l'administrateur, mot pour mot (`{prénom}` : prénom de l'administrateur ; `{D}` : jj/mm/aaaa) :
  - Sujet : `CACI à suivre : récapitulatif du {D}`
  - Corps :
    ```
    Bonjour {prénom},

    Voici les CACI à suivre au {D}.

    CACI qui expirent bientôt :
    - {Nom} {Prénom}, {élève|moniteur}, valable jusqu'au {F}

    CACI qui expirent aujourd'hui :
    - {Nom} {Prénom}, {élève|moniteur}, valable jusqu'au {F}

    Sans CACI renseigné :
    - {Nom} {Prénom}, {élève|moniteur}

    Moniteurs que l'e-mail de relance n'a pas pu joindre :
    - {Nom} {Prénom}

    Les élèves ne reçoivent aucun message : transmettez-leur l'information, ou à leur responsable légal pour un mineur.
    Les moniteurs listés ont reçu leur propre message, sauf ceux de la rubrique « n'a pas pu joindre ».

    Message envoyé automatiquement par le suivi des formations du club.
    ```
  - Une rubrique vide est omise en entier (titre, lignes et ligne vide qui suit).
  - Dans chaque rubrique, les lignes sont triées par nom puis par prénom, sans tenir compte des majuscules ni des accents.
  - « moniteur » pour une personne de R3 (y compris le cas R5), « élève » pour une personne de R4.
- **R16** — Échec de l'e-mail d'un moniteur : la relance n'est pas tracée, elle reste due et elle est retentée à l'exécution suivante tant que R6 ou R7 le permettent ; ce moniteur figure dans la rubrique « Moniteurs que l'e-mail de relance n'a pas pu joindre » du récapitulatif de la même exécution. Un échec n'empêche jamais les autres envois de la même exécution.
- **R17** — Une personne citée dans un récapitulatif compte comme relancée (R8) ou comme citée (R12) si ce récapitulatif est parti vers au moins un administrateur. Si aucun administrateur n'est actif, ou si le récapitulatif n'est parti vers aucun, les élèves qu'il aurait cités restent dus (dans la limite de R6 et R7), les moniteurs sont relancés quand même, et une erreur est écrite dans le journal du serveur, sans nom, prénom, adresse e-mail ni date de CACI : `Relances CACI du {D} : aucun administrateur actif, récapitulatif non envoyé.` ou `Relances CACI du {D} : récapitulatif refusé pour tous les administrateurs.` Rien d'autre n'est fait (ni message dans l'appli, ni autre destinataire). L'échec de l'e-mail d'un moniteur (R16) est écrit dans le journal sous la même contrainte : `Relances CACI du {D} : un e-mail de relance à un moniteur n'a pas pu partir.`
- **R18** — Données de santé dans les e-mails. Les e-mails de R13 à R15 ne contiennent que : prénom et nom, la mention élève ou moniteur, F, D. Ils ne contiennent jamais : la date de l'examen, le médecin, les cases cochées (ni « compétition », ni « limites et préconisations »), le numéro de licence, la date de naissance, le téléphone, le contact d'urgence, l'adresse e-mail d'une autre personne, une photo, ni un lien vers un dossier.
- **R19** — Trace. Chaque e-mail parti (R13, R14, R15) laisse une ligne de trace, et une seule. Elle contient uniquement : la date d'envoi ; le destinataire (nom, prénom, adresse e-mail) ; les personnes concernées, par leur nom et prénom seulement : le moniteur lui-même pour R13 et R14, toutes les personnes citées dans les rubriques « bientôt », « aujourd'hui » et « Sans CACI renseigné » pour R15. Elle ne contient jamais F, la date de l'examen, le médecin, les cases, la mention élève ou moniteur, le sujet ni le corps de l'e-mail.
- **R20** — Conservation. Une ligne de trace est supprimée à la première exécution dont le jour D est postérieur à sa date d'envoi + 2 ans (envoi le 21/10/2026 : encore présente le 21/10/2028, supprimée le 22/10/2028 ; envoi le 29/02/2028 : supprimée à partir du 01/03/2030).
- **R21** — La trace se consulte par `GET /api/admin/relances-caci`, réservé au rôle ADMIN, du plus récent au plus ancien. Aucune habilitation par niveau (E1 à E4) ni le rôle DIRECTEUR_TECHNIQUE ne donne accès. Aucune route ne permet de la créer, de la modifier ni de la supprimer.
- **R22** — Déclenchement : automatique, chaque jour à 07 h 00 heure de Paris (heure d'été comme d'hiver), un seul passage par jour. Aucune route ni aucun bouton ne déclenche le traitement. L'horloge du déclenchement est remplaçable dans les tests ; le traitement accepte aussi D en paramètre pour les tests, et pour un D donné il produit exactement les e-mails et les traces d'une exécution réelle ce jour-là. Exécuter de nouveau le traitement pour un même D n'envoie rien de plus.
- **R23** — En profil `dev`, les e-mails de relance sont écrits dans le journal du serveur (destinataire, sujet, corps), comme les autres e-mails, et tracés comme partis. C'est le moyen de recette.
- **R24** — Les écrans existants (états, couleurs, filtres « À vérifier », bandeaux, libellés) ne changent pas.

## Critères d'acceptation

Sauf mention contraire, chaque test crée ses propres données (un compte
moniteur créé comme le ferait `presidente@club.fr` dans l'écran Moniteurs, un
élève inscrit à la saison ouverte, au moins un administrateur actif),
remplace l'envoi d'e-mails par un faux qui enregistre chaque message (et peut
simuler un refus), et appelle le traitement avec une date D choisie (R22).
Exemple filé : moniteur Paul Marin, compte actif `paul.marin@exemple.fr`, CACI
passé le 20/11/2025, donc F = 20/11/2026, J-30 = 21/10/2026.

### Moniteurs

- **CA1 — Un moniteur est relancé 30 jours avant la fin de validité** (R2, R6, R9, R13)
  Étant donné Paul Marin, quand le traitement s'exécute pour D = 21/10/2026, alors un seul e-mail part vers `paul.marin@exemple.fr`, de sujet `Votre CACI expire le 20/11/2026`, dont le corps est celui de R13 mot pour mot avec `Paul` et `20/11/2026`.
- **CA2 — Rien avant J-30** (R2, R7)
  Étant donné Paul Marin, quand le traitement s'exécute pour D = 20/10/2026 (F = D + 31), alors aucun e-mail ne part et aucune trace n'est écrite.
- **CA3 — Une seule relance « bientôt »** (R8, R22)
  Étant donné CA1 exécuté, quand le traitement s'exécute de nouveau pour D = 21/10/2026, puis pour chaque jour du 22/10/2026 au 19/11/2026, alors aucun nouvel e-mail ne part vers Paul Marin et la trace ne compte qu'une ligne dont il est destinataire.
- **CA4 — Relance « bientôt » rattrapée dans la période** (R6)
  Étant donné un moniteur dont F = D + 12 et qui n'a jamais été relancé, quand le traitement s'exécute pour D, alors il reçoit l'e-mail de R13 avec sa F. En profil `dev`, au premier passage, le journal du serveur montre cet e-mail adressé à `e3@club.fr` (Gwendoline).
- **CA5 — Relance le dernier jour de validité** (R2, R7, R14)
  Étant donné CA1 exécuté, quand le traitement s'exécute pour D = 20/11/2026, alors un seul e-mail part vers `paul.marin@exemple.fr`, de sujet `Votre CACI expire aujourd'hui, le 20/11/2026`, avec le corps de R14 mot pour mot.
- **CA6 — Après le jour J, plus rien, même si le jour J a été manqué** (R7, R8)
  Étant donné CA5 exécuté, quand le traitement s'exécute de nouveau pour D = 20/11/2026, puis pour D = 21/11/2026, alors aucun e-mail ne part vers Paul Marin. Étant donné un autre moniteur relancé à J-30 pour lequel aucune exécution n'a eu lieu le jour F, quand le traitement s'exécute pour F + 1, alors aucun e-mail ne part vers lui et il n'est cité dans aucun récapitulatif. Étant donné un moniteur dont F = D − 20 (en démo, Flora, `e2@club.fr`), quand le traitement s'exécute pour D, alors aucun e-mail ne part vers lui.
- **CA7 — Renouvelé entre J-30 et J : pas de relance « jour J », nouveau cycle** (R8)
  Étant donné CA1 exécuté, puis le 01/11/2026 un administrateur qui saisit pour Paul Marin un examen au 30/10/2026 (F′ = 30/10/2027), quand le traitement s'exécute pour D = 20/11/2026, alors aucun e-mail ne part vers Paul Marin ; pour D = 30/09/2027, il reçoit l'e-mail de R13 avec `30/10/2027` ; pour D = 30/10/2027, celui de R14 avec `30/10/2027`.
- **CA8 — Date d'examen corrigée dans la période : nouvelle relance « bientôt »** (R8)
  Étant donné CA1 exécuté, puis le 22/10/2026 un administrateur qui corrige la date d'examen de Paul Marin au 10/11/2025 (F″ = 10/11/2026), quand le traitement s'exécute pour D = 22/10/2026, alors Paul Marin reçoit l'e-mail de R13 avec `10/11/2026` ; pour D = 10/11/2026, il reçoit celui de R14 avec `10/11/2026` ; pour D = 20/11/2026, aucun e-mail ne part vers lui.
- **CA9 — Moniteur désactivé ou accès terminé : rien** (R3)
  Étant donné un moniteur à J-30 dont le compte est désactivé, et un autre à J-30 dont la date de fin d'accès est D − 1, quand le traitement s'exécute pour D, alors aucun des deux ne reçoit d'e-mail ni n'est cité au récapitulatif.
- **CA10 — Moniteur sans CACI renseigné : pas d'e-mail individuel** (R11, R12)
  Étant donné un moniteur actif sans CACI (en démo, Tiago, `e1@club.fr`) et, le même jour D, Paul Marin à J-30, quand le traitement s'exécute pour D, alors aucun e-mail ne part vers le moniteur sans CACI et le récapitulatif le cite sous « Sans CACI renseigné : » par la ligne `- {Nom} {Prénom}, moniteur`.

### Élèves

- **CA11 — Un élève n'est jamais écrit directement** (R9)
  Étant donné un élève de la saison ouverte dont le dossier porte l'adresse `eleve.test@exemple.fr` et dont F = D + 30, quand le traitement s'exécute pour D, puis pour le jour F, alors aucun e-mail ne part vers `eleve.test@exemple.fr`.
- **CA12 — Un élève de la saison figure au récapitulatif à J-30 et à J** (R4, R11, R15)
  Étant donné l'élève de CA11, quand le traitement s'exécute pour D, alors le récapitulatif contient sous « CACI qui expirent bientôt : » la ligne `- {Nom} {Prénom}, élève, valable jusqu'au {F}` ; pour le jour F, la même ligne sous « CACI qui expirent aujourd'hui : » ; pour chaque jour entre D + 1 et F − 1, il n'est cité sous aucune de ces deux rubriques.
- **CA13 — Périmètre des élèves** (R4)
  Étant donné, chacun avec F = D + 30, un élève rattaché seulement à la saison 2025-2026, un élève archivé, et un élève sans formation mais avec une adhésion à la saison ouverte, quand le traitement s'exécute pour D, alors seul l'élève en adhésion est cité au récapitulatif, comme élève.
- **CA14 — Moniteur qui est aussi élève de la saison : une seule relance, de moniteur** (R5, R15)
  Étant donné le compte moniteur de Paul Marin (F = 20/11/2026) et un dossier élève de la saison ouverte rattaché à ce compte, avec un CACI dont F = 25/11/2026, quand le traitement s'exécute pour D = 21/10/2026, alors Paul Marin reçoit un seul e-mail (R13, `20/11/2026`) et le récapitulatif le cite une seule fois : `- Marin Paul, moniteur, valable jusqu'au 20/11/2026` ; pour D = 26/10/2026 (J-30 du dossier élève), rien ne part le concernant.

### Récapitulatif

- **CA15 — Texte exact du récapitulatif** (R11, R15)
  Étant donné, pour D = 21/10/2026, un élève « Lemaire Hugo » à J-30 (F = 20/11/2026), un moniteur « Marin Paul » à J (F = 21/10/2026), un moniteur « Vidal Tom » sans CACI jamais cité, et un seul administrateur actif, de prénom Claire, quand le traitement s'exécute, alors Claire reçoit un e-mail de sujet `CACI à suivre : récapitulatif du 21/10/2026` dont le corps est exactement celui de R15, avec les rubriques « bientôt » (Hugo), « aujourd'hui » (Paul) et « Sans CACI renseigné » (Tom), sans la rubrique « n'a pas pu joindre ».
- **CA16 — Pas de récapitulatif les jours sans échéance** (R11)
  Étant donné des personnes sans CACI renseigné mais aucune relance due le jour D, quand le traitement s'exécute pour D, alors aucun récapitulatif ne part.
- **CA17 — « Sans CACI renseigné » au plus une fois par semaine** (R12)
  Étant donné CA15 exécuté (Tom cité le 21/10/2026) et une nouvelle relance due chacun des jours 22/10/2026, 27/10/2026 et 28/10/2026, quand le traitement s'exécute ces jours-là, alors Tom n'est pas cité dans les récapitulatifs du 22/10 ni du 27/10, et il est cité dans celui du 28/10/2026. Si le traitement repasse le 21/10/2026, Tom n'est pas cité une deuxième fois ce jour-là.
- **CA18 — Chaque administrateur actif reçoit le sien, et seulement eux** (R10)
  Étant donné deux comptes ADMIN actifs, un compte ADMIN désactivé, `e3@club.fr` (DIRECTEUR_TECHNIQUE sans ADMIN) et une relance due le jour D, quand le traitement s'exécute pour D, alors exactement deux récapitulatifs partent, un par administrateur actif, chacun commençant par `Bonjour {son prénom},` ; aucun ne part vers le compte désactivé ni vers `e3@club.fr`.
- **CA19 — Un administrateur moniteur reçoit les deux** (R10)
  Étant donné un compte ADMIN + MONITEUR actif dont le CACI est à J-30, quand le traitement s'exécute, alors il reçoit l'e-mail de R13 et le récapitulatif, où il est cité comme moniteur.
- **CA20 — Sans administrateur actif** (R17)
  Étant donné aucun compte ADMIN actif, un moniteur et un élève à J-30, quand le traitement s'exécute pour D, alors le moniteur reçoit l'e-mail de R13, aucun récapitulatif ne part, le journal du serveur contient `Relances CACI du {D} : aucun administrateur actif, récapitulatif non envoyé.` et aucun nom ni adresse dans cette ligne ; quand un administrateur actif existe et que le traitement s'exécute pour D + 1, l'élève est cité sous « bientôt ».

### Échecs d'envoi

- **CA21 — E-mail du moniteur refusé : signalé, puis retenté** (R16, R17)
  Étant donné Paul Marin à J-30 et un faux envoi qui refuse les messages vers `paul.marin@exemple.fr`, quand le traitement s'exécute pour D = 21/10/2026, alors aucune trace n'a Paul Marin pour destinataire, le récapitulatif contient la rubrique « Moniteurs que l'e-mail de relance n'a pas pu joindre : » avec `- Marin Paul`, les autres e-mails de l'exécution partent, et le journal contient `Relances CACI du 21/10/2026 : un e-mail de relance à un moniteur n'a pas pu partir.` Quand l'envoi accepte de nouveau et que le traitement s'exécute pour D = 22/10/2026, Paul Marin reçoit l'e-mail de R13 (`20/11/2026`), une seule fois.
- **CA22 — Récapitulatif refusé partout : les élèves restent dus** (R17)
  Étant donné un seul administrateur actif, un élève à J-30 et un faux envoi qui refuse le récapitulatif, quand le traitement s'exécute pour D, alors le journal contient `Relances CACI du {D} : récapitulatif refusé pour tous les administrateurs.` sans nom ni adresse ; quand l'envoi est rétabli et que le traitement s'exécute pour D + 1, le récapitulatif cite l'élève sous « bientôt » et la trace ne compte qu'une ligne de récapitulatif, datée de D + 1.
- **CA23 — Récapitulatif reçu par un seul administrateur : l'élève compte comme relancé** (R17)
  Étant donné deux administrateurs actifs, le récapitulatif refusé pour l'un et accepté pour l'autre, quand le traitement s'exécute pour D puis pour D + 1, alors l'élève n'est plus cité sous « bientôt » le jour D + 1.

### Données personnelles

- **CA24 — Aucun contenu du certificat dans les e-mails** (R18)
  Étant donné un moniteur et un élève à J-30 dont le CACI porte le médecin « Médecin fédéral » et les cases « En compétition » et « Avec des limites et préconisations », quand le traitement s'exécute, alors aucun e-mail (sujet et corps) ne contient : la date de l'examen (sous aucun format), « fédéral », « compétition », « limites », « préconisation », le numéro de licence, la date de naissance, le téléphone, le nom du contact d'urgence, ni l'adresse e-mail d'une autre personne que le destinataire.
- **CA25 — La trace ne garde que date, destinataire et noms des personnes concernées** (R19)
  Étant donné CA15 exécuté, quand `presidente@club.fr` appelle `GET /api/admin/relances-caci`, alors chaque élément contient seulement la date d'envoi, le nom, le prénom et l'adresse du destinataire, et la liste des personnes concernées (nom et prénom) ; la ligne du récapitulatif de Claire cite Lemaire Hugo, Marin Paul et Vidal Tom ; aucune F, date d'examen, médecin, case, mention élève ou moniteur, sujet ni corps n'apparaît dans la réponse.
- **CA26 — La trace est effacée après 2 ans** (R20)
  Étant donné CA1 exécuté (envoi du 21/10/2026), quand le traitement s'exécute pour D = 21/10/2028, alors la ligne est encore renvoyée par `GET /api/admin/relances-caci` ; quand il s'exécute pour D = 22/10/2028, elle ne l'est plus.

### Consultation et droits

- **CA27 — Un administrateur consulte la trace** (R21)
  Étant donné CA1 puis CA5 exécutés, quand `presidente@club.fr` appelle `GET /api/admin/relances-caci`, alors la réponse est 200 et contient deux lignes dont Paul Marin (`paul.marin@exemple.fr`) est destinataire, datées du 20/11/2026 puis du 21/10/2026, dans cet ordre.
- **CA28 — Refus de rôle** (R21)
  Quand `e1@club.fr` (MONITEUR), `e2@club.fr` (MONITEUR, TIV, FICHE_SECURITE), `surface@club.fr` (SECURITE_SURFACE) ou `eleve@club.fr` (ELEVE, profil `dev`) appelle `GET /api/admin/relances-caci`, alors la réponse est 403. Sans jeton, la réponse est 401.
- **CA29 — Ni le niveau d'encadrement ni le rôle de directeur technique ne donnent accès** (R21)
  Quand `e3@club.fr` (MONITEUR E3 et DIRECTEUR_TECHNIQUE, sans ADMIN) appelle `GET /api/admin/relances-caci`, alors la réponse est 403.
- **CA30 — Ni écriture de la trace ni déclenchement par l'API** (R21, R22)
  Quand `presidente@club.fr` envoie `POST`, `PUT` ou `DELETE` sur `/api/admin/relances-caci`, alors la réponse n'est jamais 2xx (405 ou 404) et la trace est inchangée.

Aucun refus métier 422 n'est prévu : la seule route ajoutée est en lecture, sans
paramètre.

### Déclenchement, fuseau, cohérence avec l'écran

- **CA31 — Chaque jour à 7 h, heure de Paris** (R22)
  Étant donné l'instant 24/10/2026 08 h 00 à Paris, quand on calcule les prochains déclenchements programmés, alors les deux déclenchements suivants sont le 25/10/2026 à 07 h 00 à Paris (06 h 00 UTC, heure d'hiver) et le 26/10/2026 à 07 h 00 à Paris, et aucun autre entre-temps.
- **CA32 — La date du jour est celle du club** (R1, R22)
  Étant donné Paul Marin (J-30 = 21/10/2026), quand le déclenchement automatique s'exécute avec une horloge réglée au 20/10/2026 à 22 h 30 UTC (21/10/2026 à 00 h 30 à Paris), alors il traite D = 21/10/2026 et l'e-mail de R13 part.
- **CA33 — Même délai que l'écran, figé des deux côtés** (R2)
  Le test existant `caci.spec.ts` (« bientôt (30 jours) ») reste vert sans modification ; un test côté serveur vérifie qu'une relance « bientôt » est due pour F = D + 30 et ne l'est pas pour F = D + 31.
- **CA34 — Les écrans ne changent pas** (R24)
  Étant donné les données de démo, `/admin/eleves`, `/admin/moniteurs`, `/eleves` et `/mon-compte` affichent les mêmes états, couleurs, filtres et bandeaux qu'avant la livraison (vérification dans le navigateur).

### Hors ligne

Sans objet. Aucun écran de bord de bassin n'est touché ; les relances partent
du serveur ; la consultation de la trace demande le réseau et n'utilise aucune
file hors ligne.

## Manuels et vidéos touchés

Manuels (`frontend/src/app/features/aide/manuels/`) :
- `mon-compte.md` : un moniteur reçoit un e-mail 30 jours avant la fin de son CACI et le dernier jour ; ajouter la question « Pourquoi ai-je reçu un e-mail sur mon CACI ? » et les mots-clés `relance`, `rappel`, `e-mail`, `expiration`.
- `ajouter-un-moniteur.md` : le CACI saisi déclenche ces relances ; une adresse fausse fait apparaître le moniteur dans « n'a pas pu joindre » du récapitulatif.
- `dossier-eleve.md` et `infos-eleves.md` : les élèves ne reçoivent rien ; l'administrateur reçoit le récapitulatif et transmet (responsable légal pour un mineur).
- `administration.md` : le récapitulatif quotidien par e-mail (quand il part, ce qu'il contient, « Sans CACI renseigné » au plus une fois par semaine). La trace n'ayant pas d'écran, elle n'est pas décrite.

Vidéos (`outils/videos/scenarios/`) : aucune, car aucun écran ne change (A05,
A06, M02, M16, A01 montrent les mêmes états) et la trace n'a pas d'écran dans
cette évolution.

## Écarts aux règles

Aucun. Points de vigilance :
- `donnees-personnelles.md` : rien de nouveau n'est stocké sur le CACI. La trace
  est une nouvelle donnée personnelle (qui a été relancé, quand), limitée par
  R19 et conservée 2 ans (R20). Les journaux d'erreur ne contiennent aucune
  donnée personnelle (R17). Agent `relecteur-donnees-personnelles` avant le
  commit.
- `comptes.md` : conforme (aucun message aux élèves, e-mail par le service
  existant, console en `dev`).
- CLAUDE.md, « l'auteur d'une écriture vient du SecurityContext » : la trace est
  écrite par une tâche automatique, sans utilisateur connecté ; il n'y a pas
  d'auteur à inventer, et aucune route ne permet de l'écrire (R21).
- `audit.md` : la trace est en ajout seul (hors suppression à 2 ans) et porte sa
  propre date ; pas d'historique Envers attendu.
- L'état « bientôt échu » n'était calculé que par l'écran. Le serveur calcule
  désormais la même règle pour les relances ; la valeur 30 reste en double,
  figée par un test de chaque côté (R2, CA33).

## Hors périmètre

- Relances RIFAP et 4 plongées en milieu naturel d'un N1 certifié en piscine.
- CACI des clients de passage (séjours).
- Toute évolution de ce qui est stocké du CACI, et toute adresse de responsable légal.
- Blocage de l'inscription, de la notation ou de la présence d'une personne au CACI expiré.
- Message dans l'appli, notification push, SMS.
- Relance après le jour F, et rattrapage d'un jour J manqué.
- Écran de consultation de la trace (API seule).
- Déclenchement manuel du traitement.
- Détection des rejets SMTP signalés après acceptation.
- Exécution sur plusieurs instances du backend (une seule instance, pas de verrou distribué).
- Boîte SMTP de capture pour la recette (le journal `dev` suffit).
- Modification des écrans existants, et réglage du délai de 30 jours depuis l'appli.

## Questions tranchées (Dimitri, 2026-10-21)

- Q1 — La trace nomme aussi les personnes concernées (nom seulement), en plus de la date et du destinataire (R19).
- Q2 — J = F, le dernier jour de validité, comme l'écran (R2).
- Q3 — Récapitulatif à tous les ADMIN actifs ; le directeur technique ne le reçoit que s'il est aussi ADMIN (R10).
- Q4 — Récapitulatif seulement les jours où une relance est due ; les personnes sans CACI renseigné y sont reprises au plus une fois par semaine (R11, R12).
- Q5 — Une date d'examen corrigée donne une nouvelle F, donc un nouveau cycle avec une nouvelle relance « bientôt » (R8, CA8).
- Q6 — Pas de rattrapage le lendemain d'un jour J manqué (R7, CA6).
- Q7 — Pas d'écran pour la trace dans cette évolution, l'API seule ; aucune vidéo touchée.
- Q8 — La trace est conservée 2 ans, puis supprimée (R20).
- Q9 — Une personne à la fois moniteur et élève de la saison : une seule relance, celle de moniteur (R5).
- Q10 — Aucun administrateur actif ou envoi du récapitulatif refusé : erreur écrite dans le journal du serveur, sans donnée personnelle, rien d'autre (R17).
- Q11 — Déclenchement chaque jour à 7 h, heure de Paris ; un seul passage par jour (R22).
- Q12 — Pas de déclenchement manuel (R22).
- Q13 — « Envoyé » = accepté par le serveur SMTP (notations des règles).
- Q14 — Une seule instance du backend, pas de verrou distribué (hors périmètre).
- Q15 — La valeur 30 jours reste en double côté serveur et côté écran, chacune figée par un test (R2, CA33).
- Q16 — En recette, le journal du serveur en profil `dev` suffit (R23).
- Q17 — Horloge injectée dans le déclenchement pour tester le fuseau (R22, CA32).
