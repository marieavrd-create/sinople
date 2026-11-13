// Les quatre formats de réponse venus de la maquette brune : molette, jauge du feu, pastilles et registre.
// Chaque composant affiche la question et rend la réponse au lecteur de leçon (LecteurLecon), qui corrige et compte les points.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { crans, ordreAlphabetique, sansAccents } from '../lib/jeu/formats';

/** Image facultative d'une question (un tableau…) ; la légende ne s'affiche qu'après la réponse. */
export type ImageQuestion = { src: string; alt: string; legende: string; credit: string };
type Commun = { id: string; q: string; niveau: string; explication: string; source: string; image?: ImageQuestion };
export type QuestionMolette = Commun & { type: 'molette'; min: number; max: number; pas?: number; juste: number; unite?: string; tolerance?: number };
export type QuestionJauge = Commun & { type: 'jauge'; min?: number; max?: number; juste: number; unite?: string; tolerance?: number };
export type QuestionPastilles = Commun & { type: 'pastilles'; choix: string[]; justes: number[] };
export type QuestionRegistre = Commun & { type: 'registre'; choix: string[]; juste: string };

/** 1969, 71 %, 16 000 000 : les milliers ne sont séparés qu'à partir de 10 000 (une année reste collée). */
export function nombre(n: number, unite?: string) {
  const t = Math.abs(n) >= 10_000 ? n.toLocaleString('fr-FR') : String(n).replace('.', ',');
  return unite ? `${t} ${unite}` : t;
}

/**
 * Petite vibration à chaque cran : navigator.vibrate sur Android ;
 * sur iPhone (iOS 18 et plus), un interrupteur caché qu'on bascule donne un léger retour, quand Safari le permet.
 */
function vibrer(interrupteur: HTMLLabelElement | null) {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(8);
    else interrupteur?.click();
  } catch {
    /* pas de vibration possible : tant pis */
  }
}

function Interrupteur({ r }: { r: { current: HTMLLabelElement | null } }) {
  return (
    <label class="haptique" ref={r} aria-hidden="true">
      {/* @ts-expect-error l'attribut switch de Safari n'est pas encore dans les types */}
      <input type="checkbox" switch tabIndex={-1} />
    </label>
  );
}

// ---------- La molette ----------
const H = 56; // hauteur d'un cran, en pixels

export function Molette({ q, valeur, choisir, corrige, ok }: { q: QuestionMolette; valeur: number | null; choisir: (v: number) => void; corrige: boolean; ok: boolean }) {
  const liste = useMemo(() => crans(q.min, q.max, q.pas ?? 1), [q.id]);
  // Départ au milieu, sauf si le milieu est la bonne réponse : on part alors un quart plus bas, pour ne pas la souffler.
  const milieu = Math.floor((liste.length - 1) / 2);
  const depart = liste[milieu] === q.juste && liste.length > 2 ? Math.max(0, milieu - Math.max(1, Math.round(liste.length / 4))) : milieu;
  const [idx, setIdx] = useState(depart);
  const zone = useRef<HTMLDivElement>(null);
  const interrupteur = useRef<HTMLLabelElement>(null);
  const touche = useRef(false);

  // Nouvelle question : la molette repart du milieu, sans compter comme un choix.
  useEffect(() => {
    touche.current = false;
    setIdx(depart);
    if (zone.current) zone.current.scrollTop = depart * H;
  }, [q.id]);

  function defiler() {
    if (corrige || !zone.current) return;
    const k = Math.max(0, Math.min(liste.length - 1, Math.round(zone.current.scrollTop / H)));
    if (k === idx) return;
    if (k !== depart) touche.current = true;
    if (touche.current) {
      vibrer(interrupteur.current);
      choisir(liste[k]);
    }
    setIdx(k);
  }
  const aller = (k: number) => {
    touche.current = true;
    // Le nombre déjà dans la pilule : rien ne défile, on le choisit directement.
    if (k === idx) {
      vibrer(interrupteur.current);
      choisir(liste[k]);
      return;
    }
    zone.current?.scrollTo({ top: Math.max(0, Math.min(liste.length - 1, k)) * H, behavior: 'smooth' });
  };

  const affiche = valeur ?? liste[idx];
  return (
    <div class={`molette-zone${corrige ? (ok ? ' juste' : ' faux') : ''}`}>
      <div class="pilule" aria-hidden="true">{nombre(affiche, q.unite)}</div>
      <div
        class="molette"
        ref={zone}
        onScroll={defiler}
        tabIndex={corrige ? -1 : 0}
        role="spinbutton"
        aria-labelledby="question"
        aria-valuemin={q.min}
        aria-valuemax={q.max}
        aria-valuenow={affiche}
        aria-valuetext={nombre(affiche, q.unite)}
        aria-disabled={corrige}
        style={corrige ? { overflow: 'hidden' } : undefined}
        onKeyDown={(e) => {
          if (corrige) return;
          if (e.key === 'ArrowUp') { e.preventDefault(); aller(idx - 1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); aller(idx + 1); }
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aller(idx); }
        }}
      >
        <ol>
          {liste.map((v, k) => (
            <li class={k === idx ? 'choisi' : Math.abs(k - idx) === 1 ? 'proche' : ''} onClick={() => !corrige && aller(k)}>
              {nombre(v, q.unite)}
            </li>
          ))}
        </ol>
      </div>
      <Interrupteur r={interrupteur} />
      <p class="aide">{corrige ? '' : valeur === null ? 'Fais tourner la molette, ou touche le nombre pour le garder' : ''}</p>
    </div>
  );
}

