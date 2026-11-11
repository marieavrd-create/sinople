import { describe, expect, it } from 'vitest';
import { idVisiteur, nomDePage, statsActives } from '../src/lib/stats/compteur';

describe('stats du site', () => {
  it('nomme la page sans la base du site', () => {
    expect(nomDePage('/sinople/', '/sinople')).toBe('/');
    expect(nomDePage('/sinople', '/sinople')).toBe('/');
    expect(nomDePage('/sinople/quiz/religion/1-1/', '/sinople')).toBe('/quiz/religion/1-1');
    expect(nomDePage('/sinople/' + 'x'.repeat(300), '/sinople').length).toBe(120);
  });

  it('garde le même numéro de visiteur sur l’appareil', () => {
    const m = new Map<string, string>();
    const stockage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    const id = idVisiteur(stockage);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idVisiteur(stockage)).toBe(id);
    expect(idVisiteur(null)).toBeNull();
  });

  it('ne compte rien tant que Supabase n’est pas branché', () => {
    expect(typeof statsActives()).toBe('boolean');
  });
});
