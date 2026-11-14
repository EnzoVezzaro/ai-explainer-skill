/** Thin Agent Reach adapter — multi-platform content extraction. Self-contained module. */
import { spawnSync } from 'node:child_process';
import { detectPlatform, nowIso, parsePublicUrl, slugify } from '../../core/src/index.js';

function runAgentReach(args, timeoutMs = 120000) {
  const res = spawnSync('agent-reach', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: process.env });
  const stdout = (res.stdout || '').trim();
  let json = null;
  if (stdout) { try { json = JSON.parse(stdout); } catch {} }
  return { status: res.status, stdout, stderr: (res.stderr || '').trim(), json, error: res.error };
}

function errorOk(j) { return j && j.ok === true; }
function errorCode(j) { return j && j.error && j.error.code; }
function isRateLimited(j, stderr) {
  const c = errorCode(j);
  const s = (stderr || '').toLowerCase();
  return c === 'RATE_LIMITED' || s.includes('429') || s.includes('rate limit');
}

export function getAgentReachStatus() {
  const which = spawnSync('sh', ['-lc', 'command -v agent-reach'], { encoding: 'utf8' });
  const path = (which.stdout || '').trim();
  if (!path) return { installed: false };
  const channels = runAgentReach(['channels'], 30000);
  return { installed: true, path, channelsOk: errorOk(channels.json), channels: channels.json?.channels ?? null, rawError: errorOk(channels.json) ? null : (channels.json?.error || channels.error?.message || channels.stderr || null) };
}

/** @typedef {import('../../core/src/index.js').ExtractionResult} ExtractionResult */

/**
 * Extract instructional content from ANY public URL.
 * Supports YouTube, Instagram, TikTok, X/Twitter, Bilibili, and generic web pages.
 * Falls back through Agent Reach actions: platform-specific read → subtitle → transcribe → generic web read.
 * @param {string} inputUrl
 * @returns {Promise<ExtractionResult>}
 */
export async function extractVideo(inputUrl) {
  const parsed = parsePublicUrl(inputUrl);
  if (!parsed.ok) { return { ok: false, source: { url: inputUrl, retrievedAt: nowIso(), retrievalTools: [], limitations: [] }, evidence: [], warnings: [], error: parsed.error }; }
  const url = parsed.url;
  const platform = detectPlatform(url);
  const result = { ok: false, source: { url: url.href, platform, retrievedAt: nowIso(), retrievalTools: [], limitations: [] }, evidence: [], warnings: [] };
  const status = getAgentReachStatus();
  if (!status.installed) { result.error = { code: 'AGENT_REACH_NOT_INSTALLED', message: 'agent-reach is not installed or not on PATH.', hint: 'Install Agent Reach or use another configured retrieval provider.' }; result.warnings.push('Retrieval adapter unavailable; no external evidence collected.'); return result; }
  result.source.retrievalTools.push(`agent-reach@${status.path}`);

  if (platform === 'youtube') return await extractYouTube(url, result, status);
  if (platform === 'instagram') return await extractInstagram(url, result, status);
  if (platform === 'twitter' || platform === 'x') return await extractTwitter(url, result, status);
  if (platform === 'tiktok') return await extractGenericWeb(url, result, status);
  if (platform === 'bilibili') return await extractBilibili(url, result, status);
  return await extractGenericWeb(url, result, status);
}

/* ---------- helpers ---------- */
function usernameFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] || null;
}
function normalizeText(s) {
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object') return s?.text ?? s?.subtitle ?? s?.transcript ?? s?.content ?? JSON.stringify(s, null, 2);
  return '';
}
function firstItem(j) { return j?.items?.[0] ?? j?.data ?? j; }