// ---------- La jauge du feu ----------
const CX = 150, CY = 150, R = 120;
const point = (part: number) => {
  const a = Math.PI * (1 - part);
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
};

/** Glacé, tiède, chaud, brûlant : à quel point on a visé près. */
export function chaleur(ecart: number, tolerance: number, amplitude: number) {
  const t = Math.max(tolerance, amplitude / 100);
  return ecart <= t / 2 ? 'Brûlant !' : ecart <= t ? 'Chaud !' : ecart <= 3 * t ? 'Tiède…' : 'Glacé.';
}

export function Jauge({ q, valeur, choisir, corrige }: { q: QuestionJauge; valeur: number | null; choisir: (v: number) => void; corrige: boolean }) {
  const min = q.min ?? 0, max = q.max ?? 100, unite = q.unite ?? '%';
  const pas = (max - min) / 100;
  const v = valeur ?? (min + max) / 2;
  const part = (v - min) / (max - min);
  const svg = useRef<SVGSVGElement>(null);
  const tire = useRef(false);

  const poser = (x: number) => {
    if (corrige) return;
    const borne = Math.max(min, Math.min(max, x));
    choisir(Number((Math.round((borne - min) / pas) * pas + min).toFixed(6)));
  };
  const depuis = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const k = 300 / r.width;
    const x = (e.clientX - r.left) * k - CX;
    const y = CY - (e.clientY - r.top) * k;
    poser(min + (max - min) * (1 - Math.atan2(Math.max(y, 0), x) / Math.PI));
  };

  const [px, py] = point(part);
  const [jx, jy] = point((q.juste - min) / (max - min));
  return (
    <div class="jauge-zone">
      <p class="jauge-valeur" aria-hidden="true">{valeur === null ? '?' : nombre(v, unite)}</p>
      <p class="jauge-chaleur" aria-live="polite">
        {corrige && valeur !== null ? chaleur(Math.abs(valeur - q.juste), q.tolerance ?? 5, max - min) : valeur === null ? 'Fais glisser le goupil' : ''}
      </p>
      <svg
        ref={svg}
        class="jauge"
        viewBox="0 0 300 180"
        role="slider"
        tabIndex={corrige ? -1 : 0}
        aria-labelledby="question"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={v}
        aria-valuetext={nombre(v, unite)}
        aria-disabled={corrige}
        onPointerDown={(e) => { if (corrige) return; tire.current = true; svg.current?.setPointerCapture(e.pointerId); depuis(e); }}
        onPointerMove={(e) => tire.current && depuis(e)}
        onPointerUp={() => (tire.current = false)}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowDown'].includes(e.key)) { e.preventDefault(); poser(v - pas); }
          if (['ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); poser(v + pas); }
        }}
      >
        <defs>
          <linearGradient id="jauge-flamme" x1="0" x2="1">
            <stop offset="0" stop-color="#c9955f" />
            <stop offset=".6" stop-color="#e07a2e" />
            <stop offset="1" stop-color="#e3b448" />
          </linearGradient>
        </defs>
        <path class="piste" d="M30 150 A120 120 0 0 1 270 150" />
        <path class="rempli" d="M30 150 A120 120 0 0 1 270 150" pathLength={100} stroke-dasharray={`${part * 100} 100`} />
        {Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI * (1 - (i + 1) / 10);
          return <line class="graduation" x1={CX + 103 * Math.cos(a)} y1={CY - 103 * Math.sin(a)} x2={CX + 137 * Math.cos(a)} y2={CY - 137 * Math.sin(a)} />;
        })}
        {corrige && (
          <g class="repere">
            <circle cx={jx} cy={jy} r={22} />
            <text x={jx} y={jy - 30} text-anchor="middle">{nombre(q.juste, unite)}</text>
          </g>
        )}
        <circle class="poignee" cx={px} cy={py} r={17} />
        <text class="borne" x={30} y={176} text-anchor="middle">{nombre(min, unite)}</text>
        <text class="borne" x={270} y={176} text-anchor="middle">{nombre(max, unite)}</text>
      </svg>
      <div class="jauge-pas">
        <button type="button" class="icone-bouton" disabled={corrige} onClick={() => poser(v - pas)} aria-label="Un cran de moins">−</button>
        <button type="button" class="icone-bouton" disabled={corrige} onClick={() => poser(v + pas)} aria-label="Un cran de plus">+</button>
      </div>
    </div>
  );
}

