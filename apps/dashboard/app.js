(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('build-form');
  const urlInput = $('url');
  const buildBtn = $('build-btn');
  const statusEl = $('status');
  const resultEl = $('result');
  const tabsEl = $('tabs');
  const viewEl = $('file-view');
  const darkcut = $('darkcut');
  const dcLabel = $('dc-label');

  const TAB_LABELS = {
    'SKILL.md': 'SKILL.MD',
    'references/walkthrough.md': 'STEPS',
    'references/tools.md': 'TOOLS',
    'references/source.md': 'SOURCE',
    'references/dependencies.md': 'DEPS',
  };
  const PHASES = ['BOOTING', 'EXTRACTING', 'COMPILING', 'VALIDATING', 'PACKAGING'];

  let current = null;
  let activeFile = 'SKILL.md';
  let phaseTimer = null;

  function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (isError ? ' error' : '');
    statusEl.hidden = false;
  }
  const clearStatus = () => { statusEl.hidden = true; statusEl.textContent = ''; };

  function startCut() {
    darkcut.hidden = false;
    let i = 0;
    dcLabel.textContent = PHASES[0];
    phaseTimer = setInterval(() => {
      i = Math.min(i + 1, PHASES.length - 1);
      dcLabel.textContent = PHASES[i];
    }, 700);
  }
  function endCut() {
    clearInterval(phaseTimer);
    phaseTimer = null;
    darkcut.hidden = true;
  }

  async function build(e) {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }

    buildBtn.disabled = true;
    buildBtn.innerHTML = 'BUILDING…';
    resultEl.hidden = true;
    clearStatus();
    startCut();

    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Build failed.');
      current = data;
      render(data);
      clearStatus();
    } catch (err) {
      showStatus(err.message || 'Could not build a skill from that URL.', true);
    } finally {
      endCut();
      buildBtn.disabled = false;
      buildBtn.textContent = 'BUILD SKILL [ ↵ ]';
    }
  }

  function render(data) {
    $('result-title').textContent = data.title || data.name;
    $('result-platform').textContent = data.platform;
    const toolCount = (data.tools || []).length;
    const stepCount = (data.steps || []).length;
    $('result-counts').textContent = [toolCount && `${toolCount} TOOLS`, stepCount && `${stepCount} STEPS`].filter(Boolean).join('  ·  ');

    const notes = [];
    if (data.validation && data.validation.issues && data.validation.issues.length) {
      notes.push(`validation: ${data.validation.issues.length} note(s)`);
    }
    if ((data.warnings || []).length || (data.limitations || []).length) {
      notes.push([...(data.warnings || []), ...(data.limitations || [])].join(' · '));
    }
    const notice = $('notice');
    if (notes.length) { notice.textContent = notes.join('   '); notice.hidden = false; }
    else notice.hidden = true;

    tabsEl.innerHTML = '';
    const files = data.files || {};
    for (const [path, label] of Object.entries(TAB_LABELS)) {
      if (!(path in files)) continue;
      const btn = document.createElement('button');
      btn.className = 'tab' + (path === activeFile ? ' active' : '');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.path = path;
      btn.addEventListener('click', () => {
        activeFile = path;
        for (const t of tabsEl.children) t.classList.toggle('active', t.dataset.path === path);
        viewEl.textContent = files[path] || '(empty)';
      });
      tabsEl.appendChild(btn);
    }

    viewEl.textContent = files[activeFile] || '(empty)';
    resultEl.hidden = false;
  }

  async function copy() {
    if (!current) return;
    const text = current.files?.[activeFile] || current.files?.['SKILL.md'] || '';
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
    if (!current?.zipUrl) return;
    window.location.href = current.zipUrl;
  }

  form.addEventListener('submit', build);
  $('copy-btn').addEventListener('click', copy);
  $('download-btn').addEventListener('click', download);
})();
