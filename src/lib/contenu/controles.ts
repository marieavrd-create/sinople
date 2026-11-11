// Contrôles de contenu lancés en CI (spécification technique § 4.2).
// Chaque erreur nomme le fichier et la question en cause, pour être corrigée sans chercher.
import { lecon as schemaLecon, type Lecon } from './schema';
import themes from '../../data/themes.json';

export type FichierLecon = { chemin: string; donnees: unknown };

const idsThemes = new Set(themes.map((t) => t.id));

function normaliser(s: string) {
  return s.trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
}

/** Renvoie la liste des erreurs ; vide si tout le contenu est correct. `chemin` est relatif à src/content/questions. */
export function controlerLecons(fichiers: FichierLecon[]): string[] {
  const erreurs: string[] = [];
  const lecons: { chemin: string; l: Lecon }[] = [];

  for (const { chemin, donnees } of fichiers) {
    const r = schemaLecon.safeParse(donnees);
    if (!r.success) {
      for (const p of r.error.issues) {
        const ou = p.path.length ? p.path.join('.') : 'la leçon';
        const qid = p.path[0] === 'questions' && typeof p.path[1] === 'number'
          ? (donnees as { questions?: { id?: string }[] }).questions?.[p.path[1]]?.id
          : undefined;
        erreurs.push(`${chemin} › ${ou}${qid ? ` (${qid})` : ''} : ${p.message}`);
      }
      continue;
    }
    lecons.push({ chemin, l: r.data });
  }

  const vus = new Map<string, string>();
  const parEtape = new Map<string, Lecon[]>();

  for (const { chemin, l } of lecons) {
    const attendu = `${l.theme}/${l.etape}-${l.lecon}.json`;
    if (chemin !== attendu) erreurs.push(`${chemin} : le fichier devrait s'appeler ${attendu} (d'après theme, etape et lecon)`);
    if (l.id !== `${l.theme}-${l.etape}-${l.lecon}`) erreurs.push(`${chemin} : l'id de la leçon devrait être « ${l.theme}-${l.etape}-${l.lecon} »`);
    if (!idsThemes.has(l.theme)) erreurs.push(`${chemin} : le thème « ${l.theme} » n'existe pas dans src/data/themes.json`);

    for (const q of l.questions) {
      const deja = vus.get(q.id);
      if (deja) erreurs.push(`${chemin} › ${q.id} : id déjà utilisé dans ${deja} (un id ne sert qu'une fois)`);
      else vus.set(q.id, chemin);

      if ((q.type === 'qcm' || q.type === 'pastilles' || q.type === 'registre') && new Set(q.choix.map(normaliser)).size !== q.choix.length) {
        erreurs.push(`${chemin} › ${q.id} : deux choix sont identiques`);
      }
    }

    const cle = `${l.theme}/étape ${l.etape}`;
    parEtape.set(cle, [...(parEtape.get(cle) ?? []), l]);
  }

  for (const [cle, ls] of parEtape) {
    const normales = ls.filter((l) => !l.epreuve).length;
    const epreuves = ls.filter((l) => l.epreuve).length;
    if (normales > 5) erreurs.push(`${cle} : ${normales} leçons, 5 au maximum`);
    if (epreuves > 1) erreurs.push(`${cle} : ${epreuves} épreuves, une seule par étape`);
    // Une étape avec son épreuve est complète : elle doit alors compter 4 ou 5 leçons.
    if (epreuves === 1 && normales < 4) erreurs.push(`${cle} : l'épreuve est là mais il n'y a que ${normales} leçon(s), il en faut 4 ou 5`);
  }

  return erreurs;
}
