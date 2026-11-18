/**
 * Workflow engine — the "whole workflow" exposed through the MCP.
 * A run is a job with ordered steps and an agent-style thread. The site connects
 * to the MCP, starts a run, watches the thread, and renders the finished skill.
 * A real coding agent can drive the same steps via the MCP tools directly.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { extractVideo } from '../../agent-reach-adapter/src/index.js';
import { compileSkill, validateSkillDir } from '../../skill-compiler/src/index.js';

const SKILL_FILES = ['SKILL.md', 'references/tools.md', 'references/walkthrough.md', 'references/source.md', 'references/dependencies.md', 'build/README.md', 'build/INSTRUCTIONS.md', 'build/CHECKLIST.md', 'build/transcript.md', 'build/links.md'];

const STEP_DEFS = [
  { key: 'connect',  label: 'Connect to MCP',   say: 'Connected to video-skill MCP. I will extract the source, map its steps, and compile a portable Agent Skill.' },
  { key: 'extract',  label: 'Extract content',  say: 'Reading the public metadata, description and transcript through Agent Reach (with yt-dlp fallback).' },
  { key: 'parse',    label: 'Map the workflow', say: 'Mapping the tools and the ordered steps from the video timeline.' },
  { key: 'compile',  label: 'Compile skill',    say: 'Writing SKILL.md and the reference files from the extracted evidence.' },
  { key: 'validate', label: 'Validate',         say: 'Validating the generated skill structure and references.' },
  { key: 'package',  label: 'Package result',   say: 'Packaging the skill folder so it is ready to hand to an agent.' },
];

export class WorkflowEngine {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.env.VIDEO_SKILL_DATA_DIR || path.join(os.homedir(), '.video-skill'), 'workflows');
    this.buildRoot = options.buildRoot || path.join(os.tmpdir(), 'video-skill-builds');
    this.jobs = new Map();
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.buildRoot, { recursive: true });
    try {
      for (const f of await fs.readdir(this.dataDir)) {
        if (!f.endsWith('.json')) continue;
        const job = JSON.parse(await fs.readFile(path.join(this.dataDir, f), 'utf8'));
        // In-flight runs from a previous process cannot be resumed; mark them failed.
        if (job.status === 'running') {
          job.status = 'failed';
          job.error = 'Run was interrupted by a server restart.';
        }
        this.jobs.set(job.id, job);
      }
    } catch {}
  }

  async _save(job) {
    job.updatedAt = new Date().toISOString();
    this.jobs.set(job.id, job);
    await fs.writeFile(path.join(this.dataDir, `${job.id}.json`), JSON.stringify(job, null, 2));
  }

  async start({ url, name } = {}) {
    if (!url) throw { code: -32602, message: 'url is required to start a workflow' };
    const job = {
      id: randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url,
      name: typeof name === 'string' && name ? name : undefined,
      status: 'running',
      currentStep: 'connect',
      steps: STEP_DEFS.map(s => ({ ...s, status: 'pending', detail: '', ms: 0 })),
      thread: [],
      result: null,
      error: null,
    };
    await this._save(job);
    // run in background; the site watches via get(id)
    this._run(job).catch(async err => {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      await this._save(job);
    });
    return this.snapshot(job);
  }

  async _step(job, key, fn) {
    const step = job.steps.find(s => s.key === key);
    step.status = 'running';
    job.currentStep = key;
    job.thread.push({ role: 'agent', step: key, text: step.say, at: new Date().toISOString() });
    await this._save(job);
    const t0 = Date.now();
    try {
      const out = await fn(step);
      step.status = 'done';
      step.ms = Date.now() - t0;
      await this._save(job);
      return out;
    } catch (err) {
      step.status = 'failed';
      step.ms = Date.now() - t0;
      step.detail = err instanceof Error ? err.message : String(err);
      await this._save(job);
      throw err;
    }
  }

  async _run(job) {
    let extraction;
    let compiled;
    let validation;

    await this._step(job, 'connect', async step => {
      step.detail = 'video-skill MCP · workflow tools online';
    });

    await this._step(job, 'extract', async step => {
      extraction = await extractVideo(job.url);
      if (!extraction.description && !extraction.transcript) {
        throw new Error('No usable content could be extracted from this URL.');
      }
      step.detail = `${extraction.source?.platform || 'web'} · ${(extraction.description || '').length} chars of description`;
    });

    await this._step(job, 'parse', async step => {
      const tools = (extraction.tools || []).length;
      const steps = (extraction.steps || []).length;
      step.detail = `${tools} tools · ${steps} steps · ${(extraction.links || []).length} links`;
      job.thread.push({ role: 'agent', step: 'parse', text: `Found ${tools} tools and ${steps} timestamped steps in the source.`, at: new Date().toISOString() });
    });

    await this._step(job, 'compile', async step => {
      const buildId = randomUUID().slice(0, 8);
      const outDir = path.join(this.buildRoot, buildId);
      await fs.mkdir(outDir, { recursive: true });
      compiled = await compileSkill(extraction, { outDir, name: job.name });
      job.buildId = buildId;
      step.detail = compiled.name;
    });

    await this._step(job, 'validate', async step => {
      validation = await validateSkillDir(compiled.path);
      step.detail = validation.ok ? 'OK · 0 errors' : `${validation.issues.length} note(s)`;
    });

    await this._step(job, 'package', async step => {
      const files = {};
      for (const rel of SKILL_FILES) {
        try { files[rel] = await fs.readFile(path.join(compiled.path, rel), 'utf8'); } catch { files[rel] = ''; }
      }
      const zipPath = path.join(this.buildRoot, job.buildId, `${compiled.name}.zip`);
      spawnSync('zip', ['-r', '-q', zipPath, compiled.name], { cwd: path.join(this.buildRoot, job.buildId) });
      job.result = {
        name: compiled.name,
        title: extraction.source?.title || '',
        platform: extraction.source?.platform || 'web',
        author: extraction.source?.author || '',
        tools: extraction.tools || [],
        steps: extraction.steps || [],
        links: extraction.links || [],
        warnings: extraction.warnings || [],
        limitations: extraction.source?.limitations || [],
        validation,
        files,
        zipUrl: `/api/workflows/${job.id}/download`,
      };
      step.detail = `${SKILL_FILES.length} files · zip ready`;
    });

    job.status = validation.ok ? 'done' : 'done_with_notes';
    job.thread.push({ role: 'agent', step: 'package', text: 'Done. The built skill is ready — I have rendered it below.', at: new Date().toISOString() });
    await this._save(job);
  }

  snapshot(job) {
    return {
      id: job.id,
      status: job.status,
      currentStep: job.currentStep,
      steps: job.steps,
      thread: job.thread,
      result: job.result,
      error: job.error,
      url: job.url,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async get(id) {
    const job = this.jobs.get(id);
    if (!job) throw { code: -32602, message: `Unknown workflow: ${id}` };
    return this.snapshot(job);
  }

  async list() {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(j => this.snapshot(j));
  }

  zipPath(id) {
    const job = this.jobs.get(id);
    if (!job || !job.buildId || !job.result) return null;
    const zip = path.join(this.buildRoot, job.buildId, `${job.result.name}.zip`);
    return zip;
  }
}
