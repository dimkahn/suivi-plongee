-- ============================================================
--  Parcours de formation du N3 (MFT PA40 | PE60, base d'exercices
--  V61), sur le modèle de V65 (N1) et V67 (N2) :
--
--  1. Conseils de l'encadrant pour chacun des 63 exercices, écrits
--     seulement là où l'écran d'admin n'a encore rien mis.
--  2. Exercices de chaque période de la progression type du club
--     (V22) : de septembre à avril, ce qui se prépare au sec, en
--     piscine ou en fosse (planification, ordinateur, organisation,
--     reconnaissance des difficultés, nage capelée) ; en mai-juin, en
--     milieu naturel, tout ce qui se pratique en profondeur, dont toutes
--     les maîtrises (le N3 ne s'acquiert qu'en milieu naturel : 0-40 m
--     avec un E3, zone 40-60 m sous la responsabilité d'un E4,
--     progressivement). Les blocs des périodes ne changent pas.
--
--  Exercices désignés par leur numéro, périodes par leur rang ; tout
--  passe par des sous-requêtes. Ensuite, conseils et parcours se
--  modifient depuis /admin/exercices et /admin/progressions : ne pas
--  retoucher ce fichier une fois appliqué.
-- ============================================================

-- ---------- 1. Conseils ----------

-- Tables de travail, supprimées en fin de migration.
CREATE TABLE conseil_n3 (numero VARCHAR(10) PRIMARY KEY, texte TEXT NOT NULL);

