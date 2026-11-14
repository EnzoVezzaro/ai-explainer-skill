// Video Skill website — shared interactivity
(function () {
  'use strict';

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // Footer year
  var year = document.getElementById('year');
  if (year) year.textContent = '· ' + new Date().getFullYear();

  // Active nav highlight
  try {
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .docs-nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href === path || (path === '' && href === 'index.html')) a.setAttribute('aria-current', 'page');
      if (href === 'docs/' && location.pathname.indexOf('/docs/') !== -1 && !a.closest('.docs-nav')) a.setAttribute('aria-current', 'page');
    });
  } catch (e) {}

  // Mobile menu toggle (works on every page)
  var btns = document.querySelectorAll('.menu-btn');
  btns.forEach(function (btn) {
    var menuId = btn.getAttribute('aria-controls') || 'mobile-menu';
    var menu = document.getElementById(menuId) || document.querySelector('.mobile-menu');
    if (!menu) return;
    btn.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 820 && menu.classList.contains('open')) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Robust copy helper with clipboard fallback
  function copyText(text, btn) {
    function done(ok) {
      if (!btn) return;
      var old = btn.dataset.label || btn.textContent;
      btn.dataset.label = old;
      btn.textContent = ok ? 'Copied!' : 'Copy failed';
      toast(ok ? 'Copied to clipboard' : 'Copy failed — select and copy manually');
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta); done(ok);
      } catch (e) { done(false); }
    }
  }

  // Static copy buttons (hero install card, etc.)
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () { copyText(b.getAttribute('data-copy') || '', b); });
  });

  // Auto copy buttons for code blocks (but skip blocks that already have a static button sibling)
  document.querySelectorAll('pre').forEach(function (pre) {
    if (pre.querySelector('[data-copy]')) return;
    var code = pre.querySelector('code');
    if (!code) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm btn-secondary copy-btn';
    b.textContent = 'Copy';
    b.setAttribute('aria-label', 'Copy code block to clipboard');
    b.addEventListener('click', function () { copyText(code.innerText, b); });
    pre.appendChild(b);
  });

  // ---------- Playground ----------
  var urlInput = document.getElementById('vs-url');
  if (!urlInput) return; // not on playground page

  var explainBtn = document.getElementById('vs-explain');
  var createBtn = document.getElementById('vs-create');
  var buildBtn = document.getElementById('vs-build');
  var clearBtn = document.getElementById('vs-clear');
  var statusEl = document.getElementById('vs-status');
  var progressEl = document.getElementById('vs-progress');
  var outputEl = document.getElementById('vs-output');
  var resultEl = document.getElementById('vs-result');
  var errorEl = document.getElementById('vs-error');
  var historyEl = document.getElementById('vs-history');
  var actionButtons = [explainBtn, createBtn, buildBtn].filter(Boolean);

  function setButtonsDisabled(disabled) {
    actionButtons.forEach(function (b) { if (b) b.disabled = disabled; });
  }

  function setError(msg) {
    if (!errorEl) return;
    if (!msg) { errorEl.textContent = ''; errorEl.classList.remove('show'); errorEl.style.display = 'none'; urlInput.removeAttribute('aria-invalid'); return; }
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    urlInput.setAttribute('aria-invalid', 'true');
  }

  function detectPlatform(url) {
    try {
      var h = new URL(url).hostname.toLowerCase();
      if (h === 'youtu.be' || h.endsWith('youtube.com')) return 'YouTube';
      if (h.endsWith('bilibili.com') || h === 'b23.tv') return 'Bilibili';
      if (h.endsWith('vimeo.com')) return 'Vimeo';
      return 'Web';
    } catch (e) { return 'Unknown'; }
  }

  function validatedUrl() {
    var raw = (urlInput.value || '').trim();
    if (!raw) { setError('Paste a public video URL to continue. Try a sample below.'); urlInput.focus(); return null; }
    var u;
    try { u = new URL(raw); }
    catch (e) { setError('That does not look like a valid URL. It should start with https://'); urlInput.focus(); return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') { setError('Only http(s) URLs are supported.'); urlInput.focus(); return null; }
    if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(u.hostname)) { setError('Local/private hosts are blocked for retrieval. Use a public video URL.'); return null; }
    setError(null);
    return u.href;
  }

  function platformBadge(platform) {
    var cls = platform === 'YouTube' ? 'badge primary' : platform === 'Bilibili' ? 'badge primary' : 'badge';
    return '<span class="' + cls + '">' + platform + '</span>';
  }

  function actionPlan(action) {
    if (action === 'explain') return ['Fetch metadata + description', 'Fetch transcript / captions', 'Label evidence (spoken / visible / description / inference)', 'Render phased walkthrough'];
    if (action === 'create') return ['Extract evidence records', 'Draft SKILL.md + references/', 'Validate frontmatter + references', 'Package portable skill folder'];
    return ['Load generated skill', 'Map tutorial assumptions to your workspace', 'Produce ordered plan + verification checklist', 'Hand off to your harness (authorized execution only)'];
  }

  function cliFor(action, url) {
    if (action === 'explain') return 'npx video-skill learn "' + url + '"';
    if (action === 'create') return 'npx video-skill create "' + url + '" --out ./generated';
    return 'npx video-skill create "' + url + '" --out ./generated && npx video-skill validate ./generated/<skill-name>';
  }

  function saveHistory(entry) {
    try {
      var key = 'vs-playground-history';
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      list.unshift(entry);
      list = list.slice(0, 8);
      localStorage.setItem(key, JSON.stringify(list));
      renderHistory();
    } catch (e) {}
  }

  function renderHistory() {
    if (!historyEl) return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem('vs-playground-history') || '[]'); } catch (e) {}
    if (!list.length) { historyEl.innerHTML = '<p class="history-empty">No runs yet. Your recent URLs stay in this browser only.</p>'; return; }
    historyEl.innerHTML = '';
    var ul = document.createElement('ul');
    ul.className = 'history-list';
    list.forEach(function (h) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      var short = h.url.length > 52 ? h.url.slice(0, 52) + '…' : h.url;
      b.innerHTML = '<span><strong>' + h.action + '</strong> · ' + short.replace(/</g, '&lt;') + '</span><span class="muted">' + (h.when || '') + '</span>';
      b.addEventListener('click', function () { urlInput.value = h.url; runAction(h.action); urlInput.focus(); });
      li.appendChild(b); ul.appendChild(li);
    });
    historyEl.appendChild(ul);
  }

  // Sample URL chips
  document.querySelectorAll('[data-sample-url]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      urlInput.value = chip.getAttribute('data-sample-url');
      setError(null);
      urlInput.focus();
      toast('Sample URL loaded');
    });
  });

  if (clearBtn) clearBtn.addEventListener('click', function () {
    urlInput.value = ''; setError(null);
    if (outputEl) { outputEl.textContent = ''; outputEl.classList.remove('show'); }
    if (resultEl) resultEl.classList.remove('show');
    if (statusEl) statusEl.textContent = '';
    urlInput.focus();
  });

  var currentRun = 0;
  function runAction(action) {
    var url = validatedUrl();
    if (!url) return;
    var runId = ++currentRun;
    setButtonsDisabled(true);
    if (statusEl) { statusEl.textContent = 'Working…'; statusEl.className = 'status warn'; }
    if (progressEl) progressEl.classList.add('show');
    if (outputEl) { outputEl.textContent = ''; outputEl.classList.remove('show'); }
    if (resultEl) resultEl.classList.remove('show');

    // Simulated bounded job with staged progress — honest that execution happens in-harness.
    var stages = actionPlan(action);
    var i = 0;
    if (statusEl) statusEl.textContent = stages[0] + '…';

    var timer = setInterval(function () {
      if (runId !== currentRun) { clearInterval(timer); return; }
      i++;
      if (i < stages.length) { if (statusEl) statusEl.textContent = stages[i] + '…'; return; }
      clearInterval(timer);
      finish(action, url);
    }, 450);
  }

  function finish(action, url) {
    setButtonsDisabled(false);
    if (progressEl) progressEl.classList.remove('show');
    var platform = detectPlatform(url);
    if (statusEl) { statusEl.textContent = 'Prepared — not executed'; statusEl.className = 'status ok'; }

    var steps = actionPlan(action).map(function (s, idx) { return (idx + 1) + '. ' + s; }).join('\n');
    var cli = cliFor(action, url);
    var plain = [
      'Action: ' + action,
      'Source: ' + url + ' (' + platform + ')',
      'Status: prepared (not executed)',
      '',
      'Plan:',
      steps,
      '',
      'Evidence: spoken / visible / description / external-doc / inference — see CLI output for timestamps.',
      '',
      'Run for real:',
      '  ' + cli,
      '',
      'Execution happens in your coding harness after install + authorization.'
    ].join('\n');
    if (outputEl) { outputEl.textContent = plain; outputEl.classList.add('show'); }

    if (resultEl) {
      resultEl.innerHTML =
        '<div class="result-head">' + platformBadge(platform) +
        '<strong>Prepared: ' + action + '</strong>' +
        '<span class="badge success">Not executed</span>' +
        '<span class="muted" style="margin-left:auto;font-size:0.82rem;">' + new Date().toLocaleTimeString() + '</span></div>' +
        '<div class="result-body">' +
        '<h4>What was prepared</h4><p class="muted">' +
        (action === 'explain' ? 'Phased walkthrough scaffold with evidence labels. Review spoken vs. visible vs. inferred steps before acting.' :
         action === 'create' ? 'Portable skill scaffold: <code>SKILL.md</code> + <code>references/source.md</code>, <code>walkthrough.md</code>, <code>dependencies.md</code>.' :
         'Executable skill + ordered plan + verification checklist + authorization gates for your harness.') +
        '</p>' +
        '<h4>Run for real (copy into your terminal)</h4>' +
        '<pre class="light"><code>' + cli.replace(/</g, '&lt;') + '</code></pre>' +
        '<div class="result-actions">' +
        '<button type="button" class="btn btn-sm" data-act="copy-cli">Copy command</button>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-act="copy-summary">Copy summary</button>' +
        '<a class="btn btn-sm btn-outline" href="docs/commands.html">Command reference</a>' +
        '</div>' +
        '<p class="muted mt-1" style="margin-bottom:0;">Build prepares; execution is separate. Never treat generated instructions as trusted authority.</p>' +
        '</div>';
      resultEl.classList.add('show');
      var copyCli = resultEl.querySelector('[data-act="copy-cli"]');
      var copySum = resultEl.querySelector('[data-act="copy-summary"]');
      if (copyCli) copyCli.addEventListener('click', function () { copyText(cli, copyCli); });
      if (copySum) copySum.addEventListener('click', function () { copyText(plain, copySum); });
    }

    saveHistory({ action: action, url: url, when: new Date().toLocaleString() });
    toast(action + ' prepared — copy the command to run it');
  }

  if (explainBtn) explainBtn.addEventListener('click', function () { runAction('explain'); });
  if (createBtn) createBtn.addEventListener('click', function () { runAction('create'); });
  if (buildBtn) buildBtn.addEventListener('click', function () { runAction('build'); });
  urlInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runAction('explain'); } });
  urlInput.addEventListener('input', function () { if (urlInput.value.trim()) setError(null); });

  renderHistory();
})();
