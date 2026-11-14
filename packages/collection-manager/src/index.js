/** Collection Manager — saves extractions, organizes into collections, tracks agent actions. File-based (no DB required). */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

/** @typedef {import('../../core/src/index.js').ExtractionResult} ExtractionResult */

function defaultDataDir() {
  return process.env.VIDEO_SKILL_DATA_DIR || path.join(os.homedir(), '.video-skill');
}

export class CollectionManager {
  /**
   * @param {{dataDir?: string}} options
   */
  constructor(options = {}) {
    this.dataDir = options.dataDir || defaultDataDir();
    this.collectionsDir = path.join(this.dataDir, 'collections');
    this.initialized = false;
  }

  async init() {
    await fs.mkdir(this.collectionsDir, { recursive: true });
    this.initialized = true;
  }

  /** List all collections */
  async listCollections() {
    await this.init();
    const files = await fs.readdir(this.collectionsDir).catch(() => []);
    const collections = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(path.join(this.collectionsDir, file), 'utf8');
        const col = JSON.parse(content);
        collections.push({
          id: col.id,
          name: col.name,
          description: col.description,
          itemCount: col.items ? col.items.length : 0,
          createdAt: col.createdAt,
          updatedAt: col.updatedAt,
        });
      } catch { /* skip corrupt files */ }
    }
    collections.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return collections;
  }

  /** Get a single collection with all items */
  async getCollection(id) {
    await this.init();
    const content = await fs.readFile(path.join(this.collectionsDir, `${id}.json`), 'utf8');
    return JSON.parse(content);
  }

  /** Create a new collection */
  async createCollection({ name, description = '' }) {
    await this.init();
    const id = `col-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const collection = {
      id,
      name,
      description,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(path.join(this.collectionsDir, `${id}.json`), JSON.stringify(collection, null, 2), 'utf8');
    return collection;
  }

  /** Update collection metadata */
  async updateCollection(id, patch) {
    await this.init();
    const collection = await this.getCollection(id);
    Object.assign(collection, patch);
    collection.updatedAt = new Date().toISOString();
    await fs.writeFile(path.join(this.collectionsDir, `${id}.json`), JSON.stringify(collection, null, 2), 'utf8');
    return collection;
  }

  /** Delete a collection */
  async deleteCollection(id) {
    await this.init();
    await fs.rm(path.join(this.collectionsDir, `${id}.json`), { force: true });
    return { deleted: true, id };
  }

  /** Add an item (extraction) to a collection */
  async addItem(collectionId, item) {
    await this.init();
    const collection = await this.getCollection(collectionId);
    const now = new Date().toISOString();
    const newItem = {
      id: `item-${randomUUID().slice(0, 8)}`,
      type: item.type || 'video',
      sourceUrl: item.sourceUrl,
      platform: item.platform,
      extraction: item.extraction || null,
      skill: item.skill || null,
      status: item.status || 'extracted',
      agentActions: item.agentActions || [],
      createdAt: now,
      updatedAt: now,
    };
    collection.items.push(newItem);
    collection.updatedAt = now;
    await fs.writeFile(path.join(this.collectionsDir, `${collectionId}.json`), JSON.stringify(collection, null, 2), 'utf8');
    return newItem;
  }

  /** Get a specific item */
  async getItem(collectionId, itemId) {
    await this.init();
    const collection = await this.getCollection(collectionId);
    return collection.items.find(i => i.id === itemId) || null;
  }

  /** Update an item (e.g., set extraction, skill, status) */
  async updateItem(collectionId, itemId, patch) {
    await this.init();
    const collection = await this.getCollection(collectionId);
    const idx = collection.items.findIndex(i => i.id === itemId);
    if (idx === -1) throw new Error(`Item ${itemId} not found in collection ${collectionId}`);
    Object.assign(collection.items[idx], patch);
    collection.items[idx].updatedAt = new Date().toISOString();
    collection.updatedAt = collection.items[idx].updatedAt;
    await fs.writeFile(path.join(this.collectionsDir, `${collectionId}.json`), JSON.stringify(collection, null, 2), 'utf8');
    return collection.items[idx];
  }

  /** Delete an item */
  async deleteItem(collectionId, itemId) {
    await this.init();
    const collection = await this.getCollection(collectionId);
    collection.items = collection.items.filter(i => i.id !== itemId);
    collection.updatedAt = new Date().toISOString();
    await fs.writeFile(path.join(this.collectionsDir, `${collectionId}.json`), JSON.stringify(collection, null, 2), 'utf8');
    return { deleted: true, id: itemId };
  }

  /** Record an agent action on an item */
  async addAgentAction(collectionId, itemId, action) {
    await this.init();
    const collection = await this.getCollection(collectionId);
    const item = collection.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);
    const now = new Date().toISOString();
    const entry = {
      id: `action-${randomUUID().slice(0, 8)}`,
      itemId,
      action: action.action,
      status: action.status || 'pending',
      timestamp: now,
      details: action.details || {},
    };
    item.agentActions = item.agentActions || [];
    item.agentActions.push(entry);
    item.updatedAt = now;
    collection.updatedAt = now;
    await fs.writeFile(path.join(this.collectionsDir, `${collectionId}.json`), JSON.stringify(collection, null, 2), 'utf8');
    return entry;
  }

  /** List all agent actions across all collections (for dashboard activity feed) */
  async listAgentActions(limit = 50) {
    await this.init();
    const collections = await this.listCollections();
    const allActions = [];
    for (const col of collections) {
      const full = await this.getCollection(col.id);
      for (const item of full.items) {
        for (const action of (item.agentActions || [])) {
          allActions.push({ ...action, collectionId: col.id, collectionName: col.name, itemId: item.id, itemTitle: item.sourceUrl });
        }
      }
    }
    allActions.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return allActions.slice(0, limit);
  }

  /** Search collections and items by query */
  async search(query) {
    await this.init();
    const q = query.toLowerCase();
    const collections = await this.listCollections();
    const results = [];
    for (const col of collections) {
      const full = await this.getCollection(col.id);
      for (const item of full.items) {
        const haystack = `${item.sourceUrl} ${item.platform} ${item.status} ${JSON.stringify(item.extraction || {})}`.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ collectionId: col.id, collectionName: col.name, item });
        }
      }
    }
    return results;
  }
}