INSERT INTO conseil_n3 (numero, texte) VALUES
-- 1. Planifier la plongée (PA40)
('1.1', 'Briefing réaliste, chiffres à l''appui, sans notes pour l''élève. Faire préciser ce qui change entre 20 et 40 m : consommation, paliers probables, narcose, durée de remontée.'),
('1.2', 'Partir des sites réels du club. Faire justifier le choix de l''orientation (compas, relief, lumière) selon la visibilité et le courant attendus.'),
('1.3', 'Calculs pour comprendre l''autonomie réelle à 40 m, pas pour planifier au litre près. Faire comparer l''effet de deux réglages de GF sur les paliers proposés par un même ordinateur.'),
('1.4', 'Faire passer tous les ordinateurs de la palanquée sur le même profil : les écarts de paliers parlent d''eux-mêmes. Règle : la palanquée suit le plus contraignant.'),
('1.5', 'Le protocole se décide à terre et s''applique tel quel sous l''eau : vérifier en plongée que les annonces convenues sont bien faites, et débriefer les écarts.'),
('1.6', 'Site à repères nets, peu de courant. Moniteur en retrait mais en vue ; au débriefing, comparer le parcours réel au plan, croquis à l''appui.'),
('1.7', 'L''élève présente avant la mise à l''eau, sans aide. Évaluer l''argumentation autant que le contenu : il doit pouvoir répondre à « et si… ? ».'),
('1.8', 'Changer une consigne réaliste juste avant la plongée. Évaluer la capacité à replanifier vite, sans sortir du cadre du DP.'),
('1.9', 'Un vrai site inconnu de la palanquée ; laisser chercher l''information. Le moniteur vérifie la faisabilité avant de valider le plan.'),
-- 2. Évoluer en autonomie (PA40)
('2.1', 'Combiner instrument et milieu : couper le compas sur une portion du trajet pour obliger à lire le relief et la lumière. Retour au point de départ vérifié avant la remontée.'),
('2.2', 'Fixer à terre la place de chacun et la fréquence des contrôles. En immersion, observer si chacun regarde vraiment ses équipiers et leurs paramètres.'),
('2.3', 'Utiliser de vraies captures d''écran, profils inversés et yoyo compris. Faire dire le risque et la conduite à tenir pour chaque profil.'),
('2.4', 'Moniteur en retrait, prêt à intervenir. Évaluer la cohésion et le retour près du bateau ; un écart d''itinéraire s''analyse au débriefing, pas sous l''eau.'),
('2.5', 'Annoncer l''imprévu clairement, sans le rendre dangereux. Évaluer la décision : rapide, partagée, prudente ; renoncer est une bonne réponse.'),
('2.6', 'Parachute lancé stabilisé, dévidoir tenu. Paliers du moyen le plus contraignant ; arrêt et tour d''horizon à 3 m, palanquée groupée sous le parachute.'),
('2.7', 'Au moins deux situations différentes près de 40 m, moniteur observateur. Rappeler que l''autonomie n''exclut pas de renoncer : profondeur et durée restent celles du DP.'),
('2.8', 'Composer volontairement une palanquée aux ordinateurs différents. Vérifier que chacun connaît la procédure commune avant l''immersion.'),
('2.9', 'Oral court à partir de captures d''écran ; l''élève dit ce qu''il ferait. Valoriser les réponses prudentes et argumentées.'),
-- 3. Intervenir et porter assistance (PA40)
('3.1', 'Simulations crédibles sans signe ; faire décrire ce qu''on voit avant de conclure. Insister sur la perte de vigilance, propre à la profondeur (narcose).'),
('3.2', 'Prise ferme face à l''assisté. Erreur fréquente : gonfler trop et accélérer ; purger tôt et souvent, vitesse régulière, arrêt marqué entre 5 et 3 m.'),
('3.3', 'Allure régulière, sans chronomètre, gilet légèrement gonflé. Préparer progressivement la nage de 300 m (3.9).'),
('3.4', 'Vitesse adaptée aux moyens de désaturation ; encadrant de sécurité à proximité. Sur le trajet, surveiller l''assisté autant que la vitesse.'),
('3.5', 'Départ rapide pour sortir de la zone profonde, puis régulation dès 30 m environ : c''est la reprise en main de la vitesse qui est évaluée. Ne pas enchaîner plusieurs remontées.'),
('3.6', 'Octopus donné aussitôt, stabilisation avant toute remontée. À 30 m, la consommation de l''assisté est forte : ne pas traîner.'),
('3.7', 'À réaliser au moins deux fois, en fin de formation, dans des conditions variées. Gilets privilégiés, palmage autorisé ; un encadrant libre à proximité. Limiter le nombre de remontées par jour.'),
('3.8', 'Situation vraiment différente de 3.7 (panne d''air, perte de vigilance). Réalisée en entier, jusqu''à la sortie de l''eau sécurisée.'),
('3.9', 'Pas d''épreuve chronométrée : on évalue la forme à l''arrivée. Plan d''eau sans trafic, surveillance de surface.'),
-- 4. S'adapter à la profondeur (PE60)
('4.1', 'L''écrasement de la combinaison change la flottabilité : faire régler le gilet en conséquence. Palmes immobiles, affinage au poumon ballast.'),
('4.2', 'Revoir tous les gestes du PE40 avant d''aller plus profond. Un geste qui génère du stress à 20-30 m n''ira pas mieux à 40 m.'),
('4.3', 'Descente progressive vers 35 m, guide à côté. Faire signaler la narcose sans gêne : la reconnaître est le but. Remonter de quelques mètres au moindre doute.'),
('4.4', 'Arrêts annoncés à des profondeurs variées, chacun à ± 1 m. Surveiller la vitesse de descente et l''anticipation de l''injection.'),
('4.5', 'Le guide pose ses questions en profondeur ; l''élève annonce aussi ses seuils de lui-même. Narcose : faire répéter une réponse pour vérifier la lucidité.'),
('4.6', 'Priorité : ne pas descendre et assurer la flottabilité jusqu''à l''arrivée du guide. Situation annoncée au briefing.'),
('4.7', 'Évaluation par un E3, à 40 m au plus. Observer la stabilisation à toutes les étapes, palier compris.'),
('4.8', 'Sous la responsabilité d''un E4, profondeur augmentée d''une plongée à l''autre, jamais d''un coup. Consignes de consommation et de retour strictes.'),
('4.9', 'Fixer les seuils au briefing (consommation, durée de remontée). Aucun seuil ne doit être franchi sans annonce ; débriefer avec les ordinateurs.'),
-- 5. Organiser la plongée (N3)
('5.1', 'Bulletins réels du jour et cartes du site. Faire aussi décider de renoncer : un bon choix de site, c''est parfois aucun.'),
('5.2', 'Matériel réel du club : oxygène (pression, masques), trousse, moyens de communication. Lien avec le RIFA Plongée ; signaler tout manque.'),
('5.3', 'Fiche de sécurité d''une sortie fictive complète : palanquées, paramètres, heures, moyens d''alerte. Comparer à une fiche réelle du club.'),
('5.4', 'Sur le terrain, comparer deux sites selon la météo du jour. Évaluer la prudence du choix, argumentée.'),
('5.5', 'Vérifier ensemble la conformité de l''embarcation et le pavillon alpha ; organiser la surveillance de surface avant la première mise à l''eau.'),
('5.6', 'Scénario joué à blanc, chacun à son rôle : alerte, oxygène, communication, évacuation. Chronométrer l''alerte pour mesurer les délais réels.'),
('5.7', 'Plongée réelle du bord, organisée par l''élève sans DP, dans la zone 0-40 m. Le moniteur vérifie la faisabilité et la sécurité avant la mise à l''eau.'),
('5.8', 'Depuis une embarcation : mouillage, pavillon, surveillance, rotation des palanquées. Le moniteur garde la responsabilité réelle de la sortie.'),
('5.9', 'Choisir une journée où les conditions évoluent. Renoncer est une décision valable si elle est justifiée.'),
-- 6. Évoluer en autonomie 0-60 m (N3)
('6.1', 'Parcours à plusieurs caps : faire anticiper chaque changement de cap. Retour au point prévu vérifié avant la remontée.'),
('6.2', 'Planifier une plongée profonde avec les ordinateurs de la palanquée ; réserve suffisante pour une remontée assistée. Rappeler le conservatisme recommandé à l''air.'),
('6.3', 'Briefing entre équipiers mené par les élèves : rôles, signes, conduite en cas d''imprévu. Le moniteur ne complète qu''à la fin.'),
('6.4', 'À 35-40 m, la consommation monte vite : contrôles plus fréquents. Itinéraire simple, repères nets.'),
('6.5', 'Palanquée aux moyens différents : la procédure la plus contraignante s''applique à tous. Parachute lancé pour signaler les paliers.'),
('6.6', 'Simulation annoncée au briefing. Évaluer la réaction de la palanquée : remonter de quelques mètres, ralentir, écourter la plongée.'),
('6.7', 'À 40 m au plus, au moins deux situations : on exige le comportement de la zone 40-60 m (consommation, désaturation, co-gestion).'),
('6.8', 'En présence d''un DP, sous la responsabilité d''un E4, profondeur augmentée progressivement. Aucune consigne dépassée ; débriefing des paramètres à chaque plongée.'),
('6.9', 'Retour planifié : vitesse, paliers, parachute, arrêt et tour d''horizon à 3 m, retour près du bateau. Palanquée groupée jusqu''en surface.'),
-- 7. Respecter le milieu et l'environnement
('7.1', 'En profondeur, l''écrasement de la combinaison rend la stabilisation plus délicate : régler le gilet avant d''approcher le fond.'),
('7.2', 'Espèces locales et protégées, avec photos. Les dangers du milieu (courant, faune) relèvent aussi de la sécurité.'),
('7.3', 'Lampe à côté de l''animal, jamais dans ses yeux. Déplacements lents ; aucun nourrissage.'),
('7.4', 'À 30 m, distance d''un mètre au moins, attention au demi-tour. Pas d''entrée dans une épave au N3 sans formation spécifique.'),
('7.5', 'La palanquée autonome observe sans se disperser : un seul montre, les autres regardent. Cohésion gardée.'),
('7.6', 'Palmage de grenouille et recul près des fonds sensibles ; faire regarder derrière soi. Aucun nuage de sédiment.'),
('7.7', 'Plongée consacrée à l''observation ; les autres exercices attendent. En surface, nommer et décrire les espèces vues.'),
('7.8', 'Choisir un site fragile adapté au niveau. Être aussi exigeant au palier qu''au fond.'),
('7.9', 'Observation continue, bilan régulier au débriefing. L''encadrant montre l''exemple.');

