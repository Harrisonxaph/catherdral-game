// Package the existing static game unchanged. Do not bundle/transform its scripts.
import {cp, mkdir, readFile, readdir, rm, stat} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});

const entries = await readdir(root, {withFileTypes:true});
const files = entries.filter(entry => entry.isFile() &&
  /\.(html|css|js|webmanifest)$/.test(entry.name)).map(entry => entry.name);
files.push('_headers');
for (const file of files) {
  await cp(new URL(file, root), new URL(file, output));
}
for (const dir of ['assets', 'icons', 'images', 'vendor']) {
  await cp(new URL(dir + '/', root), new URL(dir + '/', output), {recursive:true});
}

// The previous #11 build dropped all newer game modules. Fail if the deploy
// directory omits anything declared in HTML, the PWA manifest or offline cache.
const html = await readFile(new URL('index.html', output), 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', output), 'utf8'));
const worker = await readFile(new URL('service-worker.js', output), 'utf8');
const assetBlock = worker.match(/const APP_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!assetBlock) throw new Error('Missing offline APP_ASSETS manifest');
const offline = [...assetBlock[1].matchAll(/'(\.\/[^']+)'/g)].map(match => match[1]);
const referenced = [...html.matchAll(/(?:src|href)\s*=\s*["'](\.\/[^"']+)["']/g)]
  .map(match => match[1]);
const icons = manifest.icons.map(icon => icon.src);
const required = new Set(['./index.html', './service-worker.js', './manifest.webmanifest',
  ...offline, ...referenced, ...icons]);
for (const path of required) {
  if (path === './') continue;
  const normalized = path.replace(/^\.\//, '');
  const file = new URL(normalized, output);
  if (!(await stat(file)).isFile()) throw new Error('Missing bundled runtime asset: ' + path);
}
console.log('VESPER static deployment verified: ' + required.size +
  ' declared resources; all current game modules and offline files retained.');