// ---------- Les pastilles ----------
export function Pastilles({ q, cochees, basculer, corrige }: { q: QuestionPastilles; cochees: number[]; basculer: (k: number) => void; corrige: boolean }) {
  const justes = new Set(q.justes);
  return (
    <>
      <p class="consigne">Coche toutes les bonnes réponses.</p>
      <div class="pastilles" role="group" aria-labelledby="question">
        {q.choix.map((c, k) => {
          const prise = cochees.includes(k);
          const etat = !corrige ? '' : prise && justes.has(k) ? ' juste' : prise ? ' faux' : justes.has(k) ? ' manquee' : '';
          return (
            <button type="button" class={`pastille${etat}`} aria-pressed={prise} disabled={corrige} onClick={() => basculer(k)}>
              {c}
              {etat === ' juste' && <span class="invisible"> (bonne réponse)</span>}
              {etat === ' faux' && <span class="invisible"> (piège)</span>}
              {etat === ' manquee' && <span class="invisible"> (bonne réponse oubliée)</span>}
            </button>
          );
        })}
      </div>
      <p class="compteur-pastilles" aria-live="polite">
        {cochees.length === 0 ? 'Aucune cochée' : `${cochees.length} cochée${cochees.length > 1 ? 's' : ''}`}
      </p>
    </>
  );
}

// ---------- Le registre ----------
export function Registre({ q, choisi, choisir, corrige }: { q: QuestionRegistre; choisi: number; choisir: (k: number) => void; corrige: boolean }) {
  const [cherche, setCherche] = useState('');
  const liste = useRef<HTMLUListElement>(null);
  const ranges = useMemo(() => ordreAlphabetique(q.choix).map((c) => ({ c, k: q.choix.indexOf(c), n: sansAccents(c) })), [q.id]);
  const lettres = useMemo(() => new Set(ranges.map((r) => r.n[0]?.toUpperCase())), [ranges]);

  useEffect(() => setCherche(''), [q.id, corrige]);
  // Après la correction, la bonne réponse vient se montrer dans la liste.
  useEffect(() => {
    if (!corrige || !liste.current) return;
    const bonne = liste.current.querySelector<HTMLElement>('.ligne.juste')?.parentElement;
    if (bonne) liste.current.scrollTo({ top: bonne.offsetTop - liste.current.offsetTop - 8, behavior: 'smooth' });
  }, [corrige]);
  const vues = ranges.filter((r) => !cherche || r.n.includes(sansAccents(cherche.trim())));

  const allerA = (l: string) => {
    const cible = liste.current?.querySelector<HTMLElement>(`[data-lettre="${l}"]`);
    if (cible && liste.current) liste.current.scrollTo({ top: cible.offsetTop - liste.current.offsetTop, behavior: 'smooth' });
  };

  let derniere = '';
  return (
    <div class="registre">
      <label class="recherche">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          type="search"
          value={cherche}
          disabled={corrige}
          onInput={(e) => setCherche((e.target as HTMLInputElement).value)}
          placeholder="Chercher dans la liste"
          aria-label="Chercher dans la liste"
          autocomplete="off"
          spellcheck={false}
        />
      </label>
      <div class="alphabet" aria-label="Aller à une lettre">
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
          <button type="button" disabled={!lettres.has(l) || !!cherche || corrige} onClick={() => allerA(l)} aria-label={`Lettre ${l}`}>{l}</button>
        ))}
      </div>
      <ul class="liste" ref={liste} role="radiogroup" aria-labelledby="question">
        {vues.map(({ c, k, n }) => {
          const l = n[0]?.toUpperCase();
          const premiere = l !== derniere;
          derniere = l;
          const etat = !corrige ? '' : c === q.juste ? ' juste' : k === choisi ? ' faux' : '';
          return (
            <li data-lettre={premiere ? l : undefined}>
              <button type="button" role="radio" aria-checked={choisi === k} class={`ligne${etat}`} disabled={corrige} onClick={() => choisir(k)}>
                {c}
                {etat === ' juste' && <span class="invisible"> (bonne réponse)</span>}
                {etat === ' faux' && <span class="invisible"> (ta réponse, fausse)</span>}
              </button>
            </li>
          );
        })}
        {vues.length === 0 && <li class="vide">Rien ne correspond dans la liste.</li>}
      </ul>
    </div>
  );
}