UPDATE exercice_competence
   SET conseils = (SELECT c.texte FROM conseil_n3 c WHERE c.numero = exercice_competence.numero)
 WHERE conseils IS NULL
   AND numero IN (SELECT numero FROM conseil_n3)
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)');

DROP TABLE conseil_n3;

-- ---------- 2. Exercices de chaque période ----------

CREATE TABLE parcours_n3 (rang INT NOT NULL, numero VARCHAR(10) NOT NULL);

INSERT INTO parcours_n3 (rang, numero) VALUES
-- 1. Reprise, prérogatives et planification (septembre - octobre)
(1, '1.1'), (1, '1.2'), (1, '1.3'), (1, '1.4'), (1, '1.5'),
(1, '2.2'), (1, '2.3'),
-- 2. Assistance (novembre - décembre)
(2, '3.1'), (2, '3.3'),
-- 3. Profondeur et organisation (janvier - février)
(3, '5.1'), (3, '5.2'), (3, '5.3'), (3, '5.6'),
(3, '6.2'),
-- 4. Autonomie et environnement (mars - avril)
(4, '6.3'), (4, '7.2'),
-- 5. Milieu naturel : PA40, PE60 et N3 (mai - juin)
(5, '1.6'), (5, '1.7'), (5, '1.8'), (5, '1.9'),
(5, '2.1'), (5, '2.4'), (5, '2.5'), (5, '2.6'), (5, '2.7'), (5, '2.8'), (5, '2.9'),
(5, '3.2'), (5, '3.4'), (5, '3.5'), (5, '3.6'), (5, '3.7'), (5, '3.8'), (5, '3.9'),
(5, '4.1'), (5, '4.2'), (5, '4.3'), (5, '4.4'), (5, '4.5'), (5, '4.6'), (5, '4.7'), (5, '4.8'), (5, '4.9'),
(5, '5.4'), (5, '5.5'), (5, '5.7'), (5, '5.8'), (5, '5.9'),
(5, '6.1'), (5, '6.4'), (5, '6.5'), (5, '6.6'), (5, '6.7'), (5, '6.8'), (5, '6.9'),
(5, '7.1'), (5, '7.3'), (5, '7.4'), (5, '7.5'), (5, '7.6'), (5, '7.7'), (5, '7.8'), (5, '7.9');

INSERT INTO periode_progression_exercice (periode_id, exercice_id)
SELECT pp.id, e.id
  FROM parcours_n3 v
  JOIN periode_progression pp ON pp.rang = v.rang
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
  JOIN exercice_competence e ON e.bloc_id = b.id AND e.numero = v.numero
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)'
   AND p.nom = 'N3 – progression type du club'
   AND NOT EXISTS (SELECT 1 FROM periode_progression_exercice x
                    WHERE x.periode_id = pp.id AND x.exercice_id = e.id);

DROP TABLE parcours_n3;
