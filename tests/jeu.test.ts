import { describe, expect, it } from 'vitest';
import { normaliser, levenshtein, estAcceptee, trouverReponse, trouverExacte, saisieJuste } from '../src/lib/jeu/reponses';
import { pointsQcm, pointsCarte, pointsSaisie, distanceKm, bilanLecon } from '../src/lib/jeu/points';
import { viesDeDepart, viesActuelles, perdreVie, viesApresRevision, prochaineVieDans } from '../src/lib/jeu/vies';
import { jourParis, joursEntre, apresLecon, serieDuJour, serieDeDepart } from '../src/lib/jeu/serie';
import { apresReponse, aReviser } from '../src/lib/jeu/revision';
import { gradeApresEpreuve, duelDebloque } from '../src/lib/jeu/grades';

const MIN = 60_000;
// Midi à Paris (heure d'hiver, UTC+1) le jour donné.
const midi = (jour: string) => Date.parse(`${jour}T11:00:00Z`);

describe('réponses tapées', () => {
  it('normalisent casse, accents, ponctuation et articles', () => {
    expect(normaliser("  L'Égypte ! ")).toBe('egypte');
    expect(normaliser('Les États-Unis')).toBe('etats unis');
    expect(normaliser('la Paz')).toBe('paz');
    expect(normaliser('Lesotho')).toBe('lesotho');
    expect(normaliser('L’Inde')).toBe('inde');
  });

  it('tolèrent une faute à partir de 5 lettres seulement', () => {
    expect(levenshtein('ljubljana', 'ljubjana')).toBe(1);
    expect(estAcceptee('Ljubjana', ['Ljubljana'])).toBe(true);
    expect(estAcceptee('Lubjana', ['Ljubljana'])).toBe(false);
    expect(estAcceptee('Rone', ['Rome'])).toBe(false);
    expect(estAcceptee('rome', ['Rome'])).toBe(true);
    expect(estAcceptee('', ['Rome'])).toBe(false);
  });

  it('acceptent toutes les formes prévues et ne trouvent pas deux fois la même réponse', () => {
    const reponses = [['Inde'], ['Chine'], ['États-Unis', 'USA', 'Etats Unis']];
    expect(trouverReponse('usa', reponses)).toBe(2);
    expect(trouverReponse('etats-unis', reponses)).toBe(2);
    expect(trouverReponse('Inde', reponses, new Set([0]))).toBe(-1);
    expect(trouverReponse('Brésil', reponses)).toBe(-1);
  });

  it('« etats unis », « États-Unis » et « USA » sont acceptés quand prévus', () => {
    const formes = ['États-Unis', 'USA', 'Etats Unis'];
    for (const s of ['etats unis', 'États-Unis', 'USA', 'usa', 'Etats-Unis', ' les États-Unis ']) expect(estAcceptee(s, formes)).toBe(true);
    expect(estAcceptee('Unis', formes)).toBe(false);
  });

  it('pendant la frappe, seule une saisie exacte trouve une réponse', () => {
    const reponses = [['Mexique'], ['Inde'], ['États-Unis', 'USA']];
    expect(trouverExacte('Mexiqe', reponses)).toBe(-1); // une faute de frappe : pas encore trouvée pendant la frappe
    expect(trouverReponse('Mexiqe', reponses)).toBe(0); // à la validation, la faute est tolérée
    expect(trouverExacte('mexique', reponses)).toBe(0);
    expect(trouverExacte('etats unis', reponses)).toBe(2);
    expect(trouverExacte('', reponses)).toBe(-1);
  });

  it('une liste est juste à partir de 70 % des réponses, une réponse seule doit être trouvée', () => {
    expect(saisieJuste(1, 1)).toBe(true);
    expect(saisieJuste(0, 1)).toBe(false);
    expect(saisieJuste(4, 5)).toBe(true);
    expect(saisieJuste(3, 5)).toBe(false);
    expect(saisieJuste(2, 3)).toBe(false);
    expect(saisieJuste(3, 3)).toBe(true);
  });
});

