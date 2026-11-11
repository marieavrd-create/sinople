// Les compteurs partagés du site (vues, parties jouées), gardés dans Supabase.
// Tant que src/data/supabase.json est vide, rien n'est envoyé et la page Stats affiche seulement celles de l'appareil.
// La clé de ce fichier est la clé « publishable » de Supabase : elle est faite pour être publique.
// Les tables sont fermées ; on ne passe que par les fonctions de supabase/migrations/0001_stats.sql.
import config from '../../data/supabase.json';

export type StatsSite = {
  vues: number;
  vues_jour: number;
  vues_7j: number;
  visiteurs: number;
  visiteurs_7j: number;
  parties: number;
  parties_reussies: number;
  score_moyen: number | null;
  par_theme: { theme: string; parties: number; score_moyen: number }[];
  pages: { page: string; vues: number }[];
  par_jour: { jour: string; vues: number }[];
};

export const statsActives = (): boolean => Boolean(config.url && config.cle);

async function appeler<T>(fonction: string, corps: Record<string, unknown> = {}): Promise<T | null> {
  if (!statsActives()) return null;
  try {
    const r = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/${fonction}`, {
      method: 'POST',
      headers: { apikey: config.cle, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      keepalive: true,
    });
    if (!r.ok) return null;
    const texte = await r.text();
    return texte ? (JSON.parse(texte) as T) : null;
  } catch {
    return null; // hors ligne ou Supabase indisponible : le jeu continue sans compter
  }
}

/** Un numéro tiré au hasard et gardé sur l'appareil, pour compter les visiteurs sans savoir qui ils sont. */
export function idVisiteur(stockage: Pick<Storage, 'getItem' | 'setItem'> | null): string | null {
  try {
    if (!stockage) return null;
    let id = stockage.getItem('sinople-visiteur');
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      id = crypto.randomUUID();
      stockage.setItem('sinople-visiteur', id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Le chemin de la page sans la base du site ni les numéros de leçon : « /quiz/religion/1-1 » reste tel quel. */
export function nomDePage(chemin: string, base: string): string {
  const p = chemin.startsWith(base) ? chemin.slice(base.length) : chemin;
  return (p.replace(/\/+$/, '') || '/').slice(0, 120);
}

export function compterVue(page: string, visiteur: string | null): Promise<unknown> {
  return appeler('compter_vue', { p_page: page, p_visiteur: visiteur });
}

export function compterPartie(p: { theme: string; lecon: string; score: number; reussie: boolean; visiteur: string | null }): Promise<unknown> {
  return appeler('compter_partie', { p_theme: p.theme, p_lecon: p.lecon, p_score: p.score, p_reussie: p.reussie, p_visiteur: p.visiteur });
}

export function lireStatsSite(): Promise<StatsSite | null> {
  return appeler<StatsSite>('stats_publiques');
}
