/** Resilient retrieval adapter: Agent Reach (primary) with yt-dlp fallback, plus structured parsing. */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { detectPlatform, nowIso, parsePublicUrl } from './core.js';

const URL_RE = /https?:\/\/[^\s)>\]]+/g;
const TIMESTAMP_RE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]?\s*(.+)$/;
const GENERIC_LABELS = /^(intro|introduction|conclusion|outro|summary|recap|overview|sponsor|subscribe|thanks|question|questions)$/i;

function runCmd(bin, args, timeoutMs = 120000) {
  const res = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: process.env,
  });
  const stdout = (res.stdout || '').trim();
  let json = null;
  if (stdout) { try { json = JSON.parse(stdout); } catch {} }
  return { status: res.status, stdout, stderr: (res.stderr || '').trim(), json, error: res.error };
}

function runAgentReach(args, timeoutMs) { return runCmd('agent-reach', args, timeoutMs); }
function runYtDlp(args, timeoutMs) { return runCmd('yt-dlp', ['--no-update', '--no-warnings', ...(args || [])], timeoutMs); }

/**
 * Fetch just the fields we need from yt-dlp. `--dump-json` emits huge metadata
 * (every format/storyboard) that can exceed maxBuffer (ENOBUFS) on some videos;
 * `--print` with a delimiter keeps the output small and reliable.
 */
function ytDlpMetadata(url, timeoutMs = 120000) {
  // Use a separator without '%' — yt-dlp treats %% as an escaped literal '%'.
  const sep = '===VSP===';
  const fields = ['%(title)s', '%(channel)s', '%(uploader)s', '%(upload_date)s', '%(duration)s', '%(description)s'];
  const args = ['--skip-download', '--no-playlist', ...fields.flatMap(f => ['--print', f + '\n' + sep]), url.href];
  const r = runYtDlp(args, timeoutMs);
  if (r.status !== 0 || r.error) return null;
  const parts = (r.stdout || '').split(sep).map(p => p.replace(/^\n+|\n+$/g, '').trim());
  if (parts.length < 7) return null;
  const na = v => (v && v !== 'NA') ? v : undefined;
  return {
    title: na(parts[0]),
    author: na(parts[1]) || na(parts[2]),
    publishedAt: na(parts[3]),
    duration: na(parts[4]) ? Number(parts[4]) : undefined,
    description: na(parts[5]),
  };
}

export function getAgentReachStatus() {
  const which = runCmd('sh', ['-lc', 'command -v agent-reach']);
  const path = (which.stdout || '').trim();
  if (!path) return { installed: false };
  const channels = runAgentReach(['channels'], 30000);
  return {
    installed: true,
    path,
    channelsOk: channels.json?.ok === true,
    channels: channels.json?.channels ?? null,
    rawError: channels.json?.ok === false ? channels.json.error : (channels.error?.message || channels.stderr || null),
  };
}

