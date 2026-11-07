/** Thin Agent Reach adapter. Self-contained module. */
import { spawnSync } from 'node:child_process';
import { detectPlatform, nowIso, parsePublicUrl } from './core.js';

function runAgentReach(args, timeoutMs = 120000) {
  const res = spawnSync('agent-reach', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: process.env });
  const stdout = (res.stdout || '').trim();
  let json = null;
  if (stdout) { try { json = JSON.parse(stdout); } catch {} }
  return { status: res.status, stdout, stderr: (res.stderr || '').trim(), json, error: res.error };
}

export function getAgentReachStatus() {
  const which = spawnSync('sh', ['-lc', 'command -v agent-reach'], { encoding: 'utf8' });
  const path = (which.stdout || '').trim();
  if (!path) return { installed: false };
  const channels = runAgentReach(['channels'], 30000);
  return { installed: true, path, channelsOk: channels.json?.ok === true, channels: channels.json?.channels ?? null, rawError: channels.json?.ok === false ? channels.json.error : (channels.error?.message || channels.stderr || null) };
}

export async function extractVideo(inputUrl) {
  const parsed = parsePublicUrl(inputUrl);
  if (!parsed.ok) { return { ok: false, source: { url: inputUrl, retrievedAt: nowIso(), retrievalTools: [], limitations: [] }, evidence: [], warnings: [], error: parsed.error }; }
  const url = parsed.url;
  const platform = detectPlatform(url);
  const result = { ok: false, source: { url: url.href, platform, retrievedAt: nowIso(), retrievalTools: [], limitations: [] }, evidence: [], warnings: [] };
  const status = getAgentReachStatus();
  if (!status.installed) { result.error = { code: 'AGENT_REACH_NOT_INSTALLED', message: 'agent-reach is not installed or not on PATH.', hint: 'Install Agent Reach or use another configured retrieval provider.' }; result.warnings.push('Retrieval adapter unavailable; no external evidence collected.'); return result; }
  result.source.retrievalTools.push(`agent-reach@${status.path}`);
  if (platform === 'youtube') {
    const read = runAgentReach(['youtube', 'read', url.href]);
    const subtitle = runAgentReach(['youtube', 'subtitle', url.href]);
    result.raw = { read: read.json ?? read.stdout ?? read.stderr, subtitle: subtitle.json ?? subtitle.stdout ?? subtitle.stderr };
    if (read.json?.ok) { const item = read.json.items?.[0] ?? read.json.data ?? read.json; result.source.title = item?.title ?? item?.name; result.source.author = item?.channel ?? item?.author ?? item?.uploader; result.source.publishedAt = item?.date ?? item?.published ?? item?.upload_date; result.source.duration = item?.duration; result.description = item?.description ?? item?.summary; result.ok = true; } else { result.warnings.push(`youtube read: ${read.json?.error?.message || read.stderr || 'failed'}`); }
    if (subtitle.json?.ok) { const s = subtitle.json.items?.[0] ?? subtitle.json.data ?? subtitle.json; result.transcript = typeof s === 'string' ? s : (s?.text ?? s?.subtitle ?? s?.transcript ?? JSON.stringify(s, null, 2)); result.evidence.push({ claim: 'Transcript/subtitles retrieved via Agent Reach YouTube subtitle action.', sourceType: 'external-doc', confidence: 'medium', notes: 'May be auto-generated or partial; verify timestamps against video.' }); result.ok = true; } else { result.source.limitations.push('Subtitles/transcript unavailable via Agent Reach youtube subtitle.'); result.warnings.push(`youtube subtitle: ${subtitle.json?.error?.message || subtitle.stderr || 'failed'}`); }
    if (result.description) result.evidence.push({ claim: 'Video description retrieved.', sourceType: 'description', confidence: 'high' });
    return result;
  }
  if (platform === 'bilibili') {
    const read = runAgentReach(['bilibili', 'read', url.href]);
    const subtitle = runAgentReach(['bilibili', 'subtitle', url.href]);
    result.raw = { read: read.json ?? read.stdout ?? read.stderr, subtitle: subtitle.json ?? subtitle.stdout ?? subtitle.stderr };
    if (read.json?.ok) { const item = read.json.items?.[0] ?? read.json.data ?? read.json; result.source.title = item?.title ?? item?.name; result.source.author = item?.uploader ?? item?.owner ?? item?.author; result.description = item?.description ?? item?.desc ?? item?.summary; result.ok = true; } else { result.warnings.push(`bilibili read: ${read.json?.error?.message || read.stderr || 'failed'}`); }
    if (subtitle.json?.ok) { const s = subtitle.json.items?.[0] ?? subtitle.json.data ?? subtitle.json; result.transcript = typeof s === 'string' ? s : (s?.text ?? s?.subtitle ?? s?.content ?? JSON.stringify(s, null, 2)); result.evidence.push({ claim: 'Subtitles retrieved via Agent Reach Bilibili subtitle action.', sourceType: 'external-doc', confidence: 'medium', notes: 'May require login or be unavailable; verify against video.' }); result.ok = true; } else { result.source.limitations.push('Bilibili subtitles unavailable; login may be required.'); result.warnings.push(`bilibili subtitle: ${subtitle.json?.error?.message || subtitle.stderr || 'failed'}`); }
    if (result.description) result.evidence.push({ claim: 'Video description retrieved.', sourceType: 'description', confidence: 'high' });
    return result;
  }
  const read = runAgentReach(['read', url.href]);
  result.raw = { read: read.json ?? read.stdout ?? read.stderr };
  if (read.json?.ok) { const item = read.json.items?.[0] ?? read.json.data ?? read.json; result.source.title = item?.title; result.description = item?.text ?? item?.content ?? item?.description ?? (typeof item === 'string' ? item : undefined); result.ok = true; result.evidence.push({ claim: 'Content retrieved via Agent Reach generic read.', sourceType: 'external-doc', confidence: 'low', notes: 'Generic read may not include full transcript or visual steps.' }); } else { result.error = { code: 'READ_FAILED', message: read.json?.error?.message || read.stderr || 'Agent Reach could not read the URL.' }; result.warnings.push('No supported extraction path succeeded.'); }
  return result;
}
