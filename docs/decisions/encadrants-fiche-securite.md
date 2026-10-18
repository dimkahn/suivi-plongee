# Historique des décisions : encadrants, fiche de sécurité, groupes de plongeurs

Ce fichier est l'historique. Les règles en vigueur sont dans `.claude/rules/encadrants-fiche-securite.md`.

## Niveau de plongeur distinct du niveau d'encadrement (V25)
- **Contexte :** un E1 peut n'être que N2 ; le niveau de plongeur ne se déduit pas du niveau d'encadrement.
- **Décision :** colonne `utilisateur.niveau_plongeur` (N1 à N5), saisie par un ADMIN dans l'écran Moniteurs.

## Moniteurs en formation et stagiaire E3 (2026, V49)
- **Décision :** `utilisateur.niveau_encadrement_prepare`. Choix du club : seul le stagiaire E3 en tire un droit, encadrer comme un E3 dans la proposition des palanquées, avec un avertissement sur la présence du tuteur.
- **Conséquences :** la notation et le choix du DP n'en tiennent pas compte.

## DP E3 minimum quel que soit le milieu (2026)
- **Décision :** choix du club, constante `NIVEAU_DP_MINIMUM` dans `FicheSecuriteService`.
- **Écarté :** une colonne du référentiel, car c'est une règle de sécurité générale, pas du MFT.

## Droits sur la fiche de sécurité (2026, V71)
- **Décision :** choix du club, établir ou modifier la fiche est réservé aux E3/E4, aux ADMIN et au nouveau rôle `FICHE_SECURITE` ; la compléter au retour reste ouvert à tous les moniteurs.
- **Conséquences :** lecture seule pour les autres ; le rôle ne fait pas de son titulaire un DP.

## Comptes sécurité surface (V116 pour la démo)
- **Décision :** rôle `SECURITE_SURFACE` pour un compte non moniteur qui complète la fiche au retour d'une sortie, créé depuis l'écran Moniteurs.
- **Conséquences :** démo `surface@club.fr` ; `e2@club.fr` reçoit le rôle `FICHE_SECURITE`.

## E-mail par membre d'un groupe de plongeurs (V44)
- **Décision :** e-mail facultatif par membre ; vide, celui du dossier. Sert à l'envoi des paramètres de fin de séjour.

## Séances liées (V43)
- **Contexte :** deux bateaux le même jour se partagent un groupe.
- **Décision :** `LiaisonSeances` depuis la fiche de sécurité ; un plongeur présent sur deux fiches liées n'est qu'un avertissement.

## Dupliquer et lier une séance (2026)
- **Contexte :** trop de plongeurs pour une fiche ; le DP veut ouvrir un second bateau ou une seconde rotation sans recréer la séance à la main.
- **Décision :** choix du club, depuis la fiche de sécurité : nouvelle séance du même jour et du même endroit, n° de plongée suivant (modifiable), info complémentaire pour chacune, nouveau DP, palanquées choisies déplacées (et non copiées), liaison automatique.
- **Conséquences :** pas de migration (séance, fiche et liaison existantes) ; la duplication part de la fiche enregistrée, pas du formulaire en cours ; réseau obligatoire.

## Fiche imprimée sur le modèle du club : deux tours par page (2026)