/* ---------- YouTube ---------- */
async function extractYouTube(url, result, status) {
  const read = runAgentReach(['youtube', 'read', url.href]);
  result.raw = { read: read.json ?? read.stdout ?? read.stderr };
  if (errorOk(read.json)) { const item = firstItem(read.json); result.source.title = item?.title ?? item?.name; result.source.author = item?.channel ?? item?.author ?? item?.uploader; result.source.publishedAt = item?.date ?? item?.published ?? item?.upload_date; result.source.duration = item?.duration; result.description = item?.description ?? item?.summary; result.ok = true; } else { result.warnings.push(`youtube read: ${read.json?.error?.message || read.stderr || 'failed'}`); }

  let transcriptOk = false;
  let subtitleRateLimited = false;
  const subtitle = runAgentReach(['youtube', 'subtitle', url.href]);
  result.raw.subtitle = subtitle.json ?? subtitle.stdout ?? subtitle.stderr;
  if (errorOk(subtitle.json)) { const s = firstItem(subtitle.json); result.transcript = normalizeText(s); transcriptOk = true; result.evidence.push({ claim: 'Transcript/subtitles retrieved via Agent Reach YouTube subtitle action.', sourceType: 'external-doc', confidence: 'medium', notes: 'May be auto-generated or partial; verify timestamps against video.' }); result.ok = true; }
  else { subtitleRateLimited = isRateLimited(subtitle.json, subtitle.stderr); result.source.limitations.push('Subtitles/transcript unavailable via Agent Reach youtube subtitle.'); result.warnings.push(`youtube subtitle: ${subtitle.json?.error?.message || subtitle.stderr || 'failed'}`); }

  if (!result.transcript && (subtitleRateLimited || !transcriptOk)) {
    const transcribe = runAgentReach(['youtube', 'transcribe', url.href], 300000);
    result.raw.transcribe = transcribe.json ?? transcribe.stdout ?? transcribe.stderr;
    if (errorOk(transcribe.json)) { const s = firstItem(transcribe.json); result.transcript = normalizeText(s); result.evidence.push({ claim: 'Transcript retrieved via Agent Reach YouTube transcribe (Whisper speech-to-text).', sourceType: 'external-doc', confidence: 'medium', notes: 'Auto-generated from audio; verify against video. Requires a configured Groq or OpenAI key.' }); result.ok = true; transcriptOk = true; }
    else { const tErr = errorCode(transcribe.json); const tMsg = transcribe.json?.error?.message || transcribe.stderr || 'failed'; if (tErr === 'NEED_SETUP' || tMsg.includes('key') || tMsg.includes('Groq') || tMsg.includes('OpenAI')) { result.source.limitations.push('Whisper transcript unavailable: no Groq/OpenAI key configured. Run `agent-reach configure groq-key` in your terminal.'); } else { result.source.limitations.push('Whisper transcript unavailable via Agent Reach youtube transcribe.'); } result.warnings.push(`youtube transcribe: ${tMsg}`); }
  }

  if (result.description) result.evidence.push({ claim: 'Video description retrieved.', sourceType: 'description', confidence: 'high' });
  return result;
}

/* ---------- Instagram (actions: search, profile, posts) ---------- */
async function extractInstagram(url, result, status) {
  const username = usernameFromPath(url.pathname);
  // Try posts first (gets recent posts from a profile), then profile
  if (username) {
    const posts = runAgentReach(['instagram', 'posts', username]);
    result.raw = { posts: posts.json ?? posts.stdout ?? posts.stderr };
    if (errorOk(posts.json)) {
      const item = firstItem(posts.json);
      result.source.title = `Instagram post by ${item?.username ?? username}`;
      result.source.author = item?.username ?? username;
      result.description = item?.text ?? item?.caption ?? item?.description ?? item?.summary;
      result.transcript = item?.text ?? item?.caption;
      result.ok = true;
      result.evidence.push({ claim: `Instagram posts retrieved for @${username}.`, sourceType: 'external-doc', confidence: 'medium', notes: 'Recent posts from the profile; specific post URL may not map to a single item.' });
    } else {
      result.warnings.push(`instagram posts: ${posts.json?.error?.message || posts.stderr || 'failed'}`);
    }
  }
  const profile = runAgentReach(['instagram', 'profile', username || url.href]);
  result.raw.profile = profile.json ?? profile.stdout ?? profile.stderr;
  if (errorOk(profile.json) && !result.ok) {
    const item = firstItem(profile.json);
    result.source.title = item?.username ?? 'Instagram profile';
    result.source.author = item?.username;
    result.description = item?.bio ?? item?.description ?? item?.summary;
    result.ok = true;
    result.evidence.push({ claim: `Instagram profile retrieved for ${username || url.href}.`, sourceType: 'external-doc', confidence: 'medium' });
  } else if (!result.ok) {
    result.source.limitations.push('Instagram content unavailable via Agent Reach.');
    result.warnings.push(`instagram: ${profile.json?.error?.message || profile.stderr || 'failed'}`);
  }
  if (result.description) result.evidence.push({ claim: 'Instagram bio/description retrieved.', sourceType: 'description', confidence: 'high' });
  return result;
}

