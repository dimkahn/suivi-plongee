-- ============================================================
--  Parcours de formation du N2 (MFT PA20 | PE40, base d'exercices
--  V59), sur le modèle de V65 pour le N1 :
--
--  1. Conseils de l'encadrant pour chacun des 99 exercices, écrits
--     seulement là où l'écran d'admin n'a encore rien mis.
--  2. Exercices de chaque période de la progression type du club
--     (V22) : en fosse de septembre à avril l'initiation et le
--     perfectionnement, compétence par compétence ; en mai-juin, en
--     milieu naturel, tout ce qui ne se fait qu'en mer ou en lac, dont
--     toutes les maîtrises (le N2 ne s'acquiert qu'en milieu naturel,
--     une note en fosse n'est qu'un suivi d'entraînement). Les blocs
--     des périodes ne changent pas.
--
--  Exercices désignés par leur numéro, périodes par leur rang ; tout
--  passe par des sous-requêtes. Ensuite, conseils et parcours se
--  modifient depuis /admin/exercices et /admin/progressions : ne pas
--  retoucher ce fichier une fois appliqué.
-- ============================================================

-- ---------- 1. Conseils ----------

-- Tables de travail, supprimées en fin de migration.
CREATE TABLE conseil_n2 (numero VARCHAR(10) PRIMARY KEY, texte TEXT NOT NULL);

INSERT INTO conseil_n2 (numero, texte) VALUES
-- 1. S'équiper - se mettre à l'eau et en sortir
('1.1', 'Faire justifier chaque choix par la plongée annoncée (température, profondeur, durée) plutôt que valider une liste. Erreur fréquente : oublier le parachute de palanquée ou un octopus mal placé. Au dégréage, faire purger avant de dévisser et ranger le matériel au sec.'),
('1.2', 'La vérification croisée devient l''affaire de la palanquée : laisser les élèves la conduire. Vérifier que l''octopus est accessible et identifiable, et que l''ordinateur est bien allumé et réglé à l''air.'),
('1.3', 'Rappeler la vérification de la zone avant chaque entrée. À l''échelle, palmes retirées dans l''eau en gardant une main sur l''échelle et le détendeur en bouche : une vague peut surprendre.'),
('1.4', 'Le temps limité révèle les oublis : ne pas aider, noter, puis débriefer. Exiger que chacun regarde aussi l''équipier : au N2, on veille sur la palanquée.'),
('1.5', 'Une main toujours sur le gilet. Si l''élève s''essouffle en recapelant, stopper, gilet bien gonflé, puis reprendre calmement. Prévoir un équipier attentif qui reçoit le bloc.'),
('1.6', 'Sécurité du bateau : moteur au point mort, zone de chute dégagée, mise à l''eau au signal du DP seulement. Avec de la houle, monter à l''échelle entre deux vagues, sans jamais lâcher l''échelle.'),
('1.7', 'Observer sans intervenir, sauf danger. Évaluer la chronologie complète et l''attention portée à l''équipier, puis débriefer à terre avec l''élève.'),
('1.8', 'Choisir une anomalie sans danger et vérifier soi-même avant la mise à l''eau. Évaluer la méthode de contrôle autant que la découverte ; changer d''anomalie à chaque fois.'),
('1.9', 'Varier vraiment les sites pour que l''élève adapte sa technique (plage, bord rocheux, bateau). Faire anticiper la sortie dès le briefing.'),
-- 2. S'immerger - se propulser - se ventiler
('2.1', 'Exiger l''immersion au signal, tous ensemble : la cohésion est le vrai sujet. Un élève qui ne descend pas en phoque : vérifier le lestage et le vidage complet du gilet.'),
('2.2', 'Allure régulière, pas de vitesse : un élève essoufflé ralentit et allonge son expiration. Varier ventral, dorsal et costal pour garder un geste ample.'),
('2.3', 'Moniteur face à l''élève, prêt à freiner. Expiration continue et modérée, jamais bloquée ni forcée. Pas de REC après des apnées répétées.'),
('2.4', 'Faire anticiper l''arrêt : injecter avant d''arriver à la profondeur annoncée. Erreur fréquente : yo-yo au gilet ; petites injections, attendre, affiner au poumon ballast.'),
('2.5', 'Le palmage économique se voit à la ventilation : faire parler l''élève de son ressenti. Contre le courant, privilégier une progression près du fond, à l''abri, plutôt qu''un effort en pleine eau.'),
('2.6', 'Encadrant face à l''élève tout du long, une main prête. En fosse, rappeler que la note ne compte qu''à l''entraînement. Vitesse correcte avant tout, sans critère de temps.'),
('2.7', 'Le GP ne répète pas sa consigne : évaluer l''écoute et la cohésion. À la descente, surveiller l''équilibrage des oreilles et la distance entre élèves.'),
('2.8', 'Aucun chronomètre : on évalue la forme à l''arrivée. Choisir un plan d''eau sans trafic et faire accompagner en surface.'),
('2.9', 'Milieu naturel, 10 m au plus. Encadrant à côté de l''élève pendant toute la remontée. Si l''élève remonte trop vite, il palme trop ou garde de l''air dans le gilet : faire purger avant le départ.'),
-- 3. Respecter le milieu et l'environnement
('3.1', 'Un contact avec le fond révèle un défaut de lestage ou d''équilibre : corriger ces réglages avant le palmage. Palmes immobiles pendant la stabilisation.'),
('3.2', 'Palmes hautes et genoux fléchis pour le palmage de grenouille. Faire regarder derrière soi : aucun nuage ne doit se lever.'),
('3.3', 'Utiliser les espèces réellement rencontrées sur les sites du club. Insister sur les espèces à risque, qui relèvent aussi de la sécurité.'),
('3.4', 'Distance d''un mètre au moins et attention aux palmes au demi-tour. Près d''une épave, pas d''entrée dans les structures au N2.'),
('3.5', 'L''élève montre sans toucher et sans poursuivre ; la lampe éclaire à côté de l''animal, pas dans ses yeux. Débriefer les espèces vues.'),
('3.6', 'Vitesse lente imposée : la précision compte plus que le temps. Un contact : revenir à la stabilisation avant de reprendre.'),
('3.7', 'Plongée consacrée à l''observation : réduire les autres exercices. Faire nommer et décrire en surface, avec un guide d''identification si besoin.'),
('3.8', 'Choisir un milieu vraiment fragile mais sans difficulté technique. Être exigeant au palier aussi : on y touche souvent le fond ou l''herbier.'),
('3.9', 'Observation sur toutes les plongées, bilan régulier au débriefing. Montrer l''exemple : le comportement s''apprend par imitation.'),
-- 4. Être attentif au matériel de ses équipiers
('4.1', 'Partir d''un détendeur démonté ou d''un schéma : l''élève explique avec ses mots, sans calcul. Faire le lien avec ce qui arrive en cas de débit continu et la conduite à tenir.'),
('4.2', 'Tester en fin de plongée, bloc à 50 bar environ, gilet vide. Faire noter au carnet avec l''épaisseur de combinaison et le type de bloc.'),
('4.3', 'Chacun présente, l''équipier écoute et pose des questions. Vérifier que l''emplacement de l''octopus est connu de tous.'),
('4.4', 'Utiliser du matériel inhabituel (purge basse, inflateur différent, ordinateur d''une autre marque). L''élève cherche seul, le moniteur ne répond qu''aux questions.'),
('4.5', 'Contrôle spontané, sans rappel : c''est le réflexe qui est évalué. Valoriser l''annonce d''une anomalie, même mineure.'),
('4.6', 'Faire établir la liste du matériel obligatoire en autonomie (moyen de désaturation, parachute, octopus, contrôle de la pression) puis comparer au matériel réel de la palanquée.'),
('4.7', 'Le briefing matériel doit devenir un réflexe avant chaque plongée en autonomie : le faire mener par les élèves, sans questions du moniteur.'),
('4.8', 'Annoncer le changement à l''avance pour que l''élève ajuste à terre. Vérifier au palier de 3 m, bloc presque vide : tenu sans effort ni palmage.'),
('4.9', 'Oral court, au bord, matériel des équipiers en main. On attend la compréhension du principe et des différences entre modèles, pas une récitation.'),
-- 5. Évoluer en autonomie
('5.1', 'Ordinateurs des élèves en main : chacun trouve chaque affichage sur le sien. Insister sur la durée sans palier et l''indicateur de vitesse, qui guideront leurs remontées.'),
('5.2', 'Faire planifier la même plongée sur tous les ordinateurs : les écarts convainquent mieux qu''une explication. Règle : la palanquée suit le plus conservateur.'),
('5.3', 'Stabilisé avant de lancer, dévidoir tenu, jamais attaché à soi. Erreur fréquente : gonfler trop tôt ou trop, et se faire entraîner : peu d''air, lâcher franc, rester à sa profondeur.'),
('5.4', 'Moniteur en retrait mais toujours à portée d''intervention. Profondeur limitée et site connu. Débriefer les contrôles de paramètres oubliés.'),
('5.5', 'Lancer stabilisé à 5-6 m, puis remonter le long du bout sans se faire tirer. Faire surveiller l''ordinateur pendant la remontée.'),
('5.6', 'Problèmes simples, dans le cadre du MFT : pas de plongée successive complexe. Le raisonnement compte plus que le résultat.'),
('5.7', 'Le moniteur suit à distance, prêt à intervenir. Consignes du DP connues de tous ; évaluer la cohésion et la gestion des paramètres. Débriefing systématique.'),
('5.8', 'Parachute lancé au palier, palanquée regroupée. En surface : tour d''horizon et attention au bateau, hélice arrêtée avant toute approche.'),
('5.9', 'Introduire une seule difficulté à la fois (visibilité, courant ou site nouveau). Interroger à l''oral sur des situations concrètes : que faites-vous si… ?'),
-- 6. Planifier la plongée
('6.1', 'Briefing de DP réaliste, avec des chiffres : l''élève reformule sans les notes. Faire préciser la pression de retour et la durée totale de remontée maximale.'),
('6.2', 'Visée bras tendu, compas à plat. Erreur fréquente : suivre la direction du regard au lieu du cap. Faire compter les pas pour estimer la distance.'),
('6.3', 'Calculs pour comprendre, pas pour planifier au litre près. Faire comparer la consommation au fond et au palier, et justifier la réserve.'),
('6.4', 'La palanquée décide elle-même dans le cadre du DP. Vérifier que le protocole de contrôle des consommations est clair pour tous.'),
('6.5', 'En binôme, l''un tient le compas, l''autre surveille et compte les cycles de palmage. Retour près du départ : un écart s''analyse au débriefing.'),
('6.6', 'Partir d''un croquis du site du club, puis vérifier sous l''eau en plongée accompagnée. Faire repérer des points remarquables pour le retour.'),
('6.7', 'Faire présenter la planification à voix haute, devant la palanquée. Évaluer la cohérence avec les consignes du DP et les procédures prévues à chaque étape.'),
('6.8', 'Choisir un site avec des repères nets et peu de courant. Retour au point de départ : le moniteur vérifie la position avant la remontée.'),
('6.9', 'La palanquée réalise ce qu''elle a planifié ; le moniteur n''intervient qu''en cas de danger. Débriefer les écarts avec l''ordinateur en main.'),
-- 7. Intervenir et porter assistance
('7.1', 'Simuler des situations sans signe, de façon crédible. Faire décrire ce qu''on voit (ventilation, comportement) avant de conclure.'),
('7.2', 'Prise ferme face à l''assisté, une main sur son inflateur, l''autre sur sa purge. Erreur fréquente : gonfler trop et accélérer ; purger tôt et souvent.'),
('7.3', 'Octopus donné sans hésiter, puis tenue par le gilet avant de remonter. Vérifier que l''assisté respire bien avant le départ.'),
('7.4', 'Arrêt marqué entre 5 et 3 m, vitesse régulière. Encadrant de sécurité à proximité. En fosse, la note reste au suivi d''entraînement.'),
('7.5', 'La difficulté survient pendant le déplacement, sans prévenir : évaluer la rapidité de réaction et la douceur de la prise en charge.'),
('7.6', 'En surface : gilets gonflés, signe de détresse, remorquage par le gilet ou le robinet. Aide au déséquipement dans l''eau avant la sortie.'),
('7.7', 'À réaliser au moins deux fois en fin de formation, dans des conditions variées. Vitesse adaptée aux moyens de désaturation ; palmage autorisé, gilets privilégiés. Sécurité : un encadrant libre à proximité.'),
('7.8', 'Situation différente de 7.7, réalisée jusqu''à la sortie de l''eau. Évaluer l''enchaînement complet, sans arrêt inutile.'),
('7.9', 'Partir de cas réels ou réalistes. Insister sur la prévention et la conduite à tenir ; les facteurs favorisants de l''accident de désaturation se discutent avec les profils des élèves.'),
-- 8. Se ventiler - s'équilibrer
('8.1', 'Enchaîner sans pause tuba-embout puis embout-tuba : c''est l''enchaînement qui est travaillé. Expiration à la remontée, toujours.'),
('8.2', 'Sans appui au fond : la stabilisation fait partie de l''exercice. Un élève qui descend pendant le vidage a trop peu d''air dans le gilet ; qui remonte en a trop.'),
('8.3', 'Gilet bien réglé avant de commencer. Monter en inspirant plus, descendre en expirant plus, sans apnée.'),
('8.4', 'Doser l''effort et faire signaler le début d''essoufflement : arrêt, expiration longue, récupération. Ne jamais pousser jusqu''à l''essoufflement réel.'),
('8.5', 'En pleine eau, sans repère : faire lire l''ordinateur avant et après. Reprendre l''évolution immédiatement après.'),
('8.6', 'Annoncer des profondeurs proches et variées. Réglage au gilet d''abord, affinage au poumon ballast ensuite ; chaque arrêt tenu à ± 1 m.'),
('8.7', 'À 20 m, le VDM se fait plus lentement : rappeler le calme. Varier les situations (stabilisé, en déplacement, après lâcher d''embout).'),
('8.8', 'Progressivité impérative dans l''espace 0-40 m, sous la responsabilité d''un E3. Surveiller les signes de narcose et la consommation ; remonter au moindre doute.'),
('8.9', 'Observer la stabilité à toutes les étapes, y compris au palier où l''attention retombe. Un palmage permanent pour tenir sa profondeur révèle un mauvais réglage.'),
-- 9. Communiquer avec le guide de palanquée
('9.1', 'Faire faire les signes, pas seulement les montrer. Insister sur les signes propres à la plongée profonde : narcose, consommation, paliers.'),
('9.2', 'Cartes-consignes variées et ordre aléatoire. Exiger un signe net, dans le champ de vision du moniteur.'),
('9.3', 'Le GP donne ses consignes une fois ; l''élève reformule. Faire dire ce qu''il annoncera et à quel moment.'),
('9.4', 'Le GP pose les questions à des moments variés. Évaluer la clarté et la rapidité de la réponse.'),
('9.5', 'Fixer au briefing les seuils à annoncer. L''annonce doit venir de l''élève, sans sollicitation ; débriefer les annonces tardives.'),
('9.6', 'Après une descente plus profonde, demander le ressenti en immersion puis au débriefing. Rassurer : signaler une narcose n''est pas un échec.'),
('9.7', 'Profondeur augmentée progressivement jusqu''à 40 m, sous la responsabilité d''un E3. Évaluer l''ensemble des échanges, à terre et en plongée.'),
('9.8', 'Changer la consigne sans prévenir au briefing (demi-tour, remontée, limite de profondeur). Évaluer la compréhension et l''exécution sans délai.'),
('9.9', 'Laisser l''élève restituer d''abord ses paramètres et son ressenti, puis compléter. Comparer avec l''ordinateur.'),
-- 10. Retourner en surface
('10.1', 'Ordinateurs en mode simulation, chacun sur le sien. Faire trouver la durée totale de remontée et les paliers à différents moments d''une plongée simulée.'),
('10.2', 'Principes seulement, sans calcul de table : vitesse de remontée, palier, types de plongée. Faire le lien avec l''ordinateur.'),
('10.3', 'Main sur le bout, œil sur l''indicateur de vitesse. Erreur fréquente : accélérer en fin de remontée ; ralentir au contraire près de la surface.'),
('10.4', 'Le GP demande, puis l''élève annonce de lui-même. Vérifier la justesse en comparant à l''ordinateur au débriefing.'),
('10.5', 'Moniteur à côté, à la vitesse de l''élève. Faire purger régulièrement : l''air du gilet se dilate en remontant. Tour d''horizon avant la surface.'),
('10.6', 'Planifier la plongée pour qu''un palier obligatoire apparaisse, avec le GP. L''élève suit l''évolution de ses paramètres et gère son palier selon son ordinateur.'),
('10.7', 'Moniteur à proximité, prêt à intervenir, sans aider. Évaluer toute la séquence : vitesse, palier, tour d''horizon, gilet gonflé, signal, sortie.'),
('10.8', 'Fréquence de contrôle adaptée à la profondeur : plus souvent quand on est profond. Annonces au GP sans sollicitation.'),
('10.9', 'Restitution au DP juste après la plongée, chiffres exacts. Question orale courte sur la table fédérale.'),
-- 11. Intervenir en relais sur un équipier
('11.1', 'Présenter le deuxième détendeur, embout dans le bon sens, puis tenir l''équipier par le gilet. Changer les rôles à chaque passage.'),
('11.2', 'Reliés par l''octopus, le gilet tient la profondeur : surveiller la tendance à descendre. Un seul gère le gilet, idéalement celui qui donne l''air.'),
('11.3', 'Déplacement calme, face à face ou côte à côte selon le flexible. Profondeur gardée pendant tout le trajet.'),
('11.4', 'Panne d''air simulée sans prévenir. Évaluer la rapidité et le confort de l''équipier ; GP prêt à intervenir.'),
('11.5', 'Simulation claire, annoncée au briefing. L''élève stabilise, rassure, empêche la descente et prévient le GP : il n''a pas à remonter seul avec l''équipier.'),
('11.6', 'Signe pendant le déplacement : évaluer la profondeur gardée et la rapidité. Un élève qui descend en intervenant : reprendre 11.2.'),
('11.7', 'Les trois actions dans l''ordre : prise en charge, profondeur maintenue, déplacement jusqu''au GP. En fin de formation, dans des conditions variées.'),
('11.8', 'Tirer au sort mais garder des situations crédibles. Évaluer l''action choisie, adaptée à chaque situation.'),
('11.9', 'Dans l''espace 0-40 m, sous la responsabilité d''un E3, progressivement. Priorité : ne pas augmenter la profondeur et assurer la flottabilité jusqu''à l''arrivée du GP.');

UPDATE exercice_competence
   SET conseils = (SELECT c.texte FROM conseil_n2 c WHERE c.numero = exercice_competence.numero)
 WHERE conseils IS NULL
   AND numero IN (SELECT numero FROM conseil_n2)
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)');