- **Contexte** : le club imprime ses fiches sur un modèle Excel (« fiche sécurité Martinique 2026 ») : une seule impression pour les deux plongées de la journée, A4 portrait, une colonne par encadrant plutôt que par palanquée numérotée.
- **Décision** : ce modèle remplace l'ancienne mise en page (A4 paysage, palanquées numérotées cochées d'une croix), en PDF comme en Excel. Calcul pur dans `FeuilleSecurite`, partagé par les deux rendus. Deux plongées du même jour au même lieu (`Seance.lieu`), dans l'ordre des plongées, forment une feuille (1er et 2e tour), sans exiger de liaison ; une 3e plongée ouvre une nouvelle feuille. Colonne = chef de palanquée (guide de palanquée, sinon encadrant), sinon « Autonomes » (la i-ème palanquée d'autonomes de chaque tour partage la i-ème colonne) ; la case dit le tour (« 1 », « 2 », « 1-2 »). Observations = niveau préparé (« PN3 »), sinon « explo ». Au moins 5 colonnes d'encadrants, 3 d'autonomes et 10 lignes, à compléter à la main ; heures prévues et signature du DP restent à la main (la séance n'a pas d'heure).
- **Le PDF est l'Excel redessiné** : `ClasseurHtml` traduit la feuille de `FicheSecuriteExcelService` en HTML (largeurs, hauteurs, fusions, polices, fonds, bordures, logo, en-têtes tournés en parallélogrammes) pour openhtmltopdf, à l'échelle d'une page A4 portrait. Une seule mise en page à maintenir. Écarté : convertir l'Excel par LibreOffice sur le serveur (identique, mais ~400 Mo de plus dans l'image et LibreOffice dans la CI).
- **Regrouper ou non** : une case « Regrouper les 2 plongées du jour sur une feuille », cochée par défaut, dans la fiche complétée, la liste des fiches (impression du jour) et l'écran des sorties (paramètre `regrouper`, vrai par défaut, des quatre exports). Décochée : une feuille par plongée, même modèle. Une feuille d'une seule plongée (case décochée, ou plongée seule ce jour-là) n'a ni « Lieu 2 » ni lignes du 2e tour, et son lieu s'appelle « Lieu ».
- **Conséquences** : par défaut, la fiche d'une plongée s'imprime avec l'autre plongée du jour ; le PDF du jour et de la sortie a deux plongées par page. Les conditions (météo, mer…) et le numéro de plongée ne sont plus imprimés, comme sur le modèle.
- **Passage en paysage (octobre 2026, demande du club)** : même modèle, mais sur une page A4 paysage, en PDF (`@page` de `ClasseurHtml`) comme en Excel (`setLandscape(true)`). Pour remplir la largeur sans tasser le texte, les lignes sont plus basses (plongeurs 20 pt, tours 16 pt, en-têtes tournés 95 pt) et les colonnes Nom, Prénom et surtout Observations plus larges ; la hauteur utile garde une réserve pour les bordures (une feuille pleine, 15 plongeurs et 11 colonnes, tient sur une page). Le texte des en-têtes à 45° part du milieu du bas de sa case, décalé selon sa police, pour rester au milieu de sa bande.

## Proposition automatique des palanquées (2026)
- **Décision :** choix du club, en milieu naturel seulement, calcul pur qui n'écrit rien.
- **Point ouvert :** la lecture des annexes III-16/17 du Code du sport est à confirmer par le club ; l'exploration au-delà de 40 m exige un E4, par prudence.

## Droits sur les groupes de plongeurs (2026, V81)
- **Décision :** choix du club, seuls le créateur (`groupe_plongeurs.createur_id`) et les organisateurs qu'il désigne les modifient ; un ADMIN désigne seulement.
- **Conséquences :** les groupes d'avant V81 n'ont pas de créateur, l'entité n'étant pas auditée. Les autres encadrants gardent la lecture, la reprise dans une fiche et l'envoi des paramètres ; le report nom/e-mail depuis un séjour lié reste ouvert aux organisateurs du séjour.

## Trois niveaux par plongeur d'un groupe (2026, V90)
- **Décision :** demande du club, un plongeur d'un groupe de séjour a un niveau de plongeur (`aptitude`), un niveau d'encadrement (`membre_groupe_plongeurs.niveau_encadrement`, V90) et un niveau préparé (`qualification_preparee`), en texte libre, pré-remplis depuis les plongeurs connus (un encadrant n'a plus son « E2 » dans le niveau de plongeur).
- **Conséquences :** la fiche de sécurité n'a qu'une case aptitude, `core/niveaux-plongeur.ts` y réunit encadrement et niveau à la reprise d'un groupe (« E1 · N4 », l'encadrement d'abord, pour la reconnaissance des encadrants et la proposition des palanquées) et les sépare quand un groupe est créé depuis la fiche (E1 à E4, MF1, MF2 rangés à part). Les groupes déjà saisis gardent leur aptitude telle quelle, sans niveau d'encadrement.

## Reprendre une palanquée d'une autre séance (2026)
- **Décision :** demande du club, une fiche recopie des palanquées de la fiche établie d'une autre séance (n'importe quel jour), dans le navigateur seulement (`core/fiche-securite.ts`, `reprendrePalanquees`) : aucun endpoint, la fiche d'origine est lue comme à l'ouverture (cache hors ligne en repli) et rien n'est enregistré avant « Enregistrer la fiche ».
- **Conséquences :** plongeurs (aptitude, fonction, gaz, désaturation, qualification) et profil prévu sont repris, numérotés à la suite ; le profil réalisé et les observations des plongeurs, propres au jour plongé, ne le sont pas. À distinguer de « Dupliquer et lier », qui déplace des palanquées vers une nouvelle séance du même jour.

## Composer les palanquées : fonction, profil prévu, aptitude, nom (2026)
- **Décision :** demandes du club. L'ajout d'un encadrant possible (compte moniteur, ou aptitude E1 à E4, MF1/MF2, GP, N4, N5 : `estEncadrantPossible`) demande sa fonction dans la palanquée. Une nouvelle palanquée se crée avec sa profondeur et sa durée prévues (`erreurProfilPrevu`). L'ajout d'un plongeur au-delà de son aptitude est refusé (`refusAjout`, `profondeurPermise` : mêmes prérogatives qu'`AptitudePlongeur`, plus la profondeur encadrée du niveau préparé). Une palanquée porte le nom de son encadrant, à défaut de son guide (`nomPalanquee`), sinon son numéro.
- **Conséquences :** tout est dans le navigateur (`core/fiche-securite.ts`), au moment de l'ajout (choix dans « Plongeur du club », placement ou glisser depuis un groupe, déplacement). Le serveur n'ajoute pas de refus à l'enregistrement : une aptitude non reconnue n'est pas refusée, et une profondeur modifiée après coup reste un avertissement sous le plongeur. Le numéro de palanquée reste l'identifiant enregistré ; la fiche imprimée, déjà en colonnes par encadrant, ne change pas.

## Palanquées fermées par défaut, une seule fenêtre d'ajout (2026)
- **Décision :** demande du club, toutes les palanquées s'affichent fermées (résumé, une ligne par plongeur), à l'ouverture de la fiche comme à leur création ; on touche le nom pour ouvrir. Le profil prévu d'une nouvelle palanquée et la fonction d'un encadrant ajouté se demandent dans une même fenêtre, qui ne pose que les questions du cas rencontré (`questionsAjout`) : profil seul pour une palanquée vide, profil et fonction pour un encadrant placé ou déplacé dans une nouvelle palanquée, fonction seule pour un encadrant ajouté à une palanquée existante.
- **Conséquences :** dans la fenêtre combinée, « Encadrant » est choisi d'avance et la fonction s'applique à la création ; seule, la fonction reste un choix en un geste (fermer la laisse « Plongeur »). Une palanquée vide fermée accepte toujours qu'on y glisse ou place un plongeur.
