/** Harness-specific install adapters. Safe/reversible install of the core video-skill. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const MANIFEST = '.video-skill-install.json';
function home(...parts) { return path.join(os.homedir(), ...parts); }
function cwd(...parts) { return path.join(process.cwd(), ...parts); }
function exists(p) { return fs.access(p).then(() => true, () => false); }

export async function detectProviders() {
  const candidates = [
    { id: 'codex', name: 'Codex / Agents skills', projectPath: cwd('.agents', 'skills'), userPath: home('.agents', 'skills'), detect: async () => (await exists(cwd('.agents'))) || (await exists(home('.codex'))) || (await exists(home('.agents'))), notes: 'Installs skill folder under .agents/skills or ~/.agents/skills.' },
    { id: 'claude-code', name: 'Claude Code', projectPath: cwd('.claude', 'skills'), userPath: home('.claude', 'skills'), detect: async () => (await exists(cwd('.claude'))) || (await exists(home('.claude'))), notes: 'Installs skill folder under .claude/skills.' },
    { id: 'opencode', name: 'OpenCode', projectPath: cwd('.opencode', 'skills'), userPath: home('.config', 'opencode', 'skills'), detect: async () => (await exists(cwd('.opencode'))) || (await exists(home('.config', 'opencode'))), notes: 'Installs skill folder under .opencode/skills or ~/.config/opencode/skills when supported.' },
    { id: 'cursor', name: 'Cursor (compatible skill folders)', projectPath: cwd('.cursor', 'skills'), userPath: home('.cursor', 'skills'), detect: async () => (await exists(cwd('.cursor'))) || (await exists(home('.cursor'))), notes: 'Compatibility depends on Cursor\'s current Agent Skills support; installer uses native skill folder paths where present.' },
  ];
  const out = [];
  for (const c of candidates) out.push({ ...c, detected: await c.detect() });
  return out;
}
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) { const s = path.join(src, entry.name); const d = path.join(dest, entry.name); if (entry.isDirectory()) await copyDir(s, d); else if (entry.isFile()) await fs.copyFile(s, d); }
}
export async function installCoreSkill(options) {
  const providers = await detectProviders();
  let provider = options.providerId ? providers.find(p => p.id === options.providerId) : providers.find(p => p.detected) || providers[0];
  if (!provider) throw new Error('No supported providers found.');
  const scope = options.scope || 'project';
  const base = scope === 'user' ? provider.userPath : provider.projectPath;
  const target = path.join(base, options.skillName || 'video-skill');
  const existed = await exists(target);
  if (existed && !options.force) { return { ok: false, code: 'TARGET_EXISTS', message: `Target already exists: ${target}. Use --force to replace files managed by this installer.`, target, provider: provider.id, scope }; }
  await copyDir(options.sourceDir, target);
  const manifest = { installedBy: 'video-skill-cli', version: '1.0.0', provider: provider.id, scope, sourceDir: options.sourceDir, target, installedAt: new Date().toISOString() };
  await fs.writeFile(path.join(target, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { ok: true, provider: provider.id, scope, target, manifest };
}
/**
 * Install the full skill suite into every detected coding harness, at both
 * user scope (available in any project) and project scope (this workspace).
 * Existing installer-managed copies are left untouched unless force is set.
 */
export async function installSkillSuite(options = {}) {
  const providers = await detectProviders();
  const detected = providers.filter(p => p.detected);
  // Discover every skill folder under skills/ — the full portable suite.
  const skillsDir = options.skillsDir;
  const skillNames = [];
  if (skillsDir) {
    try {
      for (const entry of await fs.readdir(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!(await exists(path.join(skillsDir, entry.name, 'SKILL.md')))) continue;
        skillNames.push(entry.name);
      }
    } catch {}
  }
  if (!skillNames.length) skillNames.push('video-skill');

  const results = [];
  for (const provider of detected) {
    for (const skillName of skillNames) {
      for (const scope of ['user', 'project']) {
        try {
          const res = await installCoreSkill({
            sourceDir: path.join(skillsDir || '', skillName),
            skillName,
            providerId: provider.id,
            scope,
            force: Boolean(options.force),
          });
          results.push({ provider: provider.id, skill: skillName, scope, ok: res.ok, code: res.code, target: res.target });
        } catch (e) {
          results.push({ provider: provider.id, skill: skillName, scope, ok: false, error: e.message });
        }
      }
    }
  }
  const installed = results.filter(r => r.ok);
  const skipped = results.filter(r => r.code === 'TARGET_EXISTS');
  const errors = results.filter(r => !r.ok && !r.code);
  return {
    // "OK" means the suite is present on every detected agent, whether just
    // installed or already there. Only real errors make the call fail.
    ok: errors.length === 0 && results.length > 0,
    detected: detected.map(p => p.id),
    skills: skillNames,
    results,
    installedCount: installed.length,
    skippedCount: skipped.length,
  };
}

export async function uninstallCoreSkill(options = {}) {
  const providers = await detectProviders();
  const targets = [];
  for (const p of providers) { if (options.providerId && p.id !== options.providerId) continue; for (const scope of options.scope ? [options.scope] : ['project', 'user']) { const base = scope === 'user' ? p.userPath : p.projectPath; targets.push({ provider: p.id, scope, target: path.join(base, 'video-skill') }); } }
  const removed = [];
  for (const t of targets) { const manifestPath = path.join(t.target, MANIFEST); if (!(await exists(manifestPath))) continue; await fs.rm(t.target, { recursive: true, force: true }); removed.push(t); }
  return { ok: true, removed };
}
