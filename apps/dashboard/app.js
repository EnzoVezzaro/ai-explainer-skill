(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('run-form');
  const urlInput = $('url');
  const runBtn = $('run-btn');
  const statusEl = $('status');
  const connEl = $('conn');
  const connText = $('conn-text');
  const cornerStatus = $('corner-status');
  const toolsList = $('tools-list');
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
  let pollTimer = null;
  let current = null;      // latest workflow snapshot
  let activeFile = 'SKILL.md';
  let renderedMessages = 0;

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
      connEl.className = 'conn online';
      connText.textContent = `MCP connected · ${tools.length} tools`;
      cornerStatus.textContent = `[ mcp · ${tools.length} tools ]`;
      toolsList.textContent = `tools: ${tools.map(t => t.name).join(' · ')}`;
    } catch (e) {
      connEl.className = 'conn offline';
      connText.textContent = 'MCP offline';
      cornerStatus.textContent = '[ mcp · offline ]';
      status(`Could not connect to the MCP: ${e.message}`);
    }
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

  async function poll(id) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const run = await tool('workflow_status', { id });
        current = run;
        renderThread(run);
        if (run.status === 'done' || run.status === 'done_with_notes' || run.status === 'failed') {
          clearInterval(pollTimer);
          pollTimer = null;
          runBtn.disabled = false;
          runBtn.textContent = 'RUN WORKFLOW [ ↵ ]';
          if (run.result) {
            renderResult(run.result);
            clearStatus();
          } else {
            status(run.error || 'The workflow finished without a built skill.');
          }
        }
      } catch (e) {
        clearInterval(pollTimer);
        pollTimer = null;
        runBtn.disabled = false;
        runBtn.textContent = 'RUN WORKFLOW [ ↵ ]';
        status(`Lost the workflow: ${e.message}`);
      }
    }, 800);
  }

  async function run(e) {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) { status('Paste a source URL to give the agent a video to work from.'); urlInput.focus(); return; }

    clearStatus();
    resultEl.hidden = true;
    threadEl.innerHTML = '';
    renderedMessages = 0;
    runBtn.disabled = true;
    runBtn.innerHTML = 'RUNNING…';
    status('Handing the task to the agent via MCP…');

    try {
      const run = await tool('run_workflow', { url });
      threadMeta.textContent = `run ${run.id} · ${run.status}`;
      poll(run.id);
    } catch (err) {
      clearInterval(pollTimer);
      pollTimer = null;
      runBtn.disabled = false;
      runBtn.textContent = 'RUN WORKFLOW [ ↵ ]';
      status(err.message || 'Could not start the workflow.');
    }
  }

  async function copy() {
    if (!current?.result) return;
    const text = current.result.files?.[activeFile] || current.result.files?.['SKILL.md'] || '';
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    const btn = $('copy-btn');
    const old = btn.textContent;
    btn.textContent = 'COPIED ✓';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  function download() {
    const url = resultEl.dataset.zip;
    if (url) window.location.href = url;
  }

  form.addEventListener('submit', run);
  $('copy-btn').addEventListener('click', copy);
  $('download-btn').addEventListener('click', download);
  connect();
})();
