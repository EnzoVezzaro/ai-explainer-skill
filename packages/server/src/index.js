/** Video Skill Dashboard Server — REST API + MCP server for the collection dashboard. */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { CollectionManager } from '../../collection-manager/src/index.js';
import { WorkflowEngine } from './workflow.js';
import { extractVideo } from '../../agent-reach-adapter/src/index.js';
import { compileSkill, validateSkillDir } from '../../skill-compiler/src/index.js';
import { parsePublicUrl, detectPlatform } from '../../core/src/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// --- MCP Server (JSON-RPC over stdio + HTTP/SSE) ---
/**
 * Minimal MCP server implementation.
 * Exposes: resources (collections, skills), tools (extract, compile, validate, install)
 */
class MCPServer {
  constructor(collectionManager, workflowEngine) {
    this.cm = collectionManager;
    this.workflows = workflowEngine;
    this.capabilities = {
      resources: { listChanged: true },
      tools: { listChanged: true },
    };
  }

  /** Handle a JSON-RPC request */
  async handleRequest(message) {
    const { jsonrpc, id, method, params } = message;
    // JSON-RPC notifications have no id and MUST NOT receive a response body.
    if (method && method.startsWith('notifications/')) {
      return null;
    }
    try {
      let result;
      switch (method) {
        case 'ping':
          result = {};
          break;
        case 'initialize':
          result = {
            protocolVersion: params?.protocolVersion || '2024-11-05',
            capabilities: this.capabilities,
            serverInfo: { name: 'video-skill', version: '0.1.0' },
          };
          break;
        case 'resources/list':
          result = await this.listResources();
          break;
        case 'resources/read':
          result = await this.readResource(params.uri);
          break;
        case 'tools/list':
          result = { tools: await this.listTools() };
          break;
        case 'tools/call':
          result = await this.callTool(params.name, params.arguments || {});
          break;
        default:
          throw { code: -32601, message: `Method not found: ${method}` };
      }
      return { jsonrpc, id, result };
    } catch (err) {
      return {
        jsonrpc,
        id,
        error: { code: err.code || -32603, message: err.message || 'Internal error' },
      };
    }
  }

  async listResources() {
    const collections = await this.cm.listCollections();
    const resources = [];
    for (const wf of await this.workflows.list()) {
      resources.push({
        uri: `video-skill://workflows/${wf.id}`,
        name: `Workflow ${wf.id}`,
        description: `${wf.status} · ${wf.url}`,
        mimeType: 'application/json',
      });
    }
    for (const col of collections) {
      resources.push({
        uri: `video-skill://collections/${col.id}`,
        name: col.name,
        description: col.description,
        mimeType: 'application/json',
      });
      for (const item of (await this.cm.getCollection(col.id)).items) {
        resources.push({
          uri: `video-skill://collections/${col.id}/items/${item.id}`,
          name: item.sourceUrl,
          description: `${item.platform} • ${item.status}`,
          mimeType: 'application/json',
        });
        if (item.skill) {
          resources.push({
            uri: `video-skill://collections/${col.id}/items/${item.id}/skill`,
            name: `Skill: ${item.sourceUrl}`,
            description: 'Generated Agent Skill (SKILL.md)',
            mimeType: 'text/markdown',
          });
        }
      }
    }
    return { resources };
  }

