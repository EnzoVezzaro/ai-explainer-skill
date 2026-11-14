/** Video Skill Dashboard — interactive SPA client */
const API_BASE = '/api';

const app = {
  currentCollectionId: null,
  currentItemId: null,

  init() {
    this.bindNav();
    this.bindGlobal();
    this.checkServer();
    this.showSection('collections');
    this.loadCollections();
    setInterval(() => this.checkServer(), 10000);
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        const section = el.dataset.section;
        this.showSection(section);
      });
    });
    document.getElementById('btn-new-collection').addEventListener('click', () => this.createCollectionPrompt());
    document.getElementById('btn-create-first').addEventListener('click', () => this.createCollectionPrompt());
    document.getElementById('search-collections').addEventListener('input', (e) => this.filterCollections(e.target.value));
    document.getElementById('activity-limit').addEventListener('change', (e) => this.loadActivity(parseInt(e.target.value, 10)));
  },

  bindGlobal() {
    window.app = this;
  },

  async checkServer() {
    try {
      const r = await fetch(`${API_BASE.replace('/api','')}/health`);
      const ok = r.ok;
      const ind = document.querySelector('.status-indicator');
      const txt = document.getElementById('status-text');
      if (ind && txt) {
        ind.className = ok ? 'status-indicator online' : 'status-indicator';
        txt.textContent = ok ? 'Online' : 'Offline';
      }
    } catch {
      const ind = document.querySelector('.status-indicator');
      const txt = document.getElementById('status-text');
      if (ind && txt) { ind.className = 'status-indicator'; txt.textContent = 'Offline'; }
    }
  },

  showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`section-${section}`);
    if (el) el.classList.add('active');
    document.getElementById('page-title').textContent = this.sectionTitle(section);
    switch (section) {
      case 'collections': this.loadCollections(); break;
      case 'activity': this.loadActivity(); break;
      case 'mcp': this.checkServer(); break;
    }
  },

  sectionTitle(s) {
    const map = { collections: 'Collections', activity: 'Agent Activity', mcp: 'MCP Connection', api: 'API Reference' };
    return map[s] || 'Collections';
  },

  async loadCollections() {
    try {
      const r = await fetch(`${API_BASE}/collections`);
      const collections = await r.json();
      this.renderCollections(collections);
    } catch (e) { this.toast('Failed to load collections'); }
  },

  renderCollections(collections) {
    const list = document.getElementById('collections-list');
    const empty = document.getElementById('empty-collections');
    list.innerHTML = '';
    if (!collections || collections.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    list.style.display = 'grid';
    empty.style.display = 'none';
    for (const col of collections) {
      const card = document.createElement('div');
      card.className = 'card collection-card';
      card.onclick = () => this.showCollectionDetail(col.id);
      card.innerHTML = `
        <h3>${escapeHtml(col.name)}</h3>
        <p>${escapeHtml(col.description || 'No description')} </p>
        <div class="collection-meta">
          <span>📄 ${col.itemCount} items</span>
          <span>🕒 ${new Date(col.updatedAt).toLocaleDateString()}</span>
        </div>
      `;
      list.appendChild(card);
    }
  },

  filterCollections(q) {
    const cards = document.querySelectorAll('.collection-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  async createCollectionPrompt() {
    const name = prompt('Collection name:');
    if (!name) return;
    const desc = prompt('Description (optional):') || '';
    try {
      const r = await fetch(`${API_BASE}/collections`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc }),
      });
      const col = await r.json();
      this.toast(`Collection "${col.name}" created`);
      this.loadCollections();
    } catch (e) { this.toast('Failed to create collection'); }
  },

  async showCollectionDetail(collectionId) {
    this.currentCollectionId = collectionId;
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-collection-detail').classList.add('active');

    try {
      const col = await this.fetchJson(`${API_BASE}/collections/${collectionId}`);
      document.getElementById('detail-collection-name').textContent = col.name;
      document.getElementById('detail-collection-desc').textContent = col.description || '';
      this.renderItems(col.items || []);
    } catch (e) { this.toast('Failed to load collection'); }
  },

  renderItems(items) {
    const list = document.getElementById('collection-items');
    list.innerHTML = '';
    if (!items || items.length === 0) {
      list.innerHTML = '<p class="empty-state" style="text-align:center;padding:2rem;">No items yet. Add a URL to extract content.</p>';
      return;
    }
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'card collection-card';
      card.onclick = () => this.showItemDetail(collectionId, item.id);
      const statusClass = `status-${item.status || 'pending'}`;
      card.innerHTML = `
        <h3>${escapeHtml(item.sourceUrl)}</h3>
        <div class="item-badges">
          <span class="badge platform">${escapeHtml(item.platform || 'web')}</span>
          <span class="badge ${statusClass}">${escapeHtml(item.status || 'pending')}</span>
        </div>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.5rem;">
          ${item.extraction ? (item.extraction.source?.title || 'No title') : 'Not extracted yet'}
        </p>
      `;
      list.appendChild(card);
    }
  },

  async showItemDetail(collectionId, itemId) {
    this.currentCollectionId = collectionId;
    this.currentItemId = itemId;
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-item-detail').classList.add('active');

    try {
      const item = await this.fetchJson(`${API_BASE}/collections/${collectionId}/items/${itemId}`);
      document.getElementById('item-title').textContent = item.sourceUrl;
      document.getElementById('item-platform').textContent = item.platform || 'web';
      document.getElementById('item-status').textContent = item.status || 'pending';
      document.getElementById('item-platform').className = `badge platform`;
      document.getElementById('item-status').className = `badge status-${item.status || 'pending'}`;
      document.getElementById('item-url').textContent = item.sourceUrl;
      document.getElementById('item-created').textContent = new Date(item.createdAt).toLocaleString();
      document.getElementById('item-updated').textContent = new Date(item.updatedAt).toLocaleString();

      // Extraction preview
      const extDiv = document.getElementById('item-extraction');
      if (item.extraction) {
        extDiv.textContent = JSON.stringify(item.extraction, null, 2);
      } else {
        extDiv.textContent = 'No extraction yet. Extract this item first.';
      }

      // Skill preview
      const skillDiv = document.getElementById('item-skill-preview');
      if (item.skill && item.skill.content) {
        skillDiv.textContent = item.skill.content;
      } else {
        skillDiv.textContent = 'No skill generated yet. Compile this item to generate an Agent Skill.';
      }
    } catch (e) { this.toast('Failed to load item'); }
  },

  async addItemToCurrentCollection() {
    if (!this.currentCollectionId) return;
    const url = prompt('Paste a public URL (YouTube, Instagram, X, TikTok, web):');
    if (!url) return;
    this.toast('Extracting content…');
    try {
      const r = await fetch(`${API_BASE}/extract`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, collectionId: this.currentCollectionId }),
      });
      const result = await r.json();
      if (result.item) {
        this.toast(`Extracted: ${result.extraction.source?.title || url}`);
        this.showCollectionDetail(this.currentCollectionId);
      } else {
        this.toast('Extraction failed: ' + (result.extraction?.error?.message || 'unknown'));
      }
    } catch (e) { this.toast('Extract error'); }
  },

  async compileCurrentItem() {
    if (!this.currentCollectionId || !this.currentItemId) return;
    const name = prompt('Skill name (optional):') || '';
    try {
      const r = await fetch(`${API_BASE}/collections/${this.currentCollectionId}/items/${this.currentItemId}/compile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = await r.json();
      if (result.compiled) {
        this.toast(`Skill "${result.compiled.name}" compiled`);
        this.showItemDetail(this.currentCollectionId, this.currentItemId);
      } else {
        this.toast('Compile failed');
      }
    } catch (e) { this.toast('Compile error'); }
  },

  async validateCurrentItem() {
    if (!this.currentCollectionId || !this.currentItemId) return;
    try {
      const r = await fetch(`${API_BASE}/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: this.currentCollectionId, itemId: this.currentItemId }),
      });
      const result = await r.json();
      this.toast(result.ok ? 'Skill is valid' : 'Skill has issues: ' + (result.issues?.map(i => i.message).join(', ') || ''));
    } catch (e) { this.toast('Validate error'); }
  },

  async copySkillContent() {
    const skillDiv = document.getElementById('item-skill-preview');
    const text = skillDiv.textContent;
    if (!text || text.includes('No skill generated')) return this.toast('No skill to copy');
    await navigator.clipboard.writeText(text);
    this.toast('Skill copied to clipboard');
  },

  async downloadSkill() {
    const skillDiv = document.getElementById('item-skill-preview');
    const text = skillDiv.textContent;
    if (!text || text.includes('No skill generated')) return;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-${this.currentItemId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async loadActivity(limit = 20) {
    try {
      const r = await fetch(`${API_BASE}/actions?limit=${limit}`);
      const actions = await r.json();
      this.renderActivity(actions);
    } catch (e) { this.toast('Failed to load activity'); }
  },

  renderActivity(actions) {
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    if (!actions || actions.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem;">No activity yet.</p>';
      return;
    }
    for (const a of actions) {
      const div = document.createElement('div');
      div.className = 'activity-item';
      const statusClass = `status-${a.status || 'pending'}`;
      div.innerHTML = `
        <div class="action-info">
          <div class="action-name">${escapeHtml(a.action)}</div>
          <div class="action-meta">${escapeHtml(a.collectionName || '')} › ${escapeHtml(a.itemTitle || '')}</div>
        </div>
        <div>
          <div class="action-time">${new Date(a.timestamp).toLocaleString()}</div>
          <span class="badge ${statusClass}" style="margin-top:0.5rem;display:block;font-size:0.7rem;">${escapeHtml(a.status || 'pending')}</span>
        </div>
      `;
      list.appendChild(div);
    }
  },

  async refreshActivity() {
    const limit = parseInt(document.getElementById('activity-limit').value, 10);
    await this.loadActivity(limit);
  },

  async refresh() {
    this.loadCollections();
    if (this.currentCollectionId) this.showCollectionDetail(this.currentCollectionId);
  },

  copyText(text) {
    navigator.clipboard.writeText(text).then(() => this.toast('Copied to clipboard'));
  },

  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  },

  fetchJson(url, opts = {}) {
    return fetch(url, opts).then(async r => {
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    });
  },
};

document.addEventListener('DOMContentLoaded', () => app.init());

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
