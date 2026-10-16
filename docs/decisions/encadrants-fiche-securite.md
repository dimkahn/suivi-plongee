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

## Proposition automatique des palanquées (2026)
- **Décision :** choix du club, en milieu naturel seulement, calcul pur qui n'écrit rien.
- **Point ouvert :** la lecture des annexes III-16/17 du Code du sport est à confirmer par le club ; l'exploration au-delà de 40 m exige un E4, par prudence.

## Droits sur les groupes de plongeurs (2026, V81)
- **Décision :** choix du club, seuls le créateur (`groupe_plongeurs.createur_id`) et les organisateurs qu'il désigne les modifient ; un ADMIN désigne seulement.
- **Conséquences :** les groupes d'avant V81 n'ont pas de créateur, l'entité n'étant pas auditée. Les autres encadrants gardent la lecture, la reprise dans une fiche et l'envoi des paramètres ; le report nom/e-mail depuis un séjour lié reste ouvert aux organisateurs du séjour.
