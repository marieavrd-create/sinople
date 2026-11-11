// Lecteur de leçon : une question à la fois (QCM, réponse à taper, molette, jauge, pastilles ou registre), les vies en bûches, la barre d'avancement,
// l'explication et la source après chaque réponse, puis le bilan. À zéro vie, le feu s'éteint et la leçon s'arrête.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { lireEtat, ecrireEtat, stockageNavigateur } from '../lib/stockage/local';
import { viesActuelles, perdreVie, prochaineVieDans } from '../lib/jeu/vies';
import { construireChemin, leconAccessible, type LeconDuChemin } from '../lib/jeu/chemin';
import { regles } from '../lib/jeu/regles';
import { pointsQcm, pointsSaisie, type Bilan } from '../lib/jeu/points';
import { estAcceptee, trouverExacte, trouverReponse, saisieJuste } from '../lib/jeu/reponses';
import { enregistrerFin, enregistrerRevision } from '../scripts/fin-de-lecon';
import { estimationJuste, pointsEstimation, pastillesJustes, pointsPastilles } from '../lib/jeu/formats';
import { Molette, Jauge, Pastilles, Registre, nombre, type ImageQuestion, type QuestionMolette, type QuestionJauge, type QuestionPastilles, type QuestionRegistre } from './Formats';

type Commun = { id: string; q: string; niveau: string; explication: string; source: string; image?: ImageQuestion };
export type QuestionQcm = Commun & { type: 'qcm'; choix: string[]; juste: number };
/** Réponse à taper : une seule réponse attendue, ou une liste à compléter avant la fin du chrono. */
export type QuestionSaisie = Commun & { type: 'saisie'; reponses: string[][]; duree_s: number };
export type QuestionJeu = QuestionQcm | QuestionSaisie | QuestionMolette | QuestionJauge | QuestionPastilles | QuestionRegistre;

type Props = {
  base: string;
  nomTheme: string;
  lecon: { id: string; theme: string; etape: number; titre: string; epreuve: boolean };
  /** Pour la scène de passage de grade : « le bélier », et les noms des 6 grades du thème. */
  animal: string;
  grades: string[];
  questions: QuestionJeu[];
  chemin: LeconDuChemin[];
  /** Mode révision : pas de bûche perdue, pas de verrou ; la fin rend une bûche (5 questions minimum). */
  revision?: boolean;
};

type Ecran = 'question' | 'eteint' | 'fin' | 'fin-revision';

const MAX = regles.vies.max;

/** L'image d'une question (un tableau…). La légende, qui donne souvent la réponse, n'apparaît qu'une fois la question corrigée. */
function Tableau({ image, corrige }: { image: ImageQuestion; corrige: boolean }) {
  const [rate, setRate] = useState(false);
  if (rate) return null; // image injoignable (hors ligne) : la question reste lisible sans elle
  return (
    <figure class="tableau">
      <img src={image.src} alt={image.alt} decoding="async" onError={() => setRate(true)} />
      {corrige && (
        <figcaption>
          {typo(image.legende)} <span class="credit">({typo(image.credit)})</span>
        </figcaption>
      )}
    </figure>
  );
}

function Buches({ vies }: { vies: number }) {
  return (
    <span class="buches" role="img" aria-label={`${vies} vie${vies > 1 ? 's' : ''} sur ${MAX}`}>
      {Array.from({ length: MAX }, (_, i) => (
        <svg class={`buche ${i < vies ? 'allumee' : 'brulee'}`} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path class="flammeche" d="M12 2c2 3 4 4.5 4 7.5A4 4 0 0 1 8 9.5C8 7.5 10 6 12 2z" />
          <rect class="bois" x="2" y="13" width="20" height="8" rx="4" />
          <circle class="cerne" cx="18" cy="17" r="2.2" />
        </svg>
      ))}
    </span>
  );
}

