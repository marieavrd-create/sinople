// Vérifie que chaque image de question (un tableau…) répond bien : lancé en CI, car il faut Internet.
// Usage : node scripts/verifier-images.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dossier = 'src/content/questions';
const images = readdirSync(dossier, { recursive: true })
  .filter((f) => String(f).endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(join(dossier, String(f)), 'utf8')).questions ?? [])
    .filter((q) => q.image?.src?.startsWith('https://'))
    .map((q) => ({ fichier: String(f), id: q.id, src: q.image.src })));

let erreurs = 0;
for (const { fichier, id, src } of images) {
  let message = '';
  try {
    const r = await fetch(src, { redirect: 'follow', headers: { 'User-Agent': 'SinopleQuiz/1.0 (verification des images)' } });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok) message = `HTTP ${r.status}`;
    else if (!type.startsWith('image/')) message = `ce n'est pas une image (${type})`;
    await r.body?.cancel();
  } catch (e) {
    message = String(e);
  }
  if (message) {
    erreurs++;
    console.error(`✗ ${fichier} › ${id} : ${message}\n  ${src}`);
  } else console.log(`✓ ${fichier} › ${id}`);
}
console.log(`${images.length} image(s) vérifiée(s), ${erreurs} en erreur.`);
process.exit(erreurs ? 1 : 0);