/** Turn a raw video description into structured, skill-ready data. */
export function parseDescription(description) {
  const tools = [];
  const steps = [];
  const links = [];
  const keyPoints = [];
  if (!description) return { tools, steps, links, keyPoints };

  const lines = String(description).split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    for (const m of line.matchAll(URL_RE)) {
      const u = m[0].replace(/[.,;]+$/, '');
      if (!links.includes(u)) links.push(u);
    }
    const tm = line.match(TIMESTAMP_RE);
    if (tm) {
      const timestamp = tm[1];
      const rest = tm[2].trim();
      steps.push({ timestamp, label: rest });
      const sep = rest.match(/^(.+?)\s+[-–—:]\s+(.+)$/);
      const label = sep ? sep[1].trim() : rest;
      const detail = sep ? sep[2].trim() : '';
      if (!GENERIC_LABELS.test(label) && detail) {
        tools.push({ timestamp, name: label, description: detail });
      }
    }
  }

  for (const line of lines) {
    if (TIMESTAMP_RE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (line.length < 30) continue;
    if (/^(timestamps?|connect|free vibe coder toolkit|try limora now)\b/i.test(line)) continue;
    if (/^#\w/.test(line)) continue;
    keyPoints.push(line);
  }

  return { tools, steps, links, keyPoints };
}

function agentMeta(read) {
  const item = read.json?.items?.[0] ?? read.json?.data ?? read.json;
  if (!item || typeof item !== 'object') return null;
  return {
    title: item.title ?? item.name,
    author: item.author ?? item.channel ?? item.uploader,
    publishedAt: item.date ?? item.published ?? item.published_at,
    duration: item.duration,
    // Agent Reach exposes the description in `text`; older versions use description/summary.
    description: item.text ?? item.description ?? item.summary ?? item.desc,
  };
}

function ytDlpMeta(json) {
  if (!json || Array.isArray(json)) return null;
  return {
    title: json.title,
    author: json.channel ?? json.uploader,
    publishedAt: json.upload_date ?? json.release_date,
    duration: json.duration,
    description: json.description,
  };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

function cleanVtt(vtt) {
  if (!vtt) return '';
  return vtt
    .replace(/^WEBVTT[^\n]*\n/m, '')
    .replace(/^NOTE[^\n]*\n/gm, '')
    .replace(/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}[^\n]*\n/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Parse VTT into timed segments and de-duplicate YouTube's rolling captions
 * (each block repeats the previous text plus a few new words). Returns an
 * array of { seconds, text } used to ground the build instructions per step.
 */
function parseVttSegments(vtt) {
  if (!vtt || !/--\s*>/.test(vtt)) return [];
  const raw = [];
  for (const block of String(vtt).split(/\r?\n\r?\n/)) {
    const tm = block.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/);
    if (!tm) continue;
    const seconds = Number(tm[1]) * 3600 + Number(tm[2]) * 60 + Number(tm[3]) + Number(tm[4]) / 1000;
    let text = block.replace(/^[^\n]*-->[^\n]*\r?\n/, '');
    text = decodeEntities(text.replace(/<[^>]+>/g, ''));
    text = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join(' ');
    if (text) raw.push({ seconds, text });
  }
  const out = [];
  let prev = '';
  for (const seg of raw) {
    let t = seg.text;
    if (prev && t.startsWith(prev)) t = t.slice(prev.length).trim();
    else if (prev) {
      const pw = prev.split(' '), cw = t.split(' ');
      let overlap = 0;
      for (let n = Math.min(pw.length, cw.length); n > 0; n--) {
        if (pw.slice(-n).join(' ') === cw.slice(0, n).join(' ')) { overlap = n; break; }
      }
      if (overlap) t = cw.slice(overlap).join(' ').trim();
    }
    if (t) out.push({ seconds: seg.seconds, text: t });
    prev = seg.text;
  }
  return out;
}

function tsToSeconds(ts) {
  const m = String(ts || '').match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return m[3] ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
}

/** Best-effort transcript: Agent Reach subtitle -> yt-dlp auto-subs -> Agent Reach transcribe (Whisper). */
function getTranscript(url, result) {
  const sub = runAgentReach(['youtube', 'subtitle', url.href], 180000);
  const subOk = sub.json?.ok;
  const subErr = sub.json?.error?.code || '';
  const rateLimited = subErr === 'RATE_LIMITED' || /429|rate limit/i.test(sub.stderr || '');
  if (subOk) {
    const s = sub.json.items?.[0] ?? sub.json.data ?? sub.json;
    result.transcript = typeof s === 'string' ? s : (s?.text ?? s?.subtitle ?? s?.subtitle_text ?? s?.content ?? JSON.stringify(s));
    result.source.retrievalTools.push('agent-reach:subtitle');
    result.evidence.push({ claim: 'Transcript retrieved via Agent Reach YouTube subtitle.', sourceType: 'external-doc', confidence: 'medium', notes: 'May be auto-generated; verify timestamps against the video.' });
    return;
  }
  result.warnings.push(`youtube subtitle: ${sub.json?.error?.message || sub.stderr || 'failed'}`);

  // yt-dlp auto-generated subtitles (does not depend on Agent Reach channel state).
  // YouTube rate-limits subtitle fetches intermittently (HTTP 429); retry a few
  // times with backoff before giving up so a transient 429 doesn't erase evidence.
  const subArgs = (tmp) => ['--skip-download', '--write-auto-subs', '--write-subs', '--sub-langs', 'en.*', '--sub-format', 'vtt', '-o', `${tmp}.%(ext)s`, url.href];
  for (let attempt = 0; attempt < 3; attempt++) {
    const tmp = `/tmp/video-skill-subs-${Date.now()}-${attempt}`;
    runYtDlp(subArgs(tmp), 180000);
    try {
      const dir = tmp.slice(0, tmp.lastIndexOf('/'));
      const prefix = tmp.slice(tmp.lastIndexOf('/') + 1);
      const files = readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.vtt'));
      for (const f of files) {
        const raw = readFileSync(`${dir}/${f}`, 'utf8');
        const text = cleanVtt(raw);
        if (text) {
          result.transcript = text;
          result.transcriptSegments = parseVttSegments(raw);
          result.source.retrievalTools.push('yt-dlp:subtitle');
          result.evidence.push({ claim: 'Transcript retrieved via yt-dlp auto-generated subtitles.', sourceType: 'external-doc', confidence: 'medium', notes: 'Auto-generated; verify against the video.' });
          for (const f2 of files) { try { unlinkSync(`${dir}/${f2}`); } catch {} }
          return;
        }
      }
    } catch {}
    if (attempt < 2) { try { spawnSync('sleep', ['3']); } catch {} }
  }

  if (!result.transcript) {
    const transcribe = runAgentReach(['youtube', 'transcribe', url.href], 300000);
    if (transcribe.json?.ok) {
      const s = transcribe.json.items?.[0] ?? transcribe.json.data ?? transcribe.json;
      result.transcript = typeof s === 'string' ? s : (s?.text ?? s?.transcript ?? JSON.stringify(s));
      result.source.retrievalTools.push('agent-reach:transcribe');
      result.evidence.push({ claim: 'Transcript retrieved via Agent Reach transcribe (Whisper).', sourceType: 'external-doc', confidence: 'medium', notes: 'Speech-to-text from audio; requires a configured Groq/OpenAI key.' });
    } else {
      const msg = transcribe.json?.error?.message || transcribe.stderr || 'failed';
      result.source.limitations.push(
        /key|groq|openai|setup/i.test(msg)
          ? 'Transcript unavailable: no Groq/OpenAI key. Run `agent-reach configure groq-key` in your terminal.'
          : `Transcript unavailable via Agent Reach transcribe: ${msg}`
      );
    }
  }
}

export async function extractVideo(inputUrl) {
  const parsed = parsePublicUrl(inputUrl);
  if (!parsed.ok) {
    return { ok: false, source: { url: inputUrl, retrievedAt: nowIso(), retrievalTools: [], limitations: [] }, evidence: [], warnings: [], tools: [], links: [], steps: [], keyPoints: [], error: parsed.error };
  }
  const url = parsed.url;
  const platform = detectPlatform(url);
  const result = {
    ok: false,
    source: { url: url.href, platform, retrievedAt: nowIso(), retrievalTools: [], limitations: [] },
    evidence: [], warnings: [], tools: [], links: [], steps: [], keyPoints: [],
  };

  if (platform === 'youtube') {
    const status = getAgentReachStatus();
    if (status.installed) result.source.retrievalTools.push(`agent-reach@${status.path}`);

    // 1) Metadata + description: Agent Reach first, yt-dlp as resilient fallback.
    const read = status.installed ? runAgentReach(['youtube', 'read', url.href]) : { json: null };
    let meta = read.json?.ok ? agentMeta(read) : null;
    result.raw = { read: read.json ?? read.stdout ?? read.stderr };
    if (!read.json?.ok) result.warnings.push(`youtube read: ${read.json?.error?.message || read.stderr || 'failed'}`);

    if (!meta?.description) {
      const ym = ytDlpMetadata(url, 120000);
      result.raw.ytdlp = ym ? { title: ym.title, author: ym.author, duration: ym.duration, descriptionLength: (ym.description || '').length } : 'failed';
      if (ym) {
        meta = { ...(meta || {}), ...Object.fromEntries(Object.entries(ym).filter(([, v]) => v != null)) };
        result.source.retrievalTools.push('yt-dlp');
      } else {
        result.warnings.push('yt-dlp: metadata unavailable');
      }
    }

    if (meta) {
      result.source.title = meta.title;
      result.source.author = meta.author;
      result.source.publishedAt = meta.publishedAt;
      result.source.duration = meta.duration;
      result.description = meta.description;
    }

    // 2) Transcript (best effort).
    if (status.installed) getTranscript(url, result);
    else result.source.limitations.push('Agent Reach not installed; transcript unavailable.');

    // 3) Structured parsing of the description.
    const parsedDesc = parseDescription(result.description);
    result.tools = parsedDesc.tools;
    result.steps = parsedDesc.steps;
    result.links = parsedDesc.links;
    result.keyPoints = parsedDesc.keyPoints;

    if (result.description) result.evidence.push({ claim: 'Video description retrieved (lists tools and links shown by the creator).', sourceType: 'description', confidence: 'high' });
    if (parsedDesc.tools.length) result.evidence.push({ claim: `${parsedDesc.tools.length} tools/websites identified from the description timeline.`, sourceType: 'description', confidence: 'high' });
    if (parsedDesc.links.length) result.evidence.push({ claim: `${parsedDesc.links.length} links extracted from the description.`, sourceType: 'description', confidence: 'high' });

    result.ok = Boolean(result.description || result.transcript);
    return result;
  }

  if (platform === 'bilibili') {
    const read = runAgentReach(['bilibili', 'read', url.href]);
    const subtitle = runAgentReach(['bilibili', 'subtitle', url.href]);
    result.raw = { read: read.json ?? read.stdout ?? read.stderr, subtitle: subtitle.json ?? subtitle.stdout ?? subtitle.stderr };
    if (read.json?.ok) {
      const item = read.json.items?.[0] ?? read.json.data ?? read.json;
      result.source.title = item?.title ?? item?.name;
      result.source.author = item?.uploader ?? item?.owner ?? item?.author;
      result.description = item?.description ?? item?.desc ?? item?.summary ?? item?.text;
      result.ok = true;
    } else result.warnings.push(`bilibili read: ${read.json?.error?.message || read.stderr || 'failed'}`);
    if (subtitle.json?.ok) {
      const s = subtitle.json.items?.[0] ?? subtitle.json.data ?? subtitle.json;
      result.transcript = typeof s === 'string' ? s : (s?.text ?? s?.subtitle ?? s?.content ?? JSON.stringify(s));
      result.ok = true;
    } else result.source.limitations.push('Bilibili subtitles unavailable; login may be required.');
    const parsedDesc = parseDescription(result.description);
    Object.assign(result, parsedDesc);
    if (result.description) result.evidence.push({ claim: 'Video description retrieved.', sourceType: 'description', confidence: 'high' });
    return result;
  }

  // Generic web / other social platforms.
  const read = runAgentReach(['read', url.href]);
  result.raw = { read: read.json ?? read.stdout ?? read.stderr };
  if (read.json?.ok) {
    const item = read.json.items?.[0] ?? read.json.data ?? read.json;
    result.source.title = item?.title;
    result.description = item?.text ?? item?.content ?? item?.description ?? (typeof item === 'string' ? item : undefined);
    result.ok = true;
    result.evidence.push({ claim: 'Content retrieved via Agent Reach generic read.', sourceType: 'external-doc', confidence: 'low', notes: 'Generic read may not include full transcript or visual steps.' });
  } else {
    result.error = { code: 'READ_FAILED', message: read.json?.error?.message || read.stderr || 'Agent Reach could not read the URL.' };
    result.warnings.push('No supported extraction path succeeded.');
  }
  const parsedDesc = parseDescription(result.description);
  Object.assign(result, parsedDesc);
  return result;
}
