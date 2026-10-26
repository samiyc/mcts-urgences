# Les recherches sur les urgences

Sami (25/10/2026, `docs/prompt/glossaire-search.md`, d'après ses notes `docs/notes/init.md`) : plus de réalisme
pour l'hôpital, en suivant chaque patient de près. Ce dossier rassemble ce que disent les sources publiées
(l'enquête Urgences 2023 de la DREES d'abord), et ce que le simulateur en reprend.

À lire dans cet ordre :
1. [glossaire.md](glossaire.md) : les termes, les rôles, les lieux, les codes ;
2. [parcours-patient.md](parcours-patient.md) : le parcours du patient, de l'arrivée à la sortie, avec ses durées ;
3. [ressources-rares.md](ressources-rares.md) : ce qui fait goulot, au-delà des lits ;
4. [soignants.md](soignants.md) : les équipes, la fatigue, les pauses, l'interne ;
5. [indicateurs.md](indicateurs.md) : ce que mesurent les services, et les max que le simulateur compte ;
6. [oublis.md](oublis.md) : la réponse à « J'oublie quelque chose ? » ;
7. [feuille-de-route.md](feuille-de-route.md) : les six étapes du parcours détaillé ;
8. [hypotheses-a-verifier.md](hypotheses-a-verifier.md) : chaque valeur estimée faute de source, avec la question à
   poser et le métier qui peut y répondre, à vérifier auprès de professionnels (Sami, 26/10).

Un chiffre cité a sa source dans le fichier qui le donne. Un chiffre sans source est écrit comme une hypothèse ;
ces hypothèses sont rassemblées dans le code, `src/hypotheses.js` et `src/pathway-hypotheses.js`, et listées une à
une, numérotées, dans [hypotheses-a-verifier.md](hypotheses-a-verifier.md).
