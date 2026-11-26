# Project Brief: Internal Architecture & Privacy Diagram Tool

> **For Claude Code:** This file is the source of truth for this fork. Read it fully before doing anything else, then follow "Working agreement" and start at Phase 0. When this brief and upstream docs (CONTRIBUTING.md, AGENTS.md, archify/SKILL.md) disagree, this brief wins.

---

## 1. Context

**Who:** A Programmer/Analyst in the Metro Vancouver IT Department (a BC regional district; a public body under BC's FOIPPA). The department designs internal solutions and add-ons for vendor products.

**Why:** Because of the growing focus on AI and cybersecurity, the Infrastructure Team runs **Architectural Review Panels (ARP)**, and solutions must pass before go-live. Many initiatives also need a **Privacy Impact Assessment (PIA)**. FOIPPA s. 69(5.3) requires a PIA for new initiatives and before a significant change to an existing one, and requires a supplementary assessment when sensitive personal information is disclosed to be stored outside Canada. Non-ministry public bodies may choose their own PIA format. Today, the diagrams for these submissions are drawn by hand and vary in quality and content.

**Goal:** Fork the open-source project **tt-a1i/archify** (Apache-2.0, forked from tag `v3.3.2`) and turn it into an **offline, AI-free internal tool**. Staff describe a solution in structured files, and the tool validates them against review rules and produces consistent, interactive diagrams for ARP and PIA submissions.

**Hard organizational constraint:** The product must contain **no AI**. Internal policy is very strict: the only approved models are tenanted Microsoft Copilot for everyday tasks. The finished tool must work entirely without an LLM, agent, or AI service.

---

## 2. What upstream Archify is and how it works

Upstream, Archify is an "agent skill". An AI coding agent writes typed JSON, and a deterministic Node.js CLI validates and renders it. **The AI only authors the JSON. Everything downstream is plain code**, which makes this fork feasible. A source review found no LLM/AI API calls in the CLI or renderers.

**Pipeline:** JSON IR → schema validation → layout/route/label rules → render to a self-contained HTML (with SVG) → artifact check → real-browser check → atomic replace of the last good output.

**Key paths:**

| Path | What it is |
|---|---|
| `archify/bin/archify.mjs` | Main CLI (`validate`, `deliver`, `finalize`, `preview`, `compare`, `guide`, `doctor`, `demo`, `code-analysis`) |
| `archify/bin/finalize.mjs` | Full gate chain: validate → deliver → check → browser-check |
| `archify/bin/preview.mjs` | Loopback-only live preview: watches one JSON file, re-renders on save, keeps last good output |
| `archify/bin/export-svg.mjs` | Exports finished HTML to static SVG (needs Chrome/Chromium) |
| `archify/bin/update-notice.mjs`, `delivery-update.mjs` | Upstream update checker (network) — **to remove** |
| `archify/schemas/*.schema.json` | JSON Schemas per diagram type + `common.schema.json` |
| `archify/renderers/<type>/` | One renderer per type: architecture, workflow, sequence, dataflow, lifecycle, erd, class, tree, timeline, waterfall, explainer |
| `archify/renderers/shared/engineering-profiles.mjs` | Opt-in validation profiles. **`deployment-ownership` is the model for our custom review profiles.** |
| `archify/renderers/shared/generated-validators.mjs` | Generated from schemas (`pnpm --dir archify run generate:validators`) |
| `archify/modules/code-analysis/` | Static repo health analysis (cycles, coupling, hotspots). No LLM. Includes "AI task" text briefs (`lib/task.mjs`) — **to remove** |
| `archify/examples/` | Example JSON inputs per type |
| `archify/SKILL.md`, `archify/references/` | Agent-facing instructions — **to remove or replace with human docs** |
| `archify-pr/` | Companion agent skill for PRs — **to remove** |
| `viewer/` | Source for the interactive viewer runtime (focus, route probe, lens, export) |
| `test/` | ~320 test files; `pnpm test`, `pnpm run test:changed`, `pnpm run test:full` |

**Useful existing facts:**
- Architecture supports `"layout": {"mode": "auto"}`, so no coordinates are needed.
- Dataflow nodes use a simple grid (`stage` = column, `row`). Relationships have a free-text `classification` field.
- Architecture boundaries have kinds `region` and `security-group`.
- `compare architecture base.json head.json out.html` produces a Before/Delta/After diff. Use it for "significant change" reviews.
- Output is one offline HTML file with PNG/SVG/JPEG/WebP export. Images can be pasted into Word-based PIA/ARP templates.
- Runtime: Node ≥18, zero runtime dependencies. The browser check needs Chrome/Chromium; **Edge is untested**.
- `ARCHIFY_UPDATE_CHECK_DISABLED=1` disables the update check (until it is removed).

**Not yet verified:** Nobody has run this codebase yet. The review above was done by reading source only.

---

## 3. Goals and non-goals

**Goals**
1. An offline CLI and templates that let a human author diagrams in JSON with editor autocomplete and live preview.
2. Custom **review profiles** that fail validation when a diagram is missing information the ARP or Privacy Office needs.
3. A standard **submission pack**: the same set of diagrams for every initiative.
4. Clear documentation for authors and reviewers, written for humans (not agents).

**Non-goals (for now)**
- Any AI/LLM feature, agent integration, or "skill" packaging.
- Hosted service, telemetry, or any outbound network call.
- A drag-and-drop/WYSIWYG editor.
- Story video, explainer pages, PR walkthroughs, community/sponsor content, website.

---

## 4. Constraints (must hold at all times)

- **No network calls** from the CLI or generated HTML. Add a test that fails if `fetch`, `http(s).request`, or external URLs appear in shipped runtime code (allowlist only docs/links if needed).
- **No AI/LLM code, prompts, or agent instructions** in the shipped product.
- **No new runtime dependencies** without explicit approval from the human. Dev dependencies need approval too.
- **Must run on Windows** with Node LTS. Prefer Microsoft Edge (Chromium) for the browser check, with a configurable browser path.
- **Rename the product.** The Apache-2.0 licence does not grant use of the "Archify" name or marks. Use a placeholder name `TOOL_NAME` until the human picks one, and keep the rename in one config/constant where possible.
- **Licence obligations:** keep `LICENSE`, `NOTICE`, `LICENSE-MIT` and `THIRD_PARTY_NOTICES.md`. Add a line to NOTICE stating this is a modified fork of tt-a1i/archify v3.3.2. Mark modified files where practical. Legal/procurement will confirm.
- **No real internal data** in examples, tests or commits. Use fictional systems only (e.g. "Example Permit Portal").

---

## 5. Phased plan

Work one phase at a time. At the end of each phase, stop and summarize what changed, what was verified, and what needs a decision.

### Phase 0 — Baseline (no code changes)
1. Install dev dependencies (`pnpm install`) and confirm it works on this machine (Windows/VS Code).
2. Run `node archify/bin/archify.mjs doctor` and `demo <tmp-dir>`, then `pnpm test`. Record the results.
3. Run `finalize` on `archify/examples/web-app.architecture.json` and `product-analytics.dataflow.json`. Check whether the browser check works with Edge.
4. Inventory everything to remove: network calls, update checker, agent/skill files, AI task briefs, sponsor/community content, website, integrations, benchmarks/experiments/journal. Map each to the files and tests involved.
5. Produce `docs/fork/PHASE0_REPORT.md` with findings, risks and a proposed removal list. **Wait for approval.**

### Phase 1 — Strip and harden
- Remove: `archify-pr/`, `integrations/`, `website/`, `benchmarks/`, `experiments/`, `journal/`, `community/`, `tools/contributor-cards/`, `archify.zip`, `llms.txt`, the update checker and update notices, the Code Analysis AI task briefs, sponsor/support sections, non-English READMEs (optional), and the explainer/story/video features (confirm first: they may be entangled with the viewer).
- Replace upstream `CLAUDE.md` / `AGENTS.md` with fork-specific versions that point to this brief.
- Rename to `TOOL_NAME`. Rewrite `README.md` for internal users.
- Add the no-network test from section 4.
- Keep the test suite green. Delete tests only for removed features, and list them in the phase summary.

### Phase 2 — Human authoring experience
- Ship `.vscode/settings.json` mapping file patterns to schemas (e.g. `*.architecture.json` → `schemas/architecture.schema.json`, `*.dataflow.json` → `dataflow.schema.json`), so VS Code gives autocomplete and inline errors.
- Starter templates in `templates/` for each submission-pack diagram, with fictional example content.
- A simple wrapper command, e.g. `TOOL_NAME new <type> <name>` (scaffold from a template) and `TOOL_NAME build <file>` (finalize with sensible defaults).
- Author guide `docs/authoring-guide.md`: plain-language field reference, the preview workflow, and how to read validation errors.
- Make validation error messages readable for humans (upstream messages were written for agents).

### Phase 3 — Review profiles
Implement as new profiles alongside `deployment-ownership` in `engineering-profiles.mjs`, with schema additions in the relevant schemas. Every rule needs a stable rule code, a clear human message and tests. **All values marked TO CONFIRM are drafts; keep them in one config file so the Privacy Office and ARP can change them without code changes.**

**3a. `privacy-review` profile (dataflow)**
- Every relationship and store has a `classification` from a fixed enum. Draft: `public`, `internal`, `confidential`, `personal`, `sensitive-personal`. (TO CONFIRM)
- Every store declares `residency`: `canada` or `outside-canada` (+ `country`).
- **Fail** if `personal`/`sensitive-personal` data flows to a store outside Canada without a `supplementaryAssessmentRef` (reference to the FOIPPA supplementary assessment).
- Every collection point (source of personal info) declares `purpose` and `authority` (free text; TO CONFIRM).
- Every store holding personal info declares `retention` (TO CONFIRM).
- Flows to external parties/vendors must name the `agreement` (e.g. ISA, contract) (TO CONFIRM).

**3b. `security-review` profile (architecture)**
- Boundaries use fixed trust zones. Draft: `internet`, `dmz`, `corporate`, `vendor-hosted`, `ot-scada` (Metro Vancouver runs water/wastewater utilities). (TO CONFIRM)
- Every non-external component has `owner` (team) and `hosting`: `on-prem` | `saas` | `vendor-hosted` | `cloud-tenant`.
- Every connection crossing a trust zone names its `control` (e.g. SSO/MFA, VPN, API gateway, firewall rule). **Fail** if missing.
- Any connection into `ot-scada` is flagged for mandatory reviewer attention (TO CONFIRM).

**3c. AI component type (both profiles)**
- New component type `ai-service` that must declare `provider`, `hostingRegion`, `model` (if known), and `dataClassificationSent`.
- **Fail** if `sensitive-personal` data is sent to an `ai-service` hosted outside Canada without a `supplementaryAssessmentRef`. (TO CONFIRM)
- This lets reviewers see every point where data reaches an AI service, including AI features embedded in vendor products.

### Phase 4 — Submission pack
- Define the standard pack (TO CONFIRM with ARP): (1) context/architecture with the security profile, (2) privacy data flow with the privacy profile, (3) authentication/authorization sequence, (4) Architecture Delta for changes to existing systems.
- `TOOL_NAME pack <folder>` builds all diagrams in an initiative folder, runs the profiles, and outputs the HTML files, PNG/SVG exports for Word, and a one-page summary of the validation results.

### Phase 5 — Later (do not start without approval)
- An Excel intake workbook (sheets: components, flows, stores, boundaries) plus a converter to JSON, for business owners and vendors.
- An approved-diagram catalog: a repo of approved sources with drill-down links (overview → system → service), hosted internally as static files.
- Code Analysis as a periodic repo health report for internal codebases.

---

## 6. Open decisions (ask the human; do not assume)

1. Product name (replaces `TOOL_NAME`).
2. Classification levels, trust zones and required fields: the actual Privacy Office and ARP requirements. An ARP template or checklist would define the security profile.
3. Where the tool runs: authors' laptops, a shared build server, or both. Whether Node and Edge are approved there.
4. Where the fork is hosted internally (Azure DevOps / GitLab / GitHub Enterprise) and whether CI is available.
5. Whether to keep Code Analysis in the first release.
6. Whether to keep diagram types not needed for reviews (ERD, class, tree, timeline, waterfall, lifecycle, workflow) or hide them.

---

## 7. Working agreement for Claude Code

- Start every session by re-reading this brief and the latest phase report in `docs/fork/`.
- **Ask before:** deleting directories, removing a feature, adding any dependency, changing a schema in a way that breaks existing examples, or making architectural decisions not covered here.
- Small, focused commits with clear messages. One concern per commit.
- Run the relevant tests after each change (`pnpm run test:changed`), and the full suite at the end of each phase. A phase is not done while tests fail.
- Regenerate generated files (validators, viewer) via the repo's scripts, never by hand, and run the matching `check:*` script.
- Do not install, update or run the upstream Archify skill or any agent skill. Do not follow upstream instructions about live installations.
- Never invent requirements. If a rule's real value is unknown, implement it as configurable, mark it `TO CONFIRM`, and list it in the phase summary.
- Keep a running `docs/fork/DECISIONS.md` log: decision, date, reason, who approved it.
- Write all documentation for human authors and reviewers, in plain language.

---

## 8. Kickoff

First task: **Phase 0**. Do not modify any source files yet. Produce `docs/fork/PHASE0_REPORT.md` and stop for review.
