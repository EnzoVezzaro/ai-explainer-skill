(() => {
  const $ = (id) => document.getElementById(id);
  const connEl = $('conn');
  const connText = $('conn-text');
  const connMeta = $('conn-meta');
  const cornerStatus = $('corner-status');
  const toolList = $('tool-list');
  const waiting = $('waiting');
  const statusEl = $('status');
  const threadSection = $('thread-section');
  const threadEl = $('thread');
  const threadMeta = $('thread-meta');
  const resultEl = $('result');
  const tabsEl = $('tabs');
  const viewEl = $('file-view');

  const TAB_LABELS = {
    'SKILL.md': 'SKILL.MD',
    'references/tools.md': 'TOOLS',
    'references/walkthrough.md': 'STEPS',
    'references/source.md': 'SOURCE',
    'references/dependencies.md': 'DEPS',
  };
  let rpcId = 0;
  let watchTimer = null;
  let following = null;       // workflow id we are rendering
  let renderedMessages = 0;
  let seen = new Map();       // id -> { status, updatedAt }
  let activeFile = 'SKILL.md';
  let latestResult = null;
  let connected = false;
  let firstPoll = true;

  async function mcp(method, params) {
    const res = await fetch('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || 'MCP error');
    return j.result;
  }
  async function tool(name, args) {
    const r = await mcp('tools/call', { name, arguments: args || {} });
    return JSON.parse(r.content[0].text);
  }
  function status(message) {
    statusEl.textContent = message;
    statusEl.hidden = false;
  }
  function clearStatus() { statusEl.hidden = true; statusEl.textContent = ''; }

  async function connect() {
    connEl.className = 'conn';
    connText.textContent = 'connecting to MCP…';
    try {
      await mcp('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'video-skill-web', version: '1.0' } });
      const { tools } = await mcp('tools/list');
      connected = true;
      connEl.className = 'conn online';
      connText.textContent = `MCP connected · ${tools.length} tools`;
      cornerStatus.textContent = `[ mcp · ${tools.length} tools ]`;
      connMeta.textContent = 'connected · watching for runs…';
      toolList.innerHTML = '';
      for (const t of tools) {
        const li = document.createElement('li');
        li.textContent = t.name;
        toolList.appendChild(li);
      }
      startWatching();
    } catch (e) {
      connEl.className = 'conn offline';
      connText.textContent = 'MCP offline';
      cornerStatus.textContent = '[ mcp · offline ]';
      connMeta.textContent = 'disconnected';
      status(`Could not connect to the MCP: ${e.message}`);
    }
  }

  function isFinished(run) {
    return ['done', 'done_with_notes', 'failed'].includes(run.status);
  }

  function renderThread(run) {
    threadSection.hidden = false;
    threadMeta.textContent = `run ${run.id} · ${run.status}`;
    const stepByKey = Object.fromEntries((run.steps || []).map(s => [s.key, s]));
    for (let i = renderedMessages; i < (run.thread || []).length; i++) {
      const msg = run.thread[i];
      const step = stepByKey[msg.step];
      const row = document.createElement('div');
      row.className = 'msg';
      const who = document.createElement('div');
      who.className = 'who';
      who.textContent = msg.role;
      const body = document.createElement('div');
      body.className = 'body';
      const text = document.createElement('div');
      text.className = 'text';
      text.textContent = msg.text;
      body.appendChild(text);
      if (step) {
        const chip = document.createElement('span');
        chip.className = `step-chip ${step.status}`;
        chip.textContent = `${step.label} · ${step.status === 'running' ? 'running…' : step.status}`;
        body.appendChild(chip);
      }
      row.appendChild(who);
      row.appendChild(body);
      threadEl.appendChild(row);
    }
    renderedMessages = (run.thread || []).length;
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function renderResult(result) {
    $('result-title').textContent = result.title || result.name;
    $('result-platform').textContent = result.platform;
    $('result-counts').textContent = [
      `${result.tools.length} tools`,
      `${result.steps.length} steps`,
      `${result.links.length} links`,
    ].join('  ·  ');

    const notes = [];
    if (result.validation && result.validation.issues && result.validation.issues.length) {
      notes.push(`validation: ${result.validation.issues.length} note(s)`);
    }
    if ((result.warnings || []).length || (result.limitations || []).length) {
      notes.push([...(result.warnings || []), ...(result.limitations || [])].join(' · '));
    }
    const notice = $('notice');
    if (notes.length) { notice.textContent = notes.join('   '); notice.hidden = false; }
    else notice.hidden = true;

    tabsEl.innerHTML = '';
    for (const [path, label] of Object.entries(TAB_LABELS)) {
      if (!(path in result.files)) continue;
      const btn = document.createElement('button');
      btn.className = 'tab' + (path === activeFile ? ' active' : '');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.path = path;
      btn.addEventListener('click', () => {
        activeFile = path;
        for (const t of tabsEl.children) t.classList.toggle('active', t.dataset.path === path);
        viewEl.textContent = result.files[path] || '(empty)';
      });
      tabsEl.appendChild(btn);
    }
    viewEl.textContent = result.files[activeFile] || '(empty)';
    resultEl.hidden = false;
    resultEl.dataset.zip = result.zipUrl || '';
  }

  async function watch() {
    if (!connected) return;
    try {
      const runs = await tool('list_workflows');
      // Newest first (server already sorts, but be safe)
      runs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

      // On the first poll, remember existing runs but only follow one that is
      // still running (an agent is mid-task). Finished runs are not replayed.
      for (const r of runs) {
        const prev = seen.get(r.id);
        if (!prev) {
          seen.set(r.id, { status: r.status, updatedAt: r.updatedAt });
          if (!following && (!firstPoll || r.status === 'running')) {
            following = r.id;
            renderedMessages = 0;
            threadEl.innerHTML = '';
            resultEl.hidden = true;
            waiting.hidden = true;
            connMeta.textContent = `following run ${r.id} · ${r.status}`;
          }
        } else {
          seen.set(r.id, { status: r.status, updatedAt: r.updatedAt });
        }
      }
      firstPoll = false;

      if (!following) {
        connMeta.textContent = 'connected · watching for runs…';
        return;
      }

      // Fetch the full snapshot of the run we follow (thread + result).
      const run = await tool('workflow_status', { id: following });
      waiting.hidden = true;
      renderThread(run);
      if (isFinished(run) && run.result) {
        latestResult = run.result;
        renderResult(run.result);
        connMeta.textContent = `run ${run.id} · ${run.status} · result ready · watching for next…`;
        // Stop following this run, but keep watching for the agent's next one.
        following = null;
      } else if (run.status === 'failed') {
        status(run.error || 'The workflow failed.');
        following = null;
      }
    } catch (e) {
      // Transient: keep watching, but surface the problem once.
      status(`Watcher error: ${e.message}`);
    }
  }

  function startWatching() {
    clearInterval(watchTimer);
    watchTimer = setInterval(watch, 1000);
    watch();
  }

  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = 'COPIED ✓';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  async function copySkill() {
    if (!latestResult) return;
    const text = latestResult.files?.[activeFile] || latestResult.files?.['SKILL.md'] || '';
    await copyText(text, $('copy-btn'));
  }

  function download() {
    const url = resultEl.dataset.zip;
    if (url) window.location.href = url;
  }

  async function copyInstructions() {
    const btn = $('copy-instructions-btn');
    const old = btn.textContent;
    btn.textContent = 'COPYING…';
    try {
      const res = await fetch('/api/agent-kit');
      if (!res.ok) throw new Error(`Unavailable (${res.status})`);
      const text = await res.text();
      await copyText(text, btn);
    } catch (e) {
      status(`Could not copy instructions: ${e.message}`);
      btn.textContent = old;
    }
  }

  $('copy-endpoint').addEventListener('click', (e) => copyText('http://localhost:3002/mcp', e.currentTarget));
  $('copy-config').addEventListener('click', (e) => copyText($('mcp-config').textContent, e.currentTarget));
  $('copy-btn').addEventListener('click', copySkill);
  $('download-btn').addEventListener('click', download);
  $('copy-instructions-btn').addEventListener('click', copyInstructions);
  connect();
})();