DROP TABLE conseil_n2;

-- ---------- 2. Exercices de chaque période ----------

CREATE TABLE parcours_n2 (rang INT NOT NULL, numero VARCHAR(10) NOT NULL);

INSERT INTO parcours_n2 (rang, numero) VALUES
-- 1. Reprise et remise à niveau (septembre - octobre, fosse)
(1, '1.1'), (1, '1.2'), (1, '1.3'), (1, '1.4'), (1, '1.5'),
(1, '2.1'), (1, '2.2'), (1, '2.3'), (1, '2.5'),
-- 2. Stabilisation, matériel et communication (novembre - décembre)
(2, '4.1'), (2, '4.2'), (2, '4.3'), (2, '4.4'), (2, '4.5'), (2, '4.6'),
(2, '8.1'), (2, '8.2'), (2, '8.3'), (2, '8.5'), (2, '8.6'),
(2, '9.1'), (2, '9.2'), (2, '9.3'),
-- 3. Remontée, planification et autonomie (janvier - février)
(3, '2.6'),
(3, '5.1'), (3, '5.2'), (3, '5.3'), (3, '5.5'), (3, '5.6'),
(3, '6.1'), (3, '6.2'), (3, '6.3'), (3, '6.4'), (3, '6.5'),
(3, '10.1'), (3, '10.2'), (3, '10.3'),
-- 4. Assistance et relais (mars - avril)
(4, '3.1'), (4, '3.2'), (4, '3.3'), (4, '3.6'),
(4, '7.1'), (4, '7.2'), (4, '7.3'), (4, '7.4'), (4, '7.5'), (4, '7.6'),
(4, '11.1'), (4, '11.2'), (4, '11.3'),
-- 5. Milieu naturel : PA20 puis PE40 (mai - juin)
(5, '1.6'), (5, '1.7'), (5, '1.8'), (5, '1.9'),
(5, '2.4'), (5, '2.7'), (5, '2.8'), (5, '2.9'),
(5, '3.4'), (5, '3.5'), (5, '3.7'), (5, '3.8'), (5, '3.9'),
(5, '4.7'), (5, '4.8'), (5, '4.9'),
(5, '5.4'), (5, '5.7'), (5, '5.8'), (5, '5.9'),
(5, '6.6'), (5, '6.7'), (5, '6.8'), (5, '6.9'),
(5, '7.7'), (5, '7.8'), (5, '7.9'),
(5, '8.4'), (5, '8.7'), (5, '8.8'), (5, '8.9'),
(5, '9.4'), (5, '9.5'), (5, '9.6'), (5, '9.7'), (5, '9.8'), (5, '9.9'),
(5, '10.4'), (5, '10.5'), (5, '10.6'), (5, '10.7'), (5, '10.8'), (5, '10.9'),
(5, '11.4'), (5, '11.5'), (5, '11.6'), (5, '11.7'), (5, '11.8'), (5, '11.9');

INSERT INTO periode_progression_exercice (periode_id, exercice_id)
SELECT pp.id, e.id
  FROM parcours_n2 v
  JOIN periode_progression pp ON pp.rang = v.rang
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
  JOIN exercice_competence e ON e.bloc_id = b.id AND e.numero = v.numero
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)'
   AND p.nom = 'N2 – progression type du club'
   AND NOT EXISTS (SELECT 1 FROM periode_progression_exercice x
                    WHERE x.periode_id = pp.id AND x.exercice_id = e.id);

DROP TABLE parcours_n2;
