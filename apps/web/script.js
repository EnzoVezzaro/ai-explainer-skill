// Video Skill website — shared interactivity
(function () {
  // Mobile menu toggle
  const btn = document.querySelector('.menu-btn');
  const menu = document.querySelector('.mobile-menu');
  if (btn && menu) {
    let open = false;
    btn.addEventListener('click', function () {
      open = !open;
      menu.style.display = open ? 'block' : 'none';
      btn.setAttribute('aria-expanded', open);
    });
  }

  // Playground interactions
  const urlInput = document.getElementById('vs-url');
  const explainBtn = document.getElementById('vs-explain');
  const createBtn = document.getElementById('vs-create');
  const buildBtn = document.getElementById('vs-build');
  const output = document.getElementById('vs-output');

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'status ' + (kind || '');
  }

  async function runAction(action) {
    const url = (urlInput && urlInput.value) ? urlInput.value.trim() : '';
    if (!url) {
      if (output) { output.textContent = 'Please paste a public video URL.'; output.classList.add('show'); }
      return;
    }
    // Basic client-side URL hint (server validates strictly)
    try { new URL(url); } catch {
      if (output) { output.textContent = 'That does not look like a valid URL.'; output.classList.add('show'); }
      return;
    }
    if (output) {
      output.textContent = 'Running ' + action + ' against ' + url + ' …';
      output.classList.add('show');
    }
    // In the MVP the heavy work runs through the CLI / a bounded backend job.
    // Here we show a deterministic placeholder so the UX is real without a backend.
    await new Promise((r) => setTimeout(r, 900));
    const result = [
      'Action: ' + action,
      'Source: ' + url,
      'Status: prepared (not executed)',
      '',
      'This playground prepares an Agent Skill from the tutorial.',
      'Execution happens in your coding harness after you install the skill.',
      '',
      'Next: run `npx video-skill install`, then `npx video-skill create <url>`.'
    ].join('\n');
    if (output) { output.textContent = result; output.classList.add('show'); }
  }

  if (explainBtn) explainBtn.addEventListener('click', () => runAction('explain'));
  if (createBtn) createBtn.addEventListener('click', () => runAction('create'));
  if (buildBtn) buildBtn.addEventListener('click', () => runAction('build'));

  // Copy code block helper
  document.querySelectorAll('pre code').forEach(function (block) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-secondary';
    btn.textContent = 'Copy';
    btn.style.position = 'absolute';
    btn.style.top = '0.5rem';
    btn.style.right = '0.5rem';
    const pre = block.parentElement;
    if (pre && pre.tagName === 'PRE') {
      pre.style.position = 'relative';
      pre.appendChild(btn);
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(block.textContent).then(function () {
          const old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = old; }, 1200);
        });
      });
    }
  });
})();