describe('points', () => {
  it('d’une question', () => {
    expect(pointsQcm(true)).toBe(10);
    expect(pointsQcm(false)).toBe(0);
    expect(pointsCarte(0, 300)).toBe(10);
    expect(pointsCarte(150, 300)).toBe(5);
    expect(pointsCarte(400, 300)).toBe(0);
    expect(pointsSaisie(3, 5)).toBe(6);
    expect(pointsSaisie(5, 5)).toBe(10);
  });

  it('calculent une distance réaliste', () => {
    const paris = { lat: 48.8566, lon: 2.3522 };
    const lyon = { lat: 45.764, lon: 4.8357 };
    expect(distanceKm(paris, lyon)).toBeGreaterThan(385);
    expect(distanceKm(paris, lyon)).toBeLessThan(400);
  });

  it('d’une leçon : réussite, bonus sans faute et bonus de série plafonné', () => {
    const juste = { points: 10, juste: true };
    const faux = { points: 0, juste: false };

    const sansFaute = bilanLecon([juste, juste, juste, juste]);
    expect(sansFaute).toMatchObject({ reussie: true, points: 40, bonusSansFaute: 20, bonusSerie: 0, totalPoints: 60 });

    expect(bilanLecon([juste, juste, juste, juste, juste, juste, juste, faux, faux, faux]).reussie).toBe(true); // 70 %
    expect(bilanLecon([juste, juste, juste, juste, juste, juste, faux, faux, faux, faux]).reussie).toBe(false); // 60 %
    expect(bilanLecon([juste, juste, juste, juste, juste, juste, juste, faux, faux, faux], { epreuve: true }).reussie).toBe(false); // 70 % < 80 %

    expect(bilanLecon([juste, juste, faux], { joursSerie: 2 }).bonusSerie).toBe(4); // 20 × 20 %
    expect(bilanLecon([juste, juste, faux], { joursSerie: 30 }).bonusSerie).toBe(10); // plafonné à 50 %
    expect(bilanLecon([]).reussie).toBe(false);
  });
});

describe('vies', () => {
  const t0 = midi('2026-11-02');

  it('reviennent une par une toutes les 30 minutes, sans dépasser 5', () => {
    const etat = { vies: 2, maj: t0 };
    expect(viesActuelles(etat, t0 + 29 * MIN).vies).toBe(2);
    expect(viesActuelles(etat, t0 + 30 * MIN).vies).toBe(3);
    expect(viesActuelles(etat, t0 + 75 * MIN)).toEqual({ vies: 4, maj: t0 + 60 * MIN });
    expect(viesActuelles(etat, t0 + 10 * 60 * MIN).vies).toBe(5);
  });

  it('se perdent sans descendre sous zéro, et la recharge démarre à la première perte', () => {
    let etat = viesDeDepart(t0);
    etat = perdreVie(etat, t0 + 5 * MIN);
    expect(etat).toEqual({ vies: 4, maj: t0 + 5 * MIN });
    expect(prochaineVieDans(etat, t0 + 15 * MIN)).toBe(20 * MIN);
    expect(perdreVie({ vies: 0, maj: t0 }, t0 + MIN).vies).toBe(0);
    expect(prochaineVieDans(viesDeDepart(t0), t0)).toBe(0);
  });

  it('reviennent après une révision de 3 questions au moins', () => {
    expect(viesApresRevision({ vies: 1, maj: t0 }, 3, t0).vies).toBe(2);
    expect(viesApresRevision({ vies: 1, maj: t0 }, 2, t0).vies).toBe(1);
    expect(viesApresRevision({ vies: 5, maj: t0 }, 10, t0).vies).toBe(5);
  });
});

