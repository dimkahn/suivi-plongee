-- ============================================================
--  Parcours de formation du N1 (MFT PE20, base d'exercices V51) :
--
--  1. Conseils de l'encadrant pour chacun des 90 exercices : points
--     de vigilance, erreurs fréquentes et remédiation. Écrits
--     seulement là où l'écran d'admin n'a encore rien mis
--     (conseils IS NULL).
--  2. Exercices de chaque période de la progression type du club
--     (V22, corrigée par V24) : l'initiation en début de saison, la
--     maîtrise ensuite, le milieu naturel en mai-juin. Les blocs des
--     périodes ne changent pas (ils font le calcul du retard, V24) :
--     un exercice peut être prévu dans une période qui ne liste pas
--     son bloc (un exercice de milieu naturel en fin de saison).
--
--  Exercices désignés par leur numéro (celui du document du club),
--  périodes par leur rang ; tout passe par des sous-requêtes : une
--  progression renommée ou un exercice renuméroté depuis l'écran
--  d'admin est simplement laissé de côté.
--
--  Ensuite, conseils et parcours se modifient depuis /admin/exercices
--  et /admin/progressions : ne pas retoucher ce fichier une fois
--  appliqué.
-- ============================================================

-- ---------- 1. Conseils ----------

-- Tables de travail, supprimées en fin de migration.
CREATE TABLE conseil_n1 (numero VARCHAR(10) PRIMARY KEY, texte TEXT NOT NULL);

INSERT INTO conseil_n1 (numero, texte) VALUES
-- Compétence 1 : S'équiper et se déséquiper
('1.1', 'Faire dire chaque vérification à voix haute pendant le gréage : c''est ce qui l''ancre. Erreur fréquente : ouvrir le robinet d''un coup, manomètre face au visage ; on ouvre lentement, cadran tourné vers le bas. Faire dégréer aussi souvent que gréer : purger avant de dévisser.'),
('1.2', 'La vérification croisée est un rituel de binôme, pas un contrôle du moniteur : laisser les élèves la mener et ne compléter qu''à la fin. Vérifier qu''ils regardent vraiment (manomètre lu, inflateur essayé) plutôt que de toucher machinalement.'),
('1.3', 'Un bloc qui tombe blesse : être intransigeant dès la première séance. Faire porter le bloc à deux mains, robinet vers soi, et montrer où le poser. Profiter du rinçage pour faire repérer une anomalie (joint abîmé, embout fendu).'),
('1.4', 'Tester en fin de séance, bloc presque vide : un bloc plein alourdit et fausse le test. Erreur fréquente : palmer ou garder de l''air dans le gilet pendant le test. Faire noter le lestage au carnet avec l''épaisseur de combinaison et le type d''eau.'),
('1.5', 'Commencer en petit fond, pied posé, avant le grand fond. Rappeler que le gilet gonflé est la bouée : on ne le lâche jamais. Si l''élève s''essouffle, arrêter, ventilation calme, puis reprendre étape par étape.'),
('1.6', 'Donner un vrai délai et s''y tenir : c''est la contrainte du bateau qu''on simule. Observer sans aider ; noter les oublis et les reprendre au débriefing plutôt que pendant l''exercice.'),
('1.7', 'Ne jamais cacher une anomalie dangereuse si l''élève ne la détecte pas : le moniteur vérifie tout avant la mise à l''eau. Varier l''anomalie d''une séance à l''autre et valoriser la méthode (ordre des vérifications) plus que la trouvaille.'),
('1.8', 'Faire l''exercice en grand fond près du bord, équipier attentif. Erreur fréquente : lâcher le gilet pour se servir des deux mains. Si le recapelage échoue, revenir au capelage en petit fond, puis réessayer.'),
('1.9', 'Questionner plutôt qu''expliquer : « tu passes de la piscine à la mer, que fais-tu de ton lestage ? ». Faire lier la réponse au test du lestage (1.4) et au carnet. Masque, palmes et combinaison : vérifier l''ajustement réel, pas seulement le discours.'),
-- Compétence 2 : Se mettre à l'eau et sortir de l'eau
('2.1', 'Toujours une profondeur suffisante et une zone dégagée. Erreur fréquente : sauter sans tenir le masque, ou rester sous l''eau sans faire le OK. Encourager mais ne pas forcer une bascule arrière à un élève qui appréhende : passer par la position assise.'),
('2.2', 'Vérifier la profondeur (2,5 m au moins) et que personne n''est en dessous. Gilet légèrement gonflé, jamais vide. Corriger le regard vers le bas, qui fait basculer vers l''avant : regard à l''horizon.'),
('2.3', 'Progressivité : assis, puis accroupi, puis depuis un boudin. Faire vérifier derrière soi à chaque fois. Si l''élève tourne la tête ou ouvre les bras, il se retourne dans l''eau : menton rentré, bras serrés.'),
('2.4', 'La hauteur augmente l''appréhension : commencer bas et monter seulement quand la technique est propre. Un encadrant dans l''eau à côté du point d''entrée. Insister sur le regroupement immédiat : en mer, c''est lui qui évite la dispersion.'),
('2.5', 'Choisir un fond régulier, sans vague, et un binôme qui se tient. Erreur fréquente : vouloir marcher avec les palmes chaussées face au large ; on recule ou on se couche. Au retour, déchausser dans l''eau avant de se relever.'),
('2.6', 'Le réceptionnaire hors de l''eau est un équipier formé, jamais un élève seul. Faire attendre hors de l''axe de l''échelle : un bloc ou un plongeur peut tomber. Si l''élève hésite sur l''ordre, le lui faire réciter avant de commencer.'),
('2.7', 'Donner un vrai briefing de DP, avec un ordre de passage : l''élève doit écouter et attendre son tour. Ne pas répéter les consignes : c''est l''écoute qui est évaluée.'),
('2.8', 'Annoncer le scénario au briefing (courant fictif, bout de regroupement). Sécurité : un encadrant à la bouée. Remédiation si la palanquée se disperse : refaire l''exercice palanquée par palanquée, plus lentement.'),
('2.9', 'Le tour d''horizon avant de remonter à l''échelle se perd vite : l''exiger à chaque fois. Faire passer lest puis bloc dans cet ordre, une main toujours sur l''échelle. Après la sortie, faire dégager la zone pour le suivant.'),
-- Compétence 3 : S'immerger
('3.1', 'Équilibrer tôt et souvent, avant la douleur. Erreur fréquente : souffler fort et longtemps ; un Valsalva se fait doucement. Un élève qui n''y arrive pas remonte d''un mètre et recommence ; ne jamais insister sur une douleur, et pas d''immersion avec un rhume.'),
('3.2', 'Le phoque marche quand l''expiration est complète et le gilet vraiment vide : faire lever la purge et rester vertical. Erreur fréquente : palmer pour descendre, ce qui remonte l''élève. Rester face à lui pour suivre l''équilibrage des oreilles.'),
('3.3', 'Décomposer : buste plié, puis jambes levées. Si les palmes ne sortent pas, l''élève plie trop tard ou garde les jambes fléchies. Équilibrer dès la glisse, les oreilles arrivent vite au fond.'),
('3.4', 'Le bloc déséquilibre la bascule : la faire franche, jambes bien hors de l''eau. Gilet vidé avant. Erreur fréquente : palmer en surface (« moulinet »), qui fatigue et n''immerge pas : on palme seulement une fois immergé.'),
('3.5', 'Sans repère, l''élève doit lire son instrument pendant la descente : le lui faire montrer à 3 m. S''il dépasse, il injecte trop tard : anticiper l''injection vers 2 m. Lestage en cause s''il ne descend pas gilet vide.'),
('3.6', 'Varier vite les annonces pour rendre le choix automatique. Observer la qualité, pas seulement la technique choisie : vidage du gilet pour le phoque, jambes hors de l''eau pour le canard.'),
('3.7', 'Le GP ne donne qu''une annonce et un signe, comme en mer. Évaluer la cohésion : chacun cherche le GP du regard au fond. Un élève qui part en retard : revenir au signe « descendre » et à l''attention au GP.'),
('3.8', 'L''enchaînement révèle les temps morts : chronométrer mentalement entre l''entrée et l''immersion. Si un élève ne parvient pas à s''immerger, vérifier son lestage avant de reprendre la technique.'),
('3.9', 'En mer, la descente est le moment des oreilles et de la séparation de la palanquée : descendre lentement, élèves à portée de main, le long du mouillage la première fois. Arrêter la descente au moindre signe de gêne.'),
-- Compétence 4 : Se propulser
('4.1', 'Le « vélo » (genoux qui plient) est l''erreur de base : faire palmer jambes tendues, au bord, avant toute nage. Montrer que la palme pousse sur ses deux faces.'),
('4.2', 'En ventral, palmes sous la surface : des éclaboussures disent que les genoux sortent. En dorsal, regard vers le haut et hanches hautes. Alterner avec du repos : on cherche la qualité, pas la vitesse.'),
('4.3', 'Commencer mains sur la tête, puis hors de l''eau seulement quand le geste est sûr. Erreur fréquente : ventilation bloquée par l''effort ; faire parler l''élève pendant l''exercice.'),
('4.4', 'Le costal s''apprend avec un bras en avant pour l''équilibre. Sur 100 m, surveiller l''essoufflement : si l''élève ne peut plus parler, il ralentit. La régularité compte plus que le temps.'),
('4.5', 'Gilet légèrement gonflé, pas trop : un gilet trop plein redresse et freine. Sur le dos, faire lever la tête régulièrement pour garder le cap. Sur le ventre, ventilation sur tuba.'),
('4.6', 'Assiette horizontale : un élève « assis » dans l''eau palme vers le haut et soulève le fond. Corriger d''abord le lestage et le gilet, puis le geste. Rester devant, à distance fixe.'),
('4.7', 'Évaluer la qualité du geste et l''absence d''essoufflement, pas le chrono. La sustentation finale révèle la fatigue : si l''élève s''essouffle, lui faire reprendre sa ventilation avant de juger.'),
('4.8', 'Annoncer un point d''arrivée visible. Évaluer la capacité à parler à l''arrivée : c''est le signe d''un effort géré. Remédiation : refaire plus court, plus lentement, en insistant sur l''expiration.'),
('4.9', 'En mer, l''élève se laisse distancer quand il regarde le fond : rappeler la règle de distance au briefing et se retourner souvent. Un contact avec le fond indique un mauvais lestage ou une assiette à reprendre.'),
-- Compétence 5 : Se ventiler
('5.1', 'Faire expirer franchement pour vider le tuba, puis reprendre une petite inspiration prudente. La toux vient d''une inspiration trop rapide après le vidage. Rassurer : avaler un peu d''eau n''est pas grave.'),
('5.2', 'Expiration plus longue que l''inspiration : c''est la clé contre l''essoufflement. Compter avec les doigts en face de l''élève. Les apnées de contrôle restent courtes ; jamais d''apnée en remontant.'),
('5.3', 'Progression stricte, palier par palier ; ne passer au suivant que sans stress. Erreur fréquente : souffler par la bouche ou tête baissée. Tête vers la surface, main sur le haut de la jupe, on souffle par le nez.'),
('5.4', 'Le masque retiré surprend par le froid et les yeux : faire garder les yeux fermés au début, puis ouverts. Si panique, remonter calmement ensemble et reprendre au palier précédent ; ne jamais retirer le masque d''un élève sans prévenir.'),
('5.5', 'Rappeler sans cesse : on n''inspire jamais sans embout, on laisse sortir un filet de bulles. Faire pratiquer les deux méthodes de vidage. Pour la récupération du détendeur, faire pencher légèrement à droite pour le faire pendre.'),
('5.6', 'Apnées courtes et jamais précédées d''hyperventilation : c''est une règle de sécurité, l''énoncer à chaque fois. Encadrant en face, prêt à donner l''embout. Commencer après une inspiration normale, puis après une expiration normale.'),
('5.7', 'Faire les gestes en pleine eau oblige à gérer l''équilibre en même temps : accepter une petite variation de profondeur au début. Un élève qui se pose au fond pour faire son vidage n''est pas encore prêt.'),
('5.8', 'Doser la résistance : on cherche un effort modéré, pas un essoufflement. Lâcher au moindre signe d''essoufflement et faire récupérer : arrêt, expiration longue. L''élève doit apprendre à reconnaître ses signes avant-coureurs.'),
('5.9', 'Faire les demandes à des moments imprévus, sans prévenir, mais jamais en même temps qu''une difficulté d''équilibre. Évaluer la sérénité : un élève qui se précipite n''est pas encore autonome sur ces gestes.'),
-- Compétence 6 : S'équilibrer
('6.1', 'Faire sentir avant d''expliquer : l''élève décrit, le moniteur nomme. Lier tout de suite poumon ballast et ventilation : « tu remontes quand tu inspires ». Bon moment pour reparler du lestage.'),
('6.2', 'Gilet réglé par le moniteur au départ, puis par l''élève. Si le buste ne monte pas, le gilet est trop vide ou l''élève sur-lesté. Inspirations amples mais pas d''apnée en haut.'),
('6.3', 'Erreur fréquente : injecter trop et trop vite, puis purger, en yo-yo. Petites injections, attendre 3 à 5 s, affiner au poumon. Interdire de tenir le bout : il sert seulement de repère.'),
('6.4', 'Sans repère, faire lire l''instrument souvent. Un élève qui dérive lentement vers le haut garde de l''air : faire purger tôt. Rester à sa hauteur, en face, pour montrer l''exemple.'),
('6.5', 'Interdire de toucher au gilet pendant l''exercice. Erreur fréquente : bloquer la respiration pour tenir la profondeur ; on module le volume courant, pas l''apnée.'),
('6.6', 'Anticiper : injecter en descendant avant d''arriver, purger en remontant avant d''accélérer. Si l''élève remonte trop vite, arrêter l''exercice et le stabiliser avant de continuer.'),
('6.7', 'Annoncer des profondeurs variées et proches (3 m, 5 m, 4 m). Évaluer sans aider : l''élève doit trouver seul le réglage. Un élève qui palme pour tenir sa profondeur n''est pas équilibré.'),
('6.8', 'Côte à côte, chaque élève doit gérer son équilibre sans gêner les autres. Placer les plus à l''aise aux bouts. Durée du palier annoncée, comme en mer.'),
('6.9', 'En mer, l''équilibre se règle au fil du relief : l''élève doit ajuster seul en montant comme en descendant. Rappeler que le volume du gilet varie avec la profondeur : purger en remontant.'),
-- Compétence 7 : Respecter le milieu et l'environnement
('7.1', 'Court et concret : montrer des photos d''espèces locales et des dégâts de palmes. Faire reformuler la Charte avec les mots de l''élève. Lier le froid au choix de la combinaison et au signe « froid ».'),
('7.2', 'Les objets doivent vraiment représenter un fond fragile : fixer la règle « je regarde, je ne touche pas ». Un contact révèle un défaut d''équilibre : reprendre la stabilisation (6.3) plutôt que le palmage.'),
('7.3', 'Palmes au-dessus du buste : tête légèrement plus basse que les palmes près du fond. Le palmage en grenouille se montre au bord d''abord. Évaluer en regardant derrière l''élève : aucun nuage ne doit se lever.'),
('7.4', 'Première vraie épreuve du sable : un nuage se forme au moindre coup de palme vers le bas. Stabiliser l''élève avant le déplacement ; s''il touche, remonter d''un mètre et repartir.'),
('7.5', 'Le GP montre du doigt sans toucher, à distance. Limiter le nombre d''espèces à chercher pour garder l''attention sur le comportement. Débriefing obligatoire, avec le carnet.'),
('7.6', 'Faire nommer les espèces avec un guide ou des photos. Insister sur les espèces à risque du site (urticantes, piquantes) : c''est de la sécurité, pas seulement de la culture.'),
('7.7', 'Le GP observe sans corriger pendant la plongée : les remarques se font au débriefing. Être exigeant sur les appuis « pour se reposer » : en mer, on se stabilise au gilet.'),
('7.8', 'Choisir un site avec une zone fragile facile d''accès. Distance d''un mètre au moins de la paroi ou de l''herbier ; attention aux palmes quand l''élève se retourne.'),
('7.9', 'Laisser parler l''élève d''abord : il évalue son impact avant le moniteur. Sur le site, montrer l''exemple (déchets rapportés, pas d''ancre sur l''herbier) : le comportement s''apprend par imitation.'),
-- Compétence 8 : Communiquer
('8.1', 'Faire faire chaque signe aux élèves, pas seulement le montrer. Insister sur la netteté et sur la réponse attendue. Un signe mal compris au sec le sera aussi sous l''eau.'),
('8.2', 'En surface, le OK se fait bras en couronne au-dessus de la tête pour être vu de loin ; l''appel à l''aide, bras agité. Rappeler que l''appel à l''aide n''est jamais un jeu en dehors de l''exercice.'),
('8.3', 'Faire face à l''élève, signes devant le masque, dans la lumière. Exiger une réponse à chaque signe : un signe sans réponse n''est pas compris.'),
('8.4', 'Erreur fréquente : répondre « OK » sans lire le manomètre. Faire montrer le cadran puis signer la pression. Varier l''ordre des questions.'),
('8.5', 'La transmission révèle les signes approximatifs : corriger le signe à la source. Changer les rôles à chaque passage.'),
('8.6', 'L''élève doit aller chercher l''attention du GP : se placer dans son champ de vision, pas signer dans son dos. Utiliser une carte-consigne pour ne pas souffler la réponse.'),
('8.7', 'Ordre aléatoire, statique puis en déplacement : c''est la variété qui évalue. Un seul signe raté se reprend dans la même séance ; plusieurs : revenir à 8.3.'),
('8.8', 'L''annonce doit venir de l''élève, sans question du GP. Fixer au briefing une pression d''annonce (mi-pression, réserve) adaptée au bloc. Débriefer les annonces tardives.'),
('8.9', 'Scénario annoncé au briefing pour éviter toute confusion avec un vrai incident. Évaluer la rapidité et la justesse du signe, puis l''acceptation de la procédure du GP sans s''y opposer.'),
-- Compétence « 9 » du document : Retourner en surface (bloc 10 du MFT)
('9.1', 'Utiliser un ballon ou une bouteille retournée pour montrer le volume qui double entre 10 m et la surface. Faire répéter la règle : on ne bloque jamais sa respiration en remontant. Préparer la REC par le « ouuu » au sec.'),
('9.2', 'Regard vers la surface, une main sur la purge : faire purger par petites touches. Erreur fréquente : accélérer dans les derniers mètres ; ralentir au contraire à l''approche de la surface.'),
('9.3', 'Le tour d''horizon se fait bras levé dans les derniers mètres, en tournant sur soi. Le gilet se gonfle en surface, pas avant. L''exiger à chaque remontée, même en piscine : c''est l''habitude qui protège en mer.'),
('9.4', 'Sans repère, l''ordinateur ou les plus petites bulles donnent la vitesse : faire vérifier régulièrement. Remonter à côté de l''élève, à sa vitesse, pour lui donner un repère visuel.'),
('9.5', 'Lier le palier à l''ordinateur et à la table fédérale : l''élève doit comprendre pourquoi il s''arrête. Erreur fréquente : remonter lentement pendant le palier ; faire lire l''instrument souvent.'),
('9.6', 'Moniteur face à l''élève, mains sur ses sangles, prêt à freiner. Expiration continue et modérée : ni bloquée ni forcée. On commence à 2 m, on ne passe à 4 m que sans stress ; jamais de REC après des apnées répétées.'),
('9.7', 'Aucun critère de temps : on évalue le calme et la vitesse. Encadrant à côté de l''élève pendant toute la remontée. Si l''élève remonte trop vite, il palme trop : faire purger le gilet avant le départ.'),
('9.8', 'Évaluer la cohésion : la palanquée remonte ensemble, à la vitesse du plus lent. Tour d''horizon avant la surface, gilet gonflé, OK au bateau.'),
('9.9', 'Procédure briefée et sécurité assurée par un second encadrant qui garde l''élève en vue. Recherche courte (une minute au plus), sans descendre, puis remontée à vitesse contrôlée et signalement en surface.'),
-- Compétence « 10 » du document : Évoluer en sécurité (bloc 9 du MFT)
('10.1', 'Faire toucher l''octopus du GP et montrer comment il le présente. Expliquer que le GP gère : l''élève accepte la procédure, sans s''y opposer. Revoir la règle de perte de palanquée.'),
('10.2', 'L''élève signale, le moniteur présente l''octopus : ne pas laisser l''élève arracher le détendeur. Tenue mutuelle par le gilet. Faire ventiler calmement une bonne minute avant de terminer.'),
('10.3', 'Annoncer l''incident avant de le simuler. Essoufflement : le GP arrête l''élève et le fait expirer longuement ; l''élève accepte. Crampe : étirement, palme tirée vers soi. Malaise : montrer où ça ne va pas.'),
('10.4', 'Distance progressive (3, 6 puis 10 m) et expiration normale, jamais forcée, avant de partir. Un second encadrant nage à côté de l''élève, prêt à lui donner de l''air ; le GP vient au-devant si besoin. Pas d''apnée répétée.'),
('10.5', 'Le relais se termine toujours par le GP : B alerte et rejoint le GP avec A. Simulation d''échange d''embout seulement en statique et encadrée. Changer les rôles.'),
('10.6', 'Cartes-consignes de pression variées, pour que l''annonce soit spontanée. Le GP organise ensuite le retour : évaluer la réaction de la palanquée, qui reste groupée.'),
('10.7', 'Même règle que 10.4 : expiration normale, encadrant de sécurité à côté, GP qui présente l''octopus. Évaluer l''automatisme, pas la performance ; un élève qui stresse revient à 6 m.'),
('10.8', 'Tirer au sort mais garder une progression : pas deux incidents d''affilée qui fatiguent. Évaluer la justesse du signe et le calme.'),
('10.9', 'Scénario annoncé au briefing. L''élève doit agir vite et simplement : apporter de l''air ou de l''aide, puis solliciter le GP. Débriefer ce qu''il a vu et fait.');

UPDATE exercice_competence
   SET conseils = (SELECT c.texte FROM conseil_n1 c WHERE c.numero = exercice_competence.numero)
 WHERE conseils IS NULL
   AND numero IN (SELECT numero FROM conseil_n1)
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)');

