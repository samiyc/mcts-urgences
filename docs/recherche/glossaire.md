# Le glossaire des urgences

Sami (25/10/2026) : les termes de ses notes (`docs/notes/init.md`, d'après les vidéos de DOCFX) et ceux que les
recherches de ce dossier emploient. Une ligne par terme ; un terme est ici avant d'être employé ailleurs. Les
sources sont dans chaque fichier du dossier, pas ici.

## Les rôles

- **IOA** (infirmier organisateur de l'accueil) : l'infirmier du tri. Il voit chaque patient à son arrivée, recueille le motif, lui donne un niveau de tri et l'oriente ; il peut lancer les premiers soins (contre la douleur), un ECG ou une prise de sang.
- **IDE** (infirmier diplômé d'État) : l'infirmier des box, qui pose les perfusions, fait les prélèvements, donne les médicaments prescrits et surveille.
- **AS** (aide-soignant) : l'hygiène, l'installation, la surveillance simple, l'aide aux IDE.
- **Brancardier** : transporte les patients couchés (au scanner, au bloc, dans un service) et souvent les prélèvements.
- **ASH** (agent des services hospitaliers) : le ménage et la remise en état d'un box entre deux patients.
- **Agent d'accueil** : l'inscription administrative (l'identité, la carte Vitale) à l'arrivée.
- **Interne** : un médecin en formation, qui examine, prescrit et suit des patients sous la responsabilité d'un senior. C'est le rôle que Sami veut donner au joueur humain.
- **Senior** : le médecin urgentiste diplômé, qui valide les décisions de l'interne.
- **Trauma leader** : le médecin qui dirige une équipe autour d'un patient grave en SAUV ; il supervise, les autres font les gestes.
- **Spécialiste d'astreinte** : un médecin d'un autre service (cardiologue, neurochirurgien, chirurgien, anesthésiste, psychiatre), appelé pour un avis ou une intervention ; il n'est pas toujours sur place la nuit.
- **Régulateur** : le médecin du SAMU (le 15) qui décide au téléphone de la réponse : un conseil, un médecin de ville, une ambulance, un SMUR, et vers quel hôpital.
- **Gestionnaire de lits** (*bed manager*) : celui qui cherche les lits libres dans l'hôpital pour les patients des urgences à hospitaliser.

## Les lieux

- **Box** : une petite pièce d'examen où un patient est vu, soigné et attend ses résultats. C'est la ressource de la garde simple (`simulate.js`).
- **SAUV** (salle d'accueil des urgences vitales), le **déchocage** des notes de Sami : la salle des patients les plus graves, avec le chariot d'urgence, le scope, le respirateur, l'échographe.
- **Circuit court** (*fast track*) : un circuit pour les cas légers qui ne demandent presque pas d'examens, pour qu'ils ne fassent pas la queue derrière les cas lourds.
- **UHCD** (unité d'hospitalisation de courte durée) : quelques lits dans les urgences, pour surveiller, finir des examens ou attendre un lit dans un service.
- **Lit d'aval** : un lit dans un service de l'hôpital (médecine, cardiologie, chirurgie, réanimation…) où va un patient hospitalisé après les urgences.
- **Plateau technique** : l'imagerie (radio, scanner, IRM, échographie), le laboratoire et le bloc.
- **Bloc opératoire** : les salles d'opération, avec leur équipe (chirurgien, anesthésiste, infirmiers de bloc).
- **Chambre d'isolement** : une chambre sécurisée pour un patient agité ou dangereux, ou une chambre à part pour un patient contagieux.
- **Couveuse** (incubateur) : le lit chauffé d'un nouveau-né prématuré, en néonatologie ou en réanimation néonatale.
- **Réanimation** : le service des patients graves sur le long terme (des jours, des semaines), avec un soignant pour deux ou trois patients.

## Les acteurs hors de l'hôpital

- **SAMU** : le service qui répond au 15 et régule les urgences médicales d'un département.
- **SMUR** (service mobile d'urgence et de réanimation) : l'équipe médicale qui part en véhicule vers le patient, puis le transporte ; 1 % des patients des urgences en 2023.
- **BSPP** (brigade de sapeurs-pompiers de Paris) : des militaires ; à Paris, les pompiers et leurs médecins font une partie des secours et de la médecine d'urgence.
- **Evasan** (évacuation sanitaire) : le transport d'un patient, souvent par les airs, vers un hôpital adapté.

## Les codes et les dispositifs

- **Niveau de tri** : la priorité donnée par l'IOA. En France, l'échelle **FRENCH** de la SFMU a 6 niveaux (1, 2, 3A, 3B, 4, 5). Le modèle actuel en a 5, comme l'échelle de Manchester (`hypotheses.js`).
- **CCMU** (classification clinique des malades des urgences) : la gravité notée par le médecin à la fin du passage (de 1, stable, à 5, pronostic vital engagé).
- **RPU** (résumé de passage aux urgences) : la fiche informatique de chaque passage (heures, motif, diagnostic, orientation), envoyée chaque jour à l'ARS et à Santé publique France.
- **Durée de passage** : de l'enregistrement à la sortie effective du service.
- **Orientation** : où va le patient en sortant : retour à domicile, UHCD, hospitalisation, transfert, bloc.
- **Boarding** : un patient dont l'hospitalisation est décidée mais qui reste aux urgences faute de lit, souvent sur un brancard ; il occupe un box ou un couloir.
- **Parti sans attendre** : un patient qui s'en va avant d'être vu par un médecin (3,4 % en 2023), ou **contre avis médical** (0,6 %).
- **Réorientation** : un patient envoyé, au tri, vers la médecine de ville (3,4 % en 2023) ; ou, par le régulateur, vers un autre hôpital moins saturé.
- **BJML** (besoin journalier minimal en lits) : le nombre de lits d'aval que l'hôpital devrait garder libres chaque jour pour les urgences, calculé sur les années passées.
- **HET** (hôpital en tension) : le dispositif gradué quand les lits et les soignants ne suffisent plus aux hospitalisations non programmées ; il vise à éviter le Plan blanc.
- **Plan blanc** : le plan de crise de l'hôpital, déclenché par son directeur, en cas d'afflux de victimes ou de situation exceptionnelle : une cellule de crise, des lits ajoutés, des opérations programmées reportées, des soignants rappelés.
- **SSE** (situation sanitaire exceptionnelle) : un afflux de victimes, une épidémie, une catastrophe.
- **PMA** (poste médical avancé) : le poste de soins dressé sur les lieux d'une catastrophe, où l'on trie les victimes avant de les évacuer.
- **NRBC** : un risque nucléaire, radiologique, biologique ou chimique ; il demande décontamination et isolement.
- **Repos de sécurité** : les 11 heures de repos obligatoires après une garde de nuit (pour les internes, depuis 2002).

## Le matériel des notes de Sami

- **Scope** (moniteur multiparamétrique) : l'écran des constantes (ECG, SpO₂, pression artérielle, fréquence respiratoire, température).
- **Pousse-seringue** : l'appareil qui injecte un médicament à débit précis.
- **Chariot d'urgence** : les médicaments et le matériel de réanimation, rangés par tiroir.
- **Brancard** : le lit roulant ; un patient qui ne marche pas en a besoin, et un brancardier pour le déplacer.
- **Glidescope** : un laryngoscope à caméra pour les intubations difficiles.
- **Biologie délocalisée** : un appareil d'analyse dans le service même (troponine en 10 à 30 min) au lieu du laboratoire central (80 min).