/* ---------- X / Twitter (actions: search, profile, tweets, thread) ---------- */
async function extractTwitter(url, result, status) {
  const username = usernameFromPath(url.pathname);
  // Try thread first (accepts tweet id or link), then tweets from profile
  const thread = runAgentReach(['twitter', 'thread', url.href]);
  result.raw = { thread: thread.json ?? thread.stdout ?? thread.stderr };
  if (errorOk(thread.json)) {
    const item = firstItem(thread.json);
    result.source.title = item?.text ? item?.text.slice(0, 100) + '...' : 'X post';
    result.source.author = item?.username ?? item?.author ?? username;
    result.description = item?.text ?? item?.content ?? item?.description;
    result.transcript = item?.text;
    result.ok = true;
    result.evidence.push({ claim: 'X/Twitter thread retrieved.', sourceType: 'external-doc', confidence: 'medium', notes: 'May require login; verify against the post.' });
  } else {
    result.warnings.push(`twitter thread: ${thread.json?.error?.message || thread.stderr || 'failed'}`);
  }
  if (!result.ok && username) {
    const tweets = runAgentReach(['twitter', 'tweets', username]);
    result.raw.tweets = tweets.json ?? tweets.stdout ?? tweets.stderr;
    if (errorOk(tweets.json)) {
      const item = firstItem(tweets.json);
      result.source.title = `Recent posts by @${username}`;
      result.source.author = item?.username ?? username;
      result.description = item?.text ?? item?.content ?? item?.description;
      result.transcript = item?.text;
      result.ok = true;
      result.evidence.push({ claim: `Recent tweets retrieved for @${username}.`, sourceType: 'external-doc', confidence: 'medium', notes: 'Profile timeline; specific tweet URL may not map to a single item.' });
    } else {
      result.warnings.push(`twitter tweets: ${tweets.json?.error?.message || tweets.stderr || 'failed'}`);
    }
  }
  if (!result.ok) {
    result.source.limitations.push('X/Twitter content unavailable via Agent Reach.');
  }
  if (result.description) result.evidence.push({ claim: 'X/Twitter post text retrieved.', sourceType: 'description', confidence: 'high' });
  return result;
}

/* ---------- Bilibili ---------- */
async function extractBilibili(url, result, status) {
  const read = runAgentReach(['bilibili', 'read', url.href]);
  result.raw = { read: read.json ?? read.stdout ?? read.stderr };
  if (errorOk(read.json)) { const item = firstItem(read.json); result.source.title = item?.title ?? item?.name; result.source.author = item?.uploader ?? item?.owner ?? item?.author; result.description = item?.description ?? item?.desc ?? item?.summary; result.ok = true; } else { result.warnings.push(`bilibili read: ${read.json?.error?.message || read.stderr || 'failed'}`); }
  const subtitle = runAgentReach(['bilibili', 'subtitle', url.href]);
  result.raw.subtitle = subtitle.json ?? subtitle.stdout ?? subtitle.stderr;
  if (errorOk(subtitle.json)) { const s = firstItem(subtitle.json); result.transcript = normalizeText(s); result.evidence.push({ claim: 'Subtitles retrieved via Agent Reach Bilibili subtitle action.', sourceType: 'external-doc', confidence: 'medium', notes: 'May require login; verify against video.' }); result.ok = true; }
  else { result.source.limitations.push('Bilibili subtitles unavailable; login may be required.'); result.warnings.push(`bilibili subtitle: ${subtitle.json?.error?.message || subtitle.stderr || 'failed'}`); }
  if (result.description) result.evidence.push({ claim: 'Video description retrieved.', sourceType: 'description', confidence: 'high' });
  return result;
}

/* ---------- Generic web (TikTok fallback + any page) ---------- */
async function extractGenericWeb(url, result, status) {
  const read = runAgentReach(['read', url.href]);
  result.raw = { read: read.json ?? read.stdout ?? read.stderr };
  if (errorOk(read.json)) { const item = firstItem(read.json); result.source.title = item?.title ?? item?.name; result.source.author = item?.author ?? item?.uploader; result.description = item?.text ?? item?.content ?? item?.description ?? item?.summary; result.transcript = item?.text ?? item?.content; result.ok = true; result.evidence.push({ claim: 'Page content retrieved via Agent Reach generic read.', sourceType: 'external-doc', confidence: 'low', notes: 'Generic read may not include full transcript, video, or visual steps.' }); }
  else { result.error = { code: 'READ_FAILED', message: read.json?.error?.message || read.stderr || 'Agent Reach could not read the URL.' }; result.warnings.push('No supported extraction path succeeded.'); }
  if (result.description) result.evidence.push({ claim: 'Page description/content retrieved.', sourceType: 'description', confidence: 'high' });
  return result;
}