describe('série', () => {
  it('suit le jour de Paris, pas celui de Londres', () => {
    expect(jourParis(Date.parse('2026-11-02T23:30:00Z'))).toBe('2026-11-03');
    expect(jourParis(Date.parse('2026-07-01T22:30:00Z'))).toBe('2026-07-02'); // heure d'été
    expect(joursEntre('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('continue le lendemain, ne bouge pas le même jour, repart à 1 après un trou', () => {
    let s = apresLecon(serieDeDepart, midi('2026-11-02'));
    expect(s).toEqual({ jours: 1, dernierJour: '2026-11-02', gels: 0 });
    s = apresLecon(s, midi('2026-11-02') + 60 * MIN);
    expect(s.jours).toBe(1);
    s = apresLecon(s, midi('2026-11-03'));
    expect(s.jours).toBe(2);
    expect(serieDuJour(s, midi('2026-11-04'))).toBe(2);
    expect(serieDuJour(s, midi('2026-11-05'))).toBe(0);
    expect(apresLecon(s, midi('2026-11-05')).jours).toBe(1);
  });

  it('gagne un gel tous les 7 jours (2 au plus) et le consomme pour un jour manqué', () => {
    let s = serieDeDepart;
    for (let j = 1; j <= 21; j++) s = apresLecon(s, midi(`2026-12-${String(j).padStart(2, '0')}`));
    expect(s).toMatchObject({ jours: 21, gels: 2 });

    // Le 22 et le 23 sont manqués : les deux gels couvrent ; le 24 la série continue.
    expect(serieDuJour(s, midi('2026-12-24'))).toBe(21);
    s = apresLecon(s, midi('2026-12-24'));
    expect(s).toMatchObject({ jours: 22, gels: 0 });
  });
});

describe('révision (Leitner)', () => {
  it('met une question ratée en boîte 1, révisable le jour même, puis espace les rappels', () => {
    let f = apresReponse(null, false, '2026-11-02');
    expect(f).toEqual({ boite: 1, aRevoirLe: '2026-11-02' }); // révisable le jour même
    f = apresReponse(f, true, '2026-11-02');
    expect(f).toEqual({ boite: 2, aRevoirLe: '2026-11-03' });
    f = apresReponse(f, true, '2026-11-03');
    expect(f).toEqual({ boite: 3, aRevoirLe: '2026-11-05' });
    f = apresReponse(f, false, '2026-11-05');
    expect(f).toEqual({ boite: 1, aRevoirLe: '2026-11-05' });
    expect(apresReponse({ boite: 6, aRevoirLe: '2026-11-01' }, true, '2026-11-01')).toEqual({ boite: 6, aRevoirLe: '2026-11-17' });
  });

  it('ignore une question bien répondue du premier coup', () => {
    expect(apresReponse(null, true, '2026-11-02')).toBeNull();
  });

  it('donne les questions à revoir, les plus en retard d’abord', () => {
    const fiches = {
      a: { boite: 2, aRevoirLe: '2026-11-03' },
      b: { boite: 1, aRevoirLe: '2026-11-01' },
      c: { boite: 1, aRevoirLe: '2026-11-04' },
    };
    expect(aReviser(fiches, '2026-11-03')).toEqual(['b', 'a']);
  });
});

describe('grades', () => {
  it('montent après une épreuve réussie, peuvent sauter des étapes, ne descendent pas', () => {
    expect(gradeApresEpreuve(1, 1, true)).toBe(2);
    expect(gradeApresEpreuve(1, 1, false)).toBe(1);
    expect(gradeApresEpreuve(2, 4, true)).toBe(5);
    expect(gradeApresEpreuve(5, 2, true)).toBe(5);
    expect(gradeApresEpreuve(6, 6, true)).toBe(6);
  });

  it('ouvrent le duel final quand tous les animaux sont au grade 6', () => {
    expect(duelDebloque({ a: 6, b: 6 }, ['a', 'b'])).toBe(true);
    expect(duelDebloque({ a: 6 }, ['a', 'b'])).toBe(false);
  });
});
