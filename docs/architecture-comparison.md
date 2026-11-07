# Architecture Comparison: Impeccable vs Video Skill (Phase 1)

## Scope of this comparison

This document compares the **architectural patterns** observed in [Impeccable](https://impeccable.style/) / [pbakaus/impeccable](https://github.com/pbakaus/impeccable) with the requirements for **Video Skill** (provisional name): a web-distributed system that helps existing AI coding agents learn workflows from instructional videos and turn them into reusable, executable Agent Skills.

It is based on public documentation and the Impeccable README/package metadata reviewed during Phase 1. It does **not** copy Impeccable branding, visual identity, proprietary content, or unrelated design expertise.

## What Impeccable does (observed patterns)

| Area | Impeccable pattern | Why it works |
|---|---|---|
| **Product shape** | One installable skill system + one CLI + one public website + multiple supported coding agents. | Simple mental model; users discover on web, install via CLI, use inside their existing harness. |
| **Core intelligence** | A unified skill (`/impeccable ...`) with focused operations/commands, not many unrelated top-level skills. | Discoverable, easier to maintain, matches how users issue intent. |
| **Distribution** | npm package/CLI (`npx impeccable install`), harness-specific install targets, update/uninstall/doctor flows, optional hooks/subagents where supported. | Meets developers where they are; safe lifecycle management. |
| **Harness integration** | Detects supported tools (Claude Code, Cursor, Codex, Copilot, OpenCode, etc.) and installs into each harness's native skill/command locations. Project vs global scope. | Respects native conventions; avoids inventing unsupported invocation mechanisms. |
| **Context & artifacts** | Uses project context files (`PRODUCT.md`, `DESIGN.md`), config, ignores, and progressive disclosure. | Keeps core instructions small; stores durable project knowledge. |
| **Quality/automation** | Deterministic detector/engine, hooks for write-time checks, CLI scans, CI annotations, browser extension/overlay. | Makes quality measurable and automatable. |
| **Website role** | Discovery, onboarding, docs, examples/gallery, command reference, interactive demos; aligned with real product behavior. | Website teaches and sells the real system, not a disconnected demo. |
| **Execution boundary** | The coding agent does editing/reasoning in the user's workspace; Impeccable provides design expertise, checks, and workflows. | No new coding harness; augments existing ones. |

## What Video Skill must do differently

| Area | Reuse conceptually | Implement differently |
|---|---|---|
| **Domain intelligence** | Unified skill + focused operations (`learn`, `explain`, `create`, `build`, `verify`, `improve`). | Intelligence is **instructional video understanding → workflow extraction → skill compilation → verified reproduction**, not design critique/polish. |
| **Input source** | External content/context informs the skill. | Primary input is a **public video URL** plus extracted metadata/transcript/frames/description/links. Must treat all external content as **untrusted**. |
| **Retrieval** | Integrate specialized tooling rather than reinventing everything. | Use **Agent Reach** as the primary retrieval integration for supported video sources (especially YouTube/Bilibili where applicable). Add thin adapters/fallbacks for missing transcripts/visual evidence; do not duplicate Agent Reach logic unnecessarily. |
| **Skill engineering** | Progressive disclosure, references/scripts/assets, validation, evaluation mindset. | Follow **Agent Skills** spec and **Anthropic Skill Creator** workflow to compile *generated* tutorial skills (e.g., `generated/<slug>/SKILL.md`, references, evals). Generated skills must include provenance, preconditions, verification, troubleshooting. |
| **Execution model** | Existing harness executes; skill provides instructions/context. | `build` must clearly separate **preparing an executable skill/plan** from **actually executing** in the selected harness. Execution requires harness permissions/authorization; never auto-run destructive or privileged actions from video content. |
| **Playground** | Interactive web demo connected to real behavior. | Playground accepts a public video URL and performs **bounded, isolated server-side analysis jobs** for explain/create/build-prep where deployed. It must not require coding-agent credentials, must not be a cloud IDE, and must allow downloading the generated skill archive + copyable harness commands. |
| **Safety & trust** | Quality checks and guardrails. | Stronger untrusted-input posture: prompt-injection resistance, SSRF-safe URL validation, no DRM bypass, no credential exfiltration, explicit approval gates, evidence labeling (spoken vs visible vs description vs docs vs inference), safe archive extraction. |
| **Evidence & verification** | Detector/CI produce concrete findings. | Verification means **real commands/tests/logs/screenshots** when appropriate. Never claim a tutorial was reproduced unless execution actually occurred. Examples must show observed results or be clearly marked unverified fixtures. |
| **Cross-domain scope** | Works across projects/frameworks in its domain. | Must work across **different tutorial subjects** (web app, frontend reproduction, dev environment setup, browser automation, API integration, general SWE tutorial), not only web UI design. |
| **Interoperability** | Multi-harness adapters/installers. | Same adapter discipline, but operations are video/skill oriented. Support Claude Code, Codex, OpenCode, Cursor where compatible; project/user install where provider allows; reversible install/update/uninstall. Consider MCP only where it adds real interoperability. Respect `AGENTS.md`. |

## Reusable architectural decisions for the MVP

1. **One primary shared skill**: `video-skill` with clear operations and strong trigger description.
2. **Shared core contracts**: video source, extraction evidence, workflow model, skill artifact, validation result, execution handoff metadata — used by both CLI and website.
3. **Thin adapters**: Agent Reach adapter, harness installers, optional transcription/frame-analysis providers behind interfaces.
4. **Progressive disclosure**: concise `SKILL.md`; detailed source walkthrough/provenance/dependencies in `references/`.
5. **Portable first**: generated skills are Agent Skills-compatible folders/archives; provider-specific behavior stays in installers.
6. **No hosted DB/account required** for basic CLI/skill operation.
7. **Explicit evidence model**: every extracted instruction carries source type + timestamp/reference when available.

## Key risks / open decisions

- **Agent Reach integration surface**: confirm the current supported CLI/API for YouTube/Bilibili retrieval and transcript access in the installed environment; wrap behind an adapter and feature-detect.
- **Visual-only tutorial steps**: may require frame sampling/OCR/video understanding when permitted; label as lower-confidence evidence.
- **Playground compute/cost**: use bounded jobs, rate limits, timeouts, and small fixtures for demos; keep heavy analysis optional.
- **Harness execution UX**: `build` handoff must match each harness's real invocation model (native skill discovery, prompt patterns, commands/agents only if supported).
- **Eval realism**: skill-creator eval patterns are ideal, but automated execution evals depend on available sandbox/harness; start with schema/trigger/compilation validation plus real end-to-end fixtures.

## Phase 2 starting point

1. Scaffold `skills/video-skill/` with a portable, unified `SKILL.md` and reference templates.
2. Define shared TypeScript contracts in `packages/core` (extraction evidence, workflow, generated skill manifest).
3. Implement `packages/agent-reach-adapter` and `packages/video-analyzer` as thin, testable modules.
4. Implement `packages/skill-compiler` to emit Agent Skills-compatible folders using Skill Creator conventions.
5. Build `packages/cli` for `install/update/uninstall/doctor/providers/learn/create/validate`.
6. Add `apps/web` only after core contracts stabilize; connect it to the same core modules or bounded API jobs.