  async readResource(uri) {
    const wf = uri.match(/^video-skill:\/\/workflows\/([^\/]+)$/);
    if (wf) {
      const run = await this.workflows.get(wf[1]);
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(run, null, 2) }] };
    }
    const match = uri.match(/^video-skill:\/\/collections\/([^\/]+)(\/items\/([^\/]+))?(\/skill)?$/);
    if (!match) throw { code: -32602, message: `Invalid resource URI: ${uri}` };
    const [, collectionId, , itemId, isSkill] = match;
    const collection = await this.cm.getCollection(collectionId);
    if (isSkill) {
      const item = collection.items.find(i => i.id === itemId);
      if (!item || !item.skill) throw { code: -32602, message: 'No skill for this item' };
      return { contents: [{ uri, mimeType: 'text/markdown', text: item.skill.content || '' }] };
    }
    if (itemId) {
      const item = collection.items.find(i => i.id === itemId);
      if (!item) throw { code: -32602, message: 'Item not found' };
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(item, null, 2) }] };
    }
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(collection, null, 2) }] };
  }

  async listTools() {
    return [
      {
        name: 'extract',
        description: 'Extract instructional content from a public URL (YouTube, Instagram, X, TikTok, web)',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Public URL to extract' },
            collectionId: { type: 'string', description: 'Collection ID to save to' },
          },
          required: ['url'],
        },
      },
      {
        name: 'compile',
        description: 'Compile an extraction into a portable Agent Skill',
        inputSchema: {
          type: 'object',
          properties: {
            collectionId: { type: 'string', description: 'Collection ID' },
            itemId: { type: 'string', description: 'Item ID' },
            name: { type: 'string', description: 'Skill name' },
          },
          required: ['collectionId', 'itemId'],
        },
      },
      {
        name: 'validate',
        description: 'Validate a generated Agent Skill',
        inputSchema: {
          type: 'object',
          properties: {
            collectionId: { type: 'string', description: 'Collection ID' },
            itemId: { type: 'string', description: 'Item ID' },
            path: { type: 'string', description: 'Direct path to skill folder' },
          },
          required: [],
        },
      },
      {
        name: 'list_collections',
        description: 'List all collections',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'run_workflow',
        description: 'Start the full workflow: extract a URL, map its steps and tools, compile and validate an Agent Skill. Returns a workflow id to watch with workflow_status.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Public video/content URL (optional if the agent already has a source)' },
            name: { type: 'string', description: 'Optional skill name' },
          },
          required: ['url'],
        },
      },
      {
        name: 'workflow_status',
        description: 'Get the live status, agent thread and result of a workflow run.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Workflow id from run_workflow' } },
          required: ['id'],
        },
      },
      {
        name: 'list_workflows',
        description: 'List workflow runs and their status',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  async callTool(name, args) {
    switch (name) {
      case 'extract': {
        const extraction = await extractVideo(args.url);
        let item = null;
        if (args.collectionId) {
          item = await this.cm.addItem(args.collectionId, {
            type: 'video',
            sourceUrl: args.url,
            platform: extraction.source?.platform || 'web',
            extraction,
            status: 'extracted',
          });
          await this.cm.addAgentAction(args.collectionId, item.id, {
            action: 'extract',
            status: extraction.ok ? 'success' : 'failed',
            details: { platform: extraction.source?.platform, warnings: extraction.warnings },
          });
        }
        return { content: [{ type: 'text', text: JSON.stringify({ extraction, item }, null, 2) }] };
      }
      case 'compile': {
        const collection = await this.cm.getCollection(args.collectionId);
        const item = collection.items.find(i => i.id === args.itemId);
        if (!item || !item.extraction) throw { code: -32602, message: 'Item has no extraction to compile' };
        const outDir = path.join(this.cm.dataDir, 'generated');
        const compiled = await compileSkill(item.extraction, { outDir, name: args.name });
        const validation = await validateSkillDir(compiled.path);
        const skillContent = await fs.readFile(path.join(compiled.path, 'SKILL.md'), 'utf8');
        await this.cm.updateItem(args.collectionId, args.itemId, {
          skill: { path: compiled.path, name: compiled.name, content: skillContent },
          status: validation.ok ? 'compiled' : 'compiled_with_issues',
        });
        await this.cm.addAgentAction(args.collectionId, args.itemId, {
          action: 'compile',
          status: validation.ok ? 'success' : 'failed',
          details: { skillName: compiled.name, path: compiled.path, issues: validation.issues },
        });
        return { content: [{ type: 'text', text: JSON.stringify({ compiled, validation, skillContent }, null, 2) }] };
      }
      case 'validate': {
        let result;
        if (args.path) {
          result = await validateSkillDir(args.path);
        } else if (args.collectionId && args.itemId) {
          const collection = await this.cm.getCollection(args.collectionId);
          const item = collection.items.find(i => i.id === args.itemId);
          if (!item || !item.skill) throw { code: -32602, message: 'Item has no skill' };
          result = await validateSkillDir(item.skill.path);
        } else {
          throw { code: -32602, message: 'Provide path or collectionId+itemId' };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      case 'list_collections': {
        const collections = await this.cm.listCollections();
        return { content: [{ type: 'text', text: JSON.stringify(collections, null, 2) }] };
      }
      case 'run_workflow': {
        const run = await this.workflows.start({ url: args.url, name: args.name });
        return { content: [{ type: 'text', text: JSON.stringify(run, null, 2) }] };
      }
      case 'workflow_status': {
        const run = await this.workflows.get(args.id);
        return { content: [{ type: 'text', text: JSON.stringify(run, null, 2) }] };
      }
      case 'list_workflows': {
        const runs = await this.workflows.list();
        return { content: [{ type: 'text', text: JSON.stringify(runs, null, 2) }] };
      }
      default:
        throw { code: -32602, message: `Unknown tool: ${name}` };
    }
  }
}

// --- Express App ---
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));

  const dataDir = process.env.VIDEO_SKILL_DATA_DIR || path.join(os.homedir(), '.video-skill');
  const cm = new CollectionManager({ dataDir });
  const workflows = new WorkflowEngine({ dataDir });
  const mcp = new MCPServer(cm, workflows);

  // Health
  app.get('/health', (req, res) => res.json({ ok: true, service: 'video-skill-dashboard' }));

  // Collections
  app.get('/api/collections', async (req, res) => {
    res.json(await cm.listCollections());
  });
  app.post('/api/collections', async (req, res) => {
    res.json(await cm.createCollection(req.body));
  });
  app.get('/api/collections/:id', async (req, res) => {
    try { res.json(await cm.getCollection(req.params.id)); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  app.put('/api/collections/:id', async (req, res) => {
    try { res.json(await cm.updateCollection(req.params.id, req.body)); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  app.delete('/api/collections/:id', async (req, res) => {
    res.json(await cm.deleteCollection(req.params.id));
  });

  // Items
  app.post('/api/collections/:id/items', async (req, res) => {
    try { res.json(await cm.addItem(req.params.id, req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get('/api/collections/:collectionId/items/:itemId', async (req, res) => {
    try { res.json(await cm.getItem(req.params.collectionId, req.params.itemId)); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  app.put('/api/collections/:collectionId/items/:itemId', async (req, res) => {
    try { res.json(await cm.updateItem(req.params.collectionId, req.params.itemId, req.body)); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  app.delete('/api/collections/:collectionId/items/:itemId', async (req, res) => {
    res.json(await cm.deleteItem(req.params.collectionId, req.params.itemId));
  });

  // Extract URL
  app.post('/api/extract', async (req, res) => {
    const { url, collectionId } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    const extraction = await extractVideo(url);
    let item = null;
    if (collectionId) {
      item = await cm.addItem(collectionId, {
        type: 'video',
        sourceUrl: url,
        platform: extraction.source?.platform || 'web',
        extraction,
        status: 'extracted',
      });
      await cm.addAgentAction(collectionId, item.id, {
        action: 'extract',
        status: extraction.ok ? 'success' : 'failed',
        details: { platform: extraction.source?.platform, warnings: extraction.warnings },
      });
    }
    res.json({ extraction, item });
  });

  // Compile skill
  app.post('/api/collections/:collectionId/items/:itemId/compile', async (req, res) => {
    try {
      const collection = await cm.getCollection(req.params.collectionId);
      const item = collection.items.find(i => i.id === req.params.itemId);
      if (!item || !item.extraction) return res.status(400).json({ error: 'No extraction to compile' });
      const outDir = path.join(dataDir, 'generated');
      const compiled = await compileSkill(item.extraction, { outDir, name: req.body.name });
      const validation = await validateSkillDir(compiled.path);
      const skillContent = await fs.readFile(path.join(compiled.path, 'SKILL.md'), 'utf8');
      await cm.updateItem(req.params.collectionId, req.params.itemId, {
        skill: { path: compiled.path, name: compiled.name, content: skillContent },
        status: validation.ok ? 'compiled' : 'compiled_with_issues',
      });
      await cm.addAgentAction(req.params.collectionId, req.params.itemId, {
        action: 'compile',
        status: validation.ok ? 'success' : 'failed',
        details: { skillName: compiled.name, path: compiled.path, issues: validation.issues },
      });
      res.json({ compiled, validation, skillContent });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Validate skill
  app.post('/api/validate', async (req, res) => {
    const { path: skillPath, collectionId, itemId } = req.body;
    try {
      let result;
      if (skillPath) result = await validateSkillDir(skillPath);
      else if (collectionId && itemId) {
        const collection = await cm.getCollection(collectionId);
        const item = collection.items.find(i => i.id === itemId);
        if (!item || !item.skill) return res.status(400).json({ error: 'No skill' });
        result = await validateSkillDir(item.skill.path);
      } else {
        return res.status(400).json({ error: 'Provide path or collectionId+itemId' });
      }
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Agent actions feed
  app.get('/api/actions', async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    res.json(await cm.listAgentActions(limit));
  });

  // Search
  app.get('/api/search', async (req, res) => {
    res.json(await cm.search(req.query.q || ''));
  });

  // Platform detection
  app.get('/api/platform', (req, res) => {
    try {
      const p = detectPlatform(new URL(req.query.url));
      res.json({ url: req.query.url, platform: p });
    } catch { res.status(400).json({ error: 'Invalid URL' }); }
  });

  // MCP endpoint (HTTP POST)
  app.post('/mcp', async (req, res) => {
    const response = await mcp.handleRequest(req.body);
    // Notifications (no id) must get 202 Accepted with no body per JSON-RPC/MCP.
    if (response === null) return res.status(202).end();
    res.json(response);
  });

  // One-shot: URL -> built skill (extract + compile + validate + zip). Stateless, no collection needed.
  const SKILL_FILES = ['SKILL.md', 'references/tools.md', 'references/walkthrough.md', 'references/source.md', 'references/dependencies.md', 'build/README.md', 'build/INSTRUCTIONS.md', 'build/CHECKLIST.md', 'build/transcript.md', 'build/links.md'];
  const buildRoot = path.join(os.tmpdir(), 'video-skill-builds');

  app.post('/api/build', async (req, res) => {
    const { url, name } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'A video/content URL is required.' });
    const parsed = parsePublicUrl(url);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error?.message || 'Invalid URL.' });

    try {
      const extraction = await extractVideo(url);
      if (!extraction.description && !extraction.transcript) {
        return res.status(422).json({
          error: 'Could not extract usable content from this URL.',
          warnings: extraction.warnings || [],
          limitations: extraction.source?.limitations || [],
        });
      }

      const buildId = randomUUID().slice(0, 8);
      const outDir = path.join(buildRoot, buildId);
      await fs.mkdir(outDir, { recursive: true });
      const compiled = await compileSkill(extraction, { outDir, name: typeof name === 'string' && name ? name : undefined });
      const validation = await validateSkillDir(compiled.path);

      const files = {};
      for (const rel of SKILL_FILES) {
        try { files[rel] = await fs.readFile(path.join(compiled.path, rel), 'utf8'); } catch { files[rel] = ''; }
      }

      const zipPath = path.join(outDir, `${compiled.name}.zip`);
      spawnSync('zip', ['-r', '-q', zipPath, compiled.name], { cwd: outDir });

      res.json({
        ok: true,
        buildId,
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
        zipUrl: `/api/build/${buildId}/download`,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/build/:buildId/download', (req, res) => {
    if (!/^[a-f0-9]{8}$/.test(req.params.buildId)) return res.status(400).json({ error: 'Invalid build id.' });
    const dir = path.join(buildRoot, req.params.buildId);
    fs.readdir(dir).then(entries => {
      const zip = entries.find(f => f.endsWith('.zip'));
      if (!zip) return res.status(404).json({ error: 'Build not found.' });
      res.download(path.join(dir, zip), zip);
    }).catch(() => res.status(404).json({ error: 'Build not found.' }));
  });

  // Paste-ready instructions + skill files for an external agent.
  app.get('/api/agent-kit', async (_req, res) => {
    const skillDir = path.join(REPO_ROOT, 'skills');
    const rels = [
      ['video-skill/SKILL.md', 'video-skill'],
      ['video-skill-learn/SKILL.md', 'video-skill-learn'],
      ['video-skill-create/SKILL.md', 'video-skill-create'],
      ['video-skill-verify/SKILL.md', 'video-skill-verify'],
    ];
    const parts = [
      '# Video Skill — instructions for your agent',
      '',
      'You have the video-skill MCP at `http://localhost:3002/mcp`. Use it to turn a public tutorial video into a portable Agent Skill.',
      '',
      '## Your task',
      'When I give you a video URL, turn it into a skill:',
      '',
      '1. `run_workflow({ url })` → returns a workflow `id`.',
      '2. `workflow_status({ id })` → poll until `done`; returns the agent thread, steps and the built skill.',
      '3. Present the finished skill (SKILL.md, tools.md, walkthrough.md, source.md, dependencies.md). Never fabricate a result — report the real status.',
      '',
      'Also available: `extract`, `compile`, `validate`, `list_collections`.',
      '',
      '## MCP connection',
      '',
      '```json',
      JSON.stringify({ mcpServers: { 'video-skill': { type: 'http', url: 'http://localhost:3002/mcp' } } }, null, 2),
      '```',
      '',
    ];
    for (const [rel, label] of rels) {
      let text = '';
      try { text = await fs.readFile(path.join(skillDir, rel), 'utf8'); } catch {}
      parts.push(`---\n\n## Skill: ${label}\n\n${text || '(unavailable)'}\n`);
    }
    res.type('text/plain').send(parts.join('\n'));
  });

  // Workflow runs (MCP-driven). The site connects to the MCP; these are a thin
  // HTTP mirror for status polling and the downloadable result.
  app.post('/api/workflows', async (req, res) => {
    try {
      const run = await workflows.start({ url: req.body?.url, name: req.body?.name });
      return res.json(run);
    } catch (e) { return res.status(400).json({ error: e.message || String(e) }); }
  });
  app.get('/api/workflows', async (_req, res) => res.json(await workflows.list()));
  app.get('/api/workflows/:id', async (req, res) => {
    try { return res.json(await workflows.get(req.params.id)); }
    catch { return res.status(404).json({ error: 'Unknown workflow' }); }
  });
  app.get('/api/workflows/:id/download', (req, res) => {
    const zip = workflows.zipPath(req.params.id);
    if (!zip) return res.status(404).json({ error: 'No built skill for this workflow yet.' });
    res.download(zip, path.basename(zip));
  });

  // Serve dashboard UI
  const dashboardDir = path.join(REPO_ROOT, 'apps/dashboard');
  app.use(express.static(dashboardDir));
  // SPA fallback: return index.html for any non-API, non-static route
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/mcp')) return next();
    res.sendFile(path.join(dashboardDir, 'index.html'), (err) => { if (err) next(); });
  });

  return { app, cm, mcp, workflows };
}

export async function start(port = 3002) {
  const { app, workflows } = createApp();
  await workflows.init();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`Video Skill Dashboard server running at http://localhost:${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`REST API: http://localhost:${port}/api`);
  return server;
}
