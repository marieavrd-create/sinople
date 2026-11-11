# Sinople

Le site de quiz où un goupil gueux devient noble par la ruse… et le savoir.

## Changer le look (couleurs, formes, polices)

Tout se règle dans un seul fichier : **`src/styles/theme.css`**.

- Les couleurs s'écrivent en code hexadécimal, comme dans Photoshop (`#3fae68`).
- Le texte blanc doit rester lisible sur `--sinople` : si vous changez ce vert, gardez-le assez foncé (contraste d'au moins 4,5 avec le blanc, à vérifier sur un site comme webaim.org/resources/contrastchecker).
- `--arrondi` règle l'arrondi des cartes (`0px` = coins carrés).
- `--arrondi-bouton` règle l'arrondi des boutons (`999px` = pilule).
- Les polices viennent de Google Fonts. Pour en changer, il faut aussi modifier le lien dans `src/layouts/Base.astro`.

Pour déplacer des blocs ou changer la mise en page, demandez à Claude.

## Les pages

| Page | Fichier |
| --- | --- |
| Accueil : le feu des conjurés, qui grandit avec les thèmes joués | `src/pages/index.astro` |
| Choix du quiz | `src/pages/themes.astro` |
| Écran avant un quiz (l'animal du thème s'allume) | `src/pages/theme/[id].astro` |
| Une leçon (adresse `quiz/<thème>/<étape>-<leçon>`) | `src/pages/quiz/[theme]/[lecon].astro` |
| Quiz d'exemple de géographie | `src/pages/quiz/demo.astro` |
| Stats : vues et parties du site, et celles du joueur | `src/pages/stats.astro` |
| Classement (bientôt) | `src/pages/classement.astro` |
| Page introuvable (404) | `src/pages/404.astro` |

- Thèmes, animaux et carrières : `src/data/themes.json`.
- Questions : une leçon par fichier dans `src/content/questions/<thème>/<étape>-<leçon>.json` (par exemple `religion/1-1.json`), avec le niveau, l'explication et la source de chaque question. Le format est décrit dans `src/lib/contenu/schema.ts`. Chaque question garde son `id` pour toujours (il sert à la révision).
- Les façons de répondre (`type` d'une question) :
  - `qcm` : 4 choix, `juste` = le numéro du bon (en comptant à partir de 0) ;
  - `saisie` : réponse à taper, ou liste à compléter avant la fin du chrono ;
  - `molette` : on fait tourner des nombres (une année…) ; `min`, `max`, `juste`, et en option `pas`, `unite` et `tolerance` ;
  - `jauge` : on vise une valeur sur un arc, un pourcentage par défaut ; `juste`, et en option `tolerance` (5 par défaut), `min`, `max`, `unite` ;
  - `pastilles` : plusieurs bonnes réponses à cocher ; `choix`, et `justes` = les numéros des bonnes ;
  - `registre` : une longue liste rangée de A à Z avec une recherche ; `choix` (8 au moins) et `juste` = la bonne réponse écrite comme dans `choix`.
- Les écrans de ces quatre derniers formats sont dans `src/islands/Formats.tsx`.
- Une question mal formée (QCM sans 4 choix, source vide, id déjà pris…) fait échouer la vérification avec un message qui nomme le fichier et la question.
- Le feu et ses animaux : `src/components/Feu.astro`.
- Le renard mascotte : `public/goupil/renard.svg` (les autres dessins du goupil sont rangés dans le même dossier).
- En attendant les comptes, la progression est gardée dans le navigateur : `src/scripts/progres.ts`.

## Les stats (vues, visiteurs, parties)

La page **Stats** montre deux choses :

- **Toi, sur cet appareil** : points, série, leçons réussies, progression par thème. C'est lu dans le navigateur, ça marche tout de suite.
- **Le site** : nombre de vues, de visiteurs, de parties jouées, thèmes et pages les plus vus. Ces chiffres sont partagés entre tous les joueurs, donc ils doivent être gardés quelque part : dans **Supabase** (la base de données prévue dans la spécification technique).

Le projet Supabase « sinople » (région Paris) est branché depuis le 11/11/2026 ; ses tables ont été créées avec `supabase/migrations/0001_stats.sql`.
Pour le rebrancher sur un autre projet :

1. Créer un projet gratuit sur https://supabase.com (région Europe).
2. Dans le projet, ouvrir **SQL Editor**, coller le contenu de `supabase/migrations/0001_stats.sql` et cliquer **Run**.
3. Dans **Project Settings → API Keys**, copier l'adresse du projet (`https://xxxx.supabase.co`) et la clé **publishable** (elle commence par `sb_publishable_`).
4. Les coller dans `src/data/supabase.json` (`url` et `cle`), puis envoyer sur `main`.

La clé publishable est faite pour être visible dans le site : les tables sont fermées, le site ne peut qu'ajouter une vue ou une partie et lire les totaux. Ne jamais mettre ici la clé **secret** (`sb_secret_…`).
Tant que `src/data/supabase.json` est vide, rien n'est envoyé et la partie « Le site » affiche un message d'attente.
Rien de personnel n'est gardé : un numéro tiré au hasard sur l'appareil (pour compter les visiteurs), la page vue, et le score d'une leçon.

## Voir le site sur son ordinateur

Dans le Terminal, depuis ce dossier :

```
npm install
npm run dev
```

Puis ouvrir http://localhost:4321/sinople/ dans le navigateur.

## Mise en ligne

Le site se met en ligne tout seul sur GitHub Pages à chaque envoi sur la branche `main`
(fichier `.github/workflows/deploy.yml`), à l'adresse https://marieangeviard.com/sinople/.

## Vérifications

Chaque PR est vérifiée automatiquement (fichier `.github/workflows/verifier.yml`) :
types (`npm run check`), tests (`npm test`) et construction du site (`npm run build`).
Pour tout lancer d'un coup sur son ordinateur : `npm run verifier`.

- Les réglages du jeu (vies, points, seuils de réussite, série, révision) sont dans `src/data/regles.json`.
- Les règles du jeu en code sont dans `src/lib/jeu/`, leurs tests dans `tests/`.
- Les îles Preact (écrans interactifs) vont dans `src/islands/`.
