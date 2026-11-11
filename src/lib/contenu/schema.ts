// Format d'une leçon et de ses questions (spécification technique § 4.1).
// Utilisé par la collection Astro (le build échoue si une leçon est mal formée) et par les contrôles de contenu.
import { z } from 'astro/zod';

const texte = (nom: string) => z.string().trim().min(1, `${nom} est vide`);

/**
 * Image facultative montrée au-dessus des choix (un tableau, une photo).
 * `alt` décrit l'image sans donner la réponse ; `legende` (titre, auteur, date, musée) ne s'affiche qu'après la réponse.
 */
export const image = z.object({
  src: z.string().regex(/^(https:\/\/|\/)/, "l'adresse de l'image commence par https:// ou /"),
  alt: texte("la description de l'image (alt)"),
  legende: texte("la légende de l'image"),
  credit: texte("le crédit de l'image"),
});

const commun = {
  image: image.optional(),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "l'id d'une question s'écrit en minuscules et tirets, ex. geo-cap-0012"),
  niveau: z.enum(['facile', 'moyen', 'difficile'], { error: 'niveau doit valoir facile, moyen ou difficile' }),
  q: texte("l'énoncé (q)"),
  explication: texte("l'explication"),
  source: texte('la source'),
};

export const questionQcm = z.object({
  ...commun,
  type: z.literal('qcm'),
  choix: z.array(texte('un choix')).length(4, 'un QCM a exactement 4 choix'),
  juste: z.number().int().min(0, 'juste doit être entre 0 et 3').max(3, 'juste doit être entre 0 et 3'),
});

export const questionCarte = z.object({
  ...commun,
  type: z.literal('carte'),
  cible: z.object({
    lat: z.number().min(-90, 'latitude hors de [-90, 90]').max(90, 'latitude hors de [-90, 90]'),
    lon: z.number().min(-180, 'longitude hors de [-180, 180]').max(180, 'longitude hors de [-180, 180]'),
  }),
  carte: texte('le nom de la carte'),
  tolerance_km: z.number().positive('tolerance_km doit être positive'),
});

export const questionSaisie = z.object({
  ...commun,
  type: z.literal('saisie'),
  reponses: z.array(z.array(texte('une réponse acceptée')).min(1, 'chaque réponse attendue a au moins une forme acceptée')).min(1, 'il faut au moins une réponse attendue'),
  duree_s: z.number().int().positive('duree_s doit être positive'),
});

/** Molette : on fait tourner des nombres (une année, un ordre de grandeur) jusqu'à la bonne valeur. */
export const questionMolette = z
  .object({
    ...commun,
    type: z.literal('molette'),
    min: z.number(),
    max: z.number(),
    pas: z.number().positive('pas doit être positif').default(1),
    juste: z.number(),
    unite: z.string().optional(),
    tolerance: z.number().min(0, 'tolerance ne peut pas être négative').default(0),
  })
  .superRefine((q, ctx) => {
    if (q.max <= q.min) ctx.addIssue({ code: 'custom', path: ['max'], message: 'max doit être plus grand que min' });
    else if ((q.max - q.min) / q.pas > 500) ctx.addIssue({ code: 'custom', path: ['pas'], message: 'la molette a plus de 500 crans : agrandir le pas ou réduire min et max' });
    if (q.juste < q.min || q.juste > q.max) ctx.addIssue({ code: 'custom', path: ['juste'], message: 'juste doit être entre min et max' });
    else if (Math.abs(((q.juste - q.min) / q.pas) - Math.round((q.juste - q.min) / q.pas)) > 1e-9)
      ctx.addIssue({ code: 'custom', path: ['juste'], message: 'juste doit tomber sur un cran de la molette (min + un multiple du pas)' });
  });

/** Jauge du feu : on vise une valeur sur un arc (un pourcentage par défaut) ; juste à « tolerance » près. */
export const questionJauge = z
  .object({
    ...commun,
    type: z.literal('jauge'),
    min: z.number().default(0),
    max: z.number().default(100),
    juste: z.number(),
    unite: z.string().default('%'),
    tolerance: z.number().min(0, 'tolerance ne peut pas être négative').default(5),
  })
  .superRefine((q, ctx) => {
    if (q.max <= q.min) ctx.addIssue({ code: 'custom', path: ['max'], message: 'max doit être plus grand que min' });
    if (q.juste < q.min || q.juste > q.max) ctx.addIssue({ code: 'custom', path: ['juste'], message: 'juste doit être entre min et max' });
  });

/** Pastilles : plusieurs bonnes réponses à cocher parmi des pièges. */
export const questionPastilles = z
  .object({
    ...commun,
    type: z.literal('pastilles'),
    choix: z.array(texte('un choix')).min(4, 'il faut au moins 4 pastilles').max(16, '16 pastilles au maximum'),
    justes: z.array(z.number().int()).min(2, 'il faut au moins 2 bonnes réponses (sinon, faire un QCM)'),
  })
  .superRefine((q, ctx) => {
    if (q.justes.some((k) => k < 0 || k >= q.choix.length)) ctx.addIssue({ code: 'custom', path: ['justes'], message: 'chaque numéro de justes doit désigner un choix (en comptant à partir de 0)' });
    if (new Set(q.justes).size !== q.justes.length) ctx.addIssue({ code: 'custom', path: ['justes'], message: 'un numéro est en double dans justes' });
    if (q.justes.length >= q.choix.length) ctx.addIssue({ code: 'custom', path: ['justes'], message: 'il faut au moins un piège parmi les choix' });
  });

/** Registre : une longue liste (rangée par ordre alphabétique à l'écran) où l'on cherche la bonne réponse. */
export const questionRegistre = z
  .object({
    ...commun,
    type: z.literal('registre'),
    choix: z.array(texte('un choix')).min(8, 'un registre a au moins 8 choix (sinon, faire un QCM)'),
    juste: texte('la bonne réponse (juste)'),
  })
  .superRefine((q, ctx) => {
    if (!q.choix.includes(q.juste)) ctx.addIssue({ code: 'custom', path: ['juste'], message: 'juste doit être écrit exactement comme un des choix' });
  });

export const question = z.discriminatedUnion('type', [questionQcm, questionCarte, questionSaisie, questionMolette, questionJauge, questionPastilles, questionRegistre], {
  error: 'type doit valoir qcm, carte, saisie, molette, jauge, pastilles ou registre',
});

export const lecon = z.object({
  id: z.string(),
  theme: z.string(),
  etape: z.number().int().min(1),
  lecon: z.number().int().min(1),
  titre: texte('le titre'),
  intro: z.string().optional(),
  epreuve: z.boolean().default(false),
  questions: z.array(question).min(1, 'une leçon a au moins une question'),
});

export type Question = z.infer<typeof question>;
export type Lecon = z.infer<typeof lecon>;