DROP TABLE conseil_n1;

-- ---------- 2. Exercices de chaque période ----------

CREATE TABLE parcours_n1 (rang INT NOT NULL, numero VARCHAR(10) NOT NULL);

INSERT INTO parcours_n1 (rang, numero) VALUES
-- 1. Découverte du scaphandre (septembre - octobre, piscine)
(1, '1.1'), (1, '1.2'), (1, '1.3'), (1, '1.4'),
(1, '2.1'), (1, '2.2'), (1, '2.3'),
(1, '4.1'), (1, '4.2'), (1, '4.3'),
(1, '5.1'), (1, '5.2'), (1, '5.3'),
(1, '8.1'), (1, '8.2'), (1, '8.3'),
-- 2. Immersion, ventilation et communication (novembre - décembre)
(2, '1.5'),
(2, '3.1'), (2, '3.2'), (2, '3.3'), (2, '3.4'), (2, '3.5'),
(2, '4.4'), (2, '4.5'), (2, '4.6'), (2, '4.7'),
(2, '5.4'), (2, '5.5'), (2, '5.6'), (2, '5.7'),
(2, '8.4'), (2, '8.5'), (2, '8.6'),
-- 3. Fosse : équilibre et retour en surface (janvier - février)
(3, '3.6'), (3, '3.7'),
(3, '4.8'), (3, '5.8'),
(3, '6.1'), (3, '6.2'), (3, '6.3'), (3, '6.4'), (3, '6.5'), (3, '6.6'),
(3, '7.1'), (3, '7.2'), (3, '7.3'),
(3, '9.1'), (3, '9.2'), (3, '9.3'), (3, '9.4'), (3, '9.5'), (3, '9.6'),
-- 4. Sécurité et plongée en palanquée (mars - avril)
(4, '1.6'), (4, '1.7'), (4, '1.8'), (4, '1.9'),
(4, '2.4'), (4, '2.6'), (4, '2.7'),
(4, '3.8'), (4, '5.9'),
(4, '6.7'), (4, '6.8'),
(4, '8.7'), (4, '8.8'), (4, '8.9'),
(4, '9.7'), (4, '9.8'), (4, '9.9'),
(4, '10.1'), (4, '10.2'), (4, '10.3'), (4, '10.4'), (4, '10.5'), (4, '10.6'), (4, '10.7'), (4, '10.8'), (4, '10.9'),
-- 5. Milieu naturel (mai - juin)
(5, '2.5'), (5, '2.8'), (5, '2.9'),
(5, '3.9'), (5, '4.9'), (5, '6.9'),
(5, '7.4'), (5, '7.5'), (5, '7.6'), (5, '7.7'), (5, '7.8'), (5, '7.9');

INSERT INTO periode_progression_exercice (periode_id, exercice_id)
SELECT pp.id, e.id
  FROM parcours_n1 v
  JOIN periode_progression pp ON pp.rang = v.rang
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
  JOIN exercice_competence e ON e.bloc_id = b.id AND e.numero = v.numero
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'
   AND p.nom = 'N1 – progression type du club'
   AND NOT EXISTS (SELECT 1 FROM periode_progression_exercice x
                    WHERE x.periode_id = pp.id AND x.exercice_id = e.id);

DROP TABLE parcours_n1;
