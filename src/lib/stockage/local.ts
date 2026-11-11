// Progression du joueur gardée sur l'appareil (spécification technique § 9), en attendant les comptes.
// La forme suit les futures tables Supabase (profil, grades, lecons_faites, revision) et porte un numéro de version :
// quand elle change, on ajoute une étape à `migrer` au lieu de perdre la progression des joueurs.
import { viesDeDepart, viesApresRevision, type EtatVies } from '../jeu/vies';
import { serieDeDepart, apresLecon, jourParis, type EtatSerie } from '../jeu/serie';
import { apresReponse, type Fiche } from '../jeu/revision';
import { gradeApresEpreuve, GRADE_DE_DEPART } from '../jeu/grades';
import { regles } from '../jeu/regles';

export const VERSION = 1;
export const CLE = 'sinople';
/** Ancienne clé (avant l'étape 1.4) : { [thème]: { quiz, bonnes } }. */
export const ANCIENNE_CLE = 'sinople-progres';

export type LeconFaite = { meilleurScore: number; nbParties: number; derniereFois: string };

export type Etat = {
  version: typeof VERSION;
  profil: { points: number; vies: EtatVies; serie: EtatSerie };
  /** Thèmes dont l'animal a rejoint le feu, dans l'ordre d'arrivée. */
  conjures: string[];
  grades: Record<string, number>;
  leconsFaites: Record<string, LeconFaite>;
  revision: Record<string, Fiche>;
};

/** Le sous-ensemble de localStorage dont on a besoin (remplaçable dans les tests). */
export type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

export function etatVide(maintenant: number): Etat {
  return {
    version: VERSION,
    profil: { points: 0, vies: viesDeDepart(maintenant), serie: serieDeDepart },
    conjures: [],
    grades: {},
    leconsFaites: {},
    revision: {},
  };
}

/** Reprend l'ancien format : chaque bonne réponse valait 1 point, elle en vaut 10 désormais. */
export function depuisAncienFormat(ancien: Record<string, { quiz?: number; bonnes?: number }>, maintenant: number): Etat {
  const etat = etatVide(maintenant);
  for (const [theme, t] of Object.entries(ancien)) {
    if (!t || typeof t !== 'object') continue;
    etat.conjures.push(theme);
    etat.profil.points += Math.max(0, Number(t.bonnes) || 0) * regles.points.qcm_juste;
  }
  return etat;
}

/** Met un état enregistré à la version courante. Renvoie null s'il est illisible. */
export function migrer(brut: unknown): Etat | null {
  if (!brut || typeof brut !== 'object') return null;
  const e = brut as { version?: number };
  // Les futures versions s'ajoutent ici : if (e.version === 1) e = deV1aV2(e); …
  return e.version === VERSION ? (brut as Etat) : null;
}

function lireJson(stockage: Stockage, cle: string): unknown {
  try {
    const s = stockage.getItem(cle);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

/** Lit la progression, en reprenant l'ancien format si besoin. Ne jette jamais d'erreur. */
export function lireEtat(stockage: Stockage | null, maintenant = Date.now()): Etat {
  if (!stockage) return etatVide(maintenant);
  const etat = migrer(lireJson(stockage, CLE));
  if (etat) return etat;
  const ancien = lireJson(stockage, ANCIENNE_CLE);
  if (ancien && typeof ancien === 'object') {
    const repris = depuisAncienFormat(ancien as Record<string, { quiz?: number; bonnes?: number }>, maintenant);
    ecrireEtat(stockage, repris); // l'ancienne clé est gardée telle quelle, par prudence
    return repris;
  }
  return etatVide(maintenant);
}

export function ecrireEtat(stockage: Stockage | null, etat: Etat): void {
  try {
    stockage?.setItem(CLE, JSON.stringify(etat));
  } catch {
    // navigation privée ou stockage plein : la progression n'est pas gardée
  }
}

/** localStorage s'il est disponible (il ne l'est pas toujours en navigation privée). */
export function stockageNavigateur(): Stockage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export type FinDeLecon = {
  theme: string;
  leconId: string;
  etape: number;
  epreuve: boolean;
  reussie: boolean;
  points: number;
  /** Pourcentage de bonnes réponses, de 0 à 100. */
  score: number;
  /** Réponse juste ou fausse pour chaque question jouée, par id de question. */
  reponses: Record<string, boolean>;
};

/** Enregistre une leçon terminée : points, série, animal au feu, grade, leçon faite et fiches de révision. */
export function terminerLecon(etat: Etat, fin: FinDeLecon, maintenant: number): Etat {
  const jour = jourParis(maintenant);
  const avant = etat.leconsFaites[fin.leconId];
  const revision = { ...etat.revision };
  for (const [id, juste] of Object.entries(fin.reponses)) {
    const fiche = apresReponse(revision[id] ?? null, juste, jour);
    if (fiche) revision[id] = fiche;
    else delete revision[id];
  }
  const grade = etat.grades[fin.theme] ?? GRADE_DE_DEPART;
  return {
    ...etat,
    profil: { ...etat.profil, points: etat.profil.points + fin.points, serie: apresLecon(etat.profil.serie, maintenant) },
    conjures: etat.conjures.includes(fin.theme) ? etat.conjures : [...etat.conjures, fin.theme],
    grades: fin.epreuve ? { ...etat.grades, [fin.theme]: gradeApresEpreuve(grade, fin.etape, fin.reussie) } : etat.grades,
    leconsFaites: fin.reussie || avant
      ? {
          ...etat.leconsFaites,
          [fin.leconId]: {
            meilleurScore: Math.max(avant?.meilleurScore ?? 0, fin.score),
            nbParties: (avant?.nbParties ?? 0) + 1,
            derniereFois: jour,
          },
        }
      : etat.leconsFaites,
    revision,
  };
}

/** Révision terminée : chaque fiche avance ou retourne en boîte 1 ; 3 questions ou plus rendent une bûche. */
export function terminerRevision(etat: Etat, reponses: Record<string, boolean>, maintenant: number): Etat {
  const jour = jourParis(maintenant);
  const revision = { ...etat.revision };
  for (const [id, juste] of Object.entries(reponses)) {
    const fiche = apresReponse(revision[id] ?? null, juste, jour);
    if (fiche) revision[id] = fiche;
  }
  const vies = viesApresRevision(etat.profil.vies, Object.keys(reponses).length, maintenant);
  return { ...etat, profil: { ...etat.profil, vies }, revision };
}
