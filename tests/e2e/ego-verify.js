import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/mac/Desktop/Github/ai-explainer-skill/apps/web';
const pages = [
  'index.html', 'playground.html', 'examples.html',
  'docs/index.html', 'docs/installation.html', 'docs/commands.html',
  'docs/security.html', 'docs/platforms.html', 'docs/architecture.html', 'docs/troubleshooting.html',
];
let fails = 0;
for (const p of pages) {
  const file = path.join(ROOT, p);
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { console.log('FAIL', p, e.message); fails++; continue; }
  const title = txt.match(/<title>([^<]*)<\/title>/)?.[1] || '(no title)';
  const hasBody = txt.includes('<body');
  const hasCss = txt.includes('style.css');
  console.log((hasBody ? 'OK ' : 'FAIL'), p, '|', title, '| css:', hasCss);
  if (!hasBody || !hasCss) fails++;
}
// content checks
const landing = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const playground = fs.readFileSync(path.join(ROOT, 'playground.html'), 'utf8');
const checks = {
  headline: /Turn video tutorials into skills your AI agent can execute/.test(landing),
  installCmd: landing.includes('npx video-skill install'),
  buildWarn: /Build \u2260 Execute/.test(playground),
  explainBtn: playground.includes('Explain'),
  createBtn: playground.includes('Create Skill'),
  buildBtn: playground.includes('Build'),
};
console.log('content checks:', checks);
const allOk = fails === 0 && Object.values(checks).every(Boolean);
console.log(allOk ? 'EGO LITE VERIFY: PASS' : 'EGO LITE VERIFY: FAIL');
process.exit(allOk ? 0 : 1);