function FeuEteint() {
  return (
    <svg class="feu-eteint" viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
      <path class="fumee" d="M80 70c-10-12 8-18-2-32s6-20 0-30" />
      <rect x="35" y="78" width="90" height="16" rx="8" transform="rotate(-12 80 86)" fill="#5a4636" />
      <rect x="35" y="78" width="90" height="16" rx="8" transform="rotate(12 80 86)" fill="#4a3a2d" />
      <ellipse cx="80" cy="102" rx="60" ry="8" fill="rgb(0 0 0 / .25)" />
    </svg>
  );
}

/** Typographie française : espace fine insécable avant ? ! : ; (le signe ne part plus seul à la ligne). */
const typo = (t: string) => t.replace(/\s+([?!:;])/g, '\u202f$1');

function formatDuree(ms: number) {
  const min = Math.ceil(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

export default function LecteurLecon({ base, nomTheme, lecon, questions, chemin, animal, grades, revision = false }: Props) {
  const retour = revision ? `${base}/` : `${base}/theme/${lecon.theme}`;
  const [vies, setVies] = useState(MAX);
  const [ecran, setEcran] = useState<Ecran>('question');
  const [i, setI] = useState(0);
  const [choisi, setChoisi] = useState(-1);
  // Molette et jauge : la valeur choisie (null tant qu'on n'a pas bougé) ; pastilles : les numéros cochés.
  const [valeur, setValeur] = useState<number | null>(null);
  const [cochees, setCochees] = useState<number[]>([]);
  const [corrige, setCorrige] = useState(false);
  const [reponses, setReponses] = useState<Record<string, boolean>>({});
  const [points, setPoints] = useState<Record<string, number>>({});
  // Réponse à taper : le texte en cours, les réponses de la liste déjà trouvées, le chrono.
  const [texte, setTexte] = useState('');
  const [trouvees, setTrouvees] = useState<number[]>([]);
  // null tant que le chrono de la question n'est pas lancé (il ne doit pas valider une question qui commence)
  const [reste, setReste] = useState<number | null>(null);
  const [astuce, setAstuce] = useState('');
  const champ = useRef<HTMLInputElement>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [promu, setPromu] = useState(0);
  const [rendue, setRendue] = useState(false);
  // Un court temps avant « Continuer » : un double toucher ne saute plus l'explication.
  const verrou = useRef(false);
  const [attente, setAttente] = useState(0);

  // Au chargement : leçon verrouillée → retour au chemin ; plus de vie → feu éteint.
  useEffect(() => {
    const maintenant = Date.now();
    const etat = lireEtat(stockageNavigateur(), maintenant);
    const c = construireChemin(chemin, new Set(Object.keys(etat.leconsFaites)), etat.grades[lecon.theme] ?? 1);
    if (!revision && !leconAccessible(c, lecon.id)) {
      location.replace(retour);
      return;
    }
    const v = viesActuelles(etat.profil.vies, maintenant);
    setVies(v.vies);
    if (v.vies === 0 && !revision) {
      setAttente(prochaineVieDans(etat.profil.vies, maintenant));
      setEcran('eteint');
    }
  }, []);

  // Clavier : les touches 1 à 4 choisissent, les flèches passent d'une réponse à l'autre.
  useEffect(() => {
    const courante = questions[i];
    if (ecran !== 'question' || corrige || courante?.type !== 'qcm') return;
    const auClavier = (e: KeyboardEvent) => {
      const n = courante.choix.length;
      let k = -1;
      if (/^[1-9]$/.test(e.key)) k = Number(e.key) - 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') k = (choisi + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') k = (Math.max(choisi, 0) - 1 + n) % n;
      if (k < 0 || k >= n) return;
      e.preventDefault();
      setChoisi(k);
      document.querySelectorAll<HTMLButtonElement>('.lecteur .reponse')[k]?.focus();
    };
    addEventListener('keydown', auClavier);
    return () => removeEventListener('keydown', auClavier);
  }, [ecran, corrige, choisi, i]);

  const q = questions[i];
  const liste = q?.type === 'saisie' && q.reponses.length > 1;
  const ok = estJuste(q);
  function estJuste(q: QuestionJeu | undefined): boolean {
    switch (q?.type) {
      case 'saisie': return saisieJuste(trouvees.length, q.reponses.length);
      case 'qcm': return choisi === q.juste;
      case 'molette': case 'jauge': return valeur !== null && estimationJuste(valeur, q.juste, q.tolerance ?? (q.type === 'jauge' ? 5 : 0));
      case 'pastilles': return pastillesJustes(cochees, q.justes);
      case 'registre': return choisi >= 0 && q.choix[choisi] === q.juste;
      default: return false;
    }
  }

  // Nouvelle question à taper : curseur dans le champ, chrono lancé pour une liste
  // (le champ est vidé dans continuer(), avant l'affichage, pour ne pas effacer une frappe rapide).
  useEffect(() => {
    if (ecran !== 'question' || q?.type !== 'saisie') return;
    setReste(q.reponses.length > 1 ? q.duree_s : null);
    champ.current?.focus();
  }, [i, ecran]);

  useEffect(() => {
    if (!liste || corrige || ecran !== 'question' || reste === null) return;
    if (reste <= 0) return valider();
    const t = setTimeout(() => setReste((r) => (r === null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [reste, liste, corrige, ecran]);

  // Toute la liste trouvée avant la fin du chrono : on n'attend pas « J'ai fini ».
  useEffect(() => {
    if (liste && !corrige && q.type === 'saisie' && trouvees.length === q.reponses.length) valider();
  }, [trouvees]);

  /** Liste : chaque réponse exacte est prise dès qu'elle est tapée, et le champ se vide pour la suivante. */
  function taper(valeur: string) {
    setTexte(valeur);
    if (!liste || q.type !== 'saisie') return;
    const k = trouverExacte(valeur, q.reponses);
    if (k < 0) return setAstuce('');
    if (trouvees.includes(k)) return setAstuce('Déjà trouvée');
    setTrouvees([...trouvees, k]);
    setTexte('');
    setAstuce('');
  }

  /** Entrée : pour une liste, on essaie la saisie avec une faute tolérée ; pour une réponse seule, on valide. */
  function entree() {
    if (corrige || q.type !== 'saisie') return;
    if (!liste) return valider();
    const saisie = champ.current?.value ?? texte;
    const k = trouverReponse(saisie, q.reponses, new Set(trouvees));
    if (k >= 0) {
      setTrouvees([...trouvees, k]);
      setTexte('');
      setAstuce('');
    } else if (saisie.trim()) setAstuce('Pas dans la liste');
  }
  const fait = i + (corrige ? 1 : 0);
  const pourcent = useMemo(() => (questions.length ? (fait / questions.length) * 100 : 0), [fait, questions.length]);

  function valider() {
    if (corrige) return;
    let juste = ok;
    let gagnes = 0;
    if (q.type === 'qcm' || q.type === 'registre') {
      if (choisi < 0) return;
      gagnes = pointsQcm(juste);
    } else if (q.type === 'molette' || q.type === 'jauge') {
      if (valeur === null) return;
      gagnes = pointsEstimation(valeur, q.juste, q.tolerance ?? (q.type === 'jauge' ? 5 : 0));
    } else if (q.type === 'pastilles') {
      if (!cochees.length) return;
      gagnes = pointsPastilles(cochees, q.justes);
    } else {
      let n = trouvees.length;
      if (!liste) {
        // Le champ lui-même fait foi : « Entrée » peut arriver avant que l'affichage ait suivi la frappe.
        const saisie = champ.current?.value ?? texte;
        if (!saisie.trim()) return;
        n = estAcceptee(saisie, q.reponses[0]) ? 1 : 0;
        setTrouvees(n ? [0] : []);
      }
      juste = saisieJuste(n, q.reponses.length);
      gagnes = pointsSaisie(n, q.reponses.length);
    }
    setAstuce('');
    setCorrige(true);
    verrou.current = true;
    setTimeout(() => (verrou.current = false), 400);
    setReponses((r) => ({ ...r, [q.id]: juste }));
    setPoints((p) => ({ ...p, [q.id]: gagnes }));
    if (!juste && !revision) {
      // La bûche brûle tout de suite : quitter la leçon ne la rend pas.
      const maintenant = Date.now();
      const stockage = stockageNavigateur();
      const etat = lireEtat(stockage, maintenant);
      const v = perdreVie(etat.profil.vies, maintenant);
      ecrireEtat(stockage, { ...etat, profil: { ...etat.profil, vies: v } });
      setVies(v.vies);
      setAttente(prochaineVieDans(v, maintenant));
    }
  }

  function pasPret() {
    switch (q.type) {
      case 'qcm': case 'registre': return choisi < 0;
      case 'molette': case 'jauge': return valeur === null;
      case 'pastilles': return cochees.length === 0;
      default: return !liste && !texte.trim();
    }
  }

  function continuer() {
    if (verrou.current) return;
    if (vies === 0 && !revision) return setEcran('eteint');
    if (i + 1 < questions.length) {
      setI(i + 1);
      setReste(null);
      setTexte('');
      setTrouvees([]);
      setAstuce('');
      setChoisi(-1);
      setValeur(null);
      setCochees([]);
      setCorrige(false);
      return;
    }
    if (revision) {
      const r = enregistrerRevision(reponses);
      setVies(r.viesApres);
      setRendue(r.viesApres > r.viesAvant);
      setEcran('fin-revision');
      return;
    }
    const fin = enregistrerFin({ theme: lecon.theme, leconId: lecon.id, etape: lecon.etape, epreuve: lecon.epreuve, reponses, points });
    setBilan(fin.bilan);
    if (fin.gradeApres > fin.gradeAvant) setPromu(fin.gradeApres);
    setEcran('fin');
  }

  if (ecran === 'eteint') {
    return (
      <section class="lecteur ecran-centre">
        <FeuEteint />
        <h1 tabIndex={-1} ref={(h) => h?.focus()}>Le feu s'est éteint</h1>
        <p class="sous-titre">Plus une bûche pour l'entretenir. Une nouvelle bûche arrive dans {formatDuree(attente)}.</p>
        <a class="bouton" href={`${base}/revision`}>Réviser pour regagner une bûche</a>
        <a class="bouton clair" href={retour}>Retour au chemin</a>
      </section>
    );
  }

  if (ecran === 'fin-revision') {
    const min = regles.vies.questions_min_revision;
    return (
      <section class="lecteur ecran-centre">
        <Buches vies={vies} />
        <h1>Révision terminée</h1>
        <p class="sous-titre">
          {Object.values(reponses).filter(Boolean).length} bonne(s) réponse(s) sur {questions.length}.{' '}
          {rendue
            ? 'Une bûche revient au feu.'
            : questions.length < min
              ? `Il faut revoir au moins ${min} questions pour regagner une bûche.`
              : 'Le feu a déjà toutes ses bûches.'}
        </p>
        <a class="bouton" href={retour}>Retour au feu</a>
      </section>
    );
  }

  if (ecran === 'fin' && bilan) {
    const seuil = Math.round((lecon.epreuve ? regles.reussite.epreuve : regles.reussite.lecon) * 100);
    return (
      <section class="lecteur ecran-centre">
        <p class="theme">{nomTheme} · {lecon.titre}</p>
        <h1 tabIndex={-1} ref={(h) => h?.focus()}>
          {typo(
            bilan.total > 0 && bilan.bonnes === bilan.total
              ? 'Sans faute, goupil !'
              : bilan.reussie
                ? lecon.epreuve ? 'Épreuve réussie !' : 'Leçon réussie !'
                : bilan.bonnes / Math.max(1, bilan.total) >= 0.4 ? 'Pas mal, petit goupil' : 'Le chemin sera long',
          )}
        </h1>
        <p class="sous-titre">
          {bilan.bonnes} bonne{bilan.bonnes > 1 ? 's' : ''} réponse{bilan.bonnes > 1 ? 's' : ''} sur {bilan.total}
          {!bilan.reussie && ` : il en faut ${seuil} % pour ${lecon.epreuve ? 'réussir l’épreuve' : 'valider la leçon'}.`}
        </p>
        <dl class="gains">
          <div><dt>Réponses</dt><dd>+{bilan.points}</dd></div>
          {bilan.bonusSansFaute > 0 && <div><dt>Sans faute</dt><dd>+{bilan.bonusSansFaute}</dd></div>}
          {bilan.bonusSerie > 0 && <div><dt>Série</dt><dd>+{bilan.bonusSerie}</dd></div>}
          <div class="total"><dt>Points de savoir</dt><dd>+{bilan.totalPoints}</dd></div>
        </dl>
        {promu > 0 ? (
          <>
            <p class="promotion">{animal.charAt(0).toUpperCase() + animal.slice(1)} devient <strong>{grades[promu - 1]}</strong> !</p>
            <a class="bouton" href={`${retour}?promu=${promu}`}>Voir la scène au feu</a>
          </>
        ) : (
          <a class="bouton" href={retour}>Continuer</a>
        )}
      </section>
    );
  }

  return (
    <div class="lecteur">
      <header class="haut">
        <a
          class="fermer icone-bouton"
          href={retour}
          aria-label="Quitter la leçon"
          onClick={(e) => {
            if ((i > 0 || corrige) && !confirm('Quitter la leçon ? Les réponses de cette partie ne seront pas gardées.')) e.preventDefault();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </a>
        <div class="barre" role="progressbar" aria-label="Avancement" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={fait}>
          <div class="remplissage" style={{ width: `${pourcent}%` }} />
        </div>
        <Buches vies={vies} />
      </header>

      <section class="ecran-question">
        <p class="theme">{nomTheme} · {lecon.titre} · {q.niveau}</p>
        <h1 class="question" id="question">{typo(q.q)}</h1>
        {q.image && <Tableau key={q.id} image={q.image} corrige={corrige} />}
        {q.type === 'saisie' ? (
          <Saisie q={q} liste={liste} texte={texte} trouvees={trouvees} reste={reste} astuce={astuce} corrige={corrige} ok={ok} champ={champ} taper={taper} entree={entree} />
        ) : q.type === 'molette' ? (
          <Molette q={q} valeur={valeur} choisir={setValeur} corrige={corrige} ok={ok} />
        ) : q.type === 'jauge' ? (
          <Jauge q={q} valeur={valeur} choisir={setValeur} corrige={corrige} />
        ) : q.type === 'pastilles' ? (
          <Pastilles q={q} cochees={cochees} corrige={corrige} basculer={(k) => setCochees((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))} />
        ) : q.type === 'registre' ? (
          <Registre q={q} choisi={choisi} choisir={setChoisi} corrige={corrige} />
        ) : (
        <div class="choix" role="radiogroup" aria-labelledby="question">
          {q.choix.map((c, k) => (
            <button
              type="button"
              role="radio"
              aria-checked={choisi === k}
              disabled={corrige}
              class={`reponse${corrige && k === q.juste ? ' juste' : ''}${corrige && k === choisi && !ok ? ' faux' : ''}`}
              onClick={() => setChoisi(k)}
            >
              {c}
              {corrige && k === q.juste && <span class="invisible"> (bonne réponse)</span>}
              {corrige && k === choisi && !ok && <span class="invisible"> (votre réponse, fausse)</span>}
            </button>
          ))}
        </div>
        )}
      </section>

      <footer class={`verdict${corrige ? (ok ? ' ok' : ' rate') : ''}`}>
        <p class="message" aria-live="polite">
          {corrige && typo(ok ? 'Bravo, rusé goupil !' : messageRate(q, trouvees.length, cochees))}
        </p>
        {corrige && (
          <p class="explication">
            {typo(q.explication)} <span class="source">({typo(`Source : ${q.source}`)})</span>
          </p>
        )}
        <button
          type="button"
          class="bouton valider"
          disabled={!corrige && pasPret()}
          onClick={corrige ? continuer : valider}
        >
          {corrige ? 'Continuer' : liste ? 'J’ai fini' : 'Valider'}
        </button>
      </footer>
    </div>
  );
}

function messageRate(q: QuestionJeu, trouvees: number, cochees: number[]) {
  if (q.type === 'qcm') return `La bonne réponse : ${q.choix[q.juste]}`;
  if (q.type === 'registre') return `La bonne réponse : ${q.juste}`;
  if (q.type === 'molette') return `La bonne réponse : ${nombre(q.juste, q.unite)}`;
  if (q.type === 'jauge') return `La bonne réponse : ${nombre(q.juste, q.unite ?? '%')}`;
  if (q.type === 'pastilles') {
    const bonnes = cochees.filter((k) => q.justes.includes(k)).length;
    const pieges = cochees.length - bonnes;
    return `${bonnes} sur ${q.justes.length}${pieges ? `, et ${pieges} piège${pieges > 1 ? 's' : ''}` : ''} : les oubliées sont en pointillés`;
  }
  if (q.reponses.length === 1) return `La bonne réponse : ${q.reponses[0][0]}`;
  return `${trouvees} sur ${q.reponses.length} : les réponses manquées sont en rouge`;
}

type ProprietesSaisie = {
  q: QuestionSaisie;
  liste: boolean;
  texte: string;
  trouvees: number[];
  reste: number | null;
  astuce: string;
  corrige: boolean;
  ok: boolean;
  champ: { current: HTMLInputElement | null };
  taper: (v: string) => void;
  entree: () => void;
};

/** Champ de réponse, et pour une liste : le chrono, le compte et les cases à remplir. */
function Saisie({ q, liste, texte, trouvees, reste: chrono, astuce, corrige, ok, champ, taper, entree }: ProprietesSaisie) {
  const reste = chrono ?? q.duree_s;
  return (
    <div class="saisie">
      {liste && (
        <p class="compteur">
          <span>
            {trouvees.length} / {q.reponses.length}
          </span>
          <span class={`chrono${reste <= 10 && !corrige ? ' presse' : ''}`} role="timer" aria-label={`${reste} secondes restantes`}>
            {Math.floor(reste / 60)}:{String(reste % 60).padStart(2, '0')}
          </span>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          entree();
        }}
      >
        <input
          ref={champ}
          class={`champ${corrige && !liste ? (ok ? ' juste' : ' faux') : ''}`}
          type="text"
          value={texte}
          disabled={corrige}
          onInput={(e) => taper((e.target as HTMLInputElement).value)}
          aria-labelledby="question"
          aria-describedby={liste ? 'astuce' : undefined}
          placeholder={liste ? 'Tape une réponse…' : 'Ta réponse…'}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          enterkeyhint={liste ? 'enter' : 'done'}
        />
      </form>
      {liste && (
        <>
          <p class="astuce" id="astuce" aria-live="polite">{astuce}</p>
          <ol class="cases">
            {q.reponses.map((formes, k) => {
              const trouvee = trouvees.includes(k);
              return (
                <li class={trouvee ? 'trouvee' : corrige ? 'manquee' : ''}>
                  {trouvee || corrige ? formes[0] : ''}
                  {corrige && !trouvee && <span class="invisible"> (manquée)</span>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
