# Phase 0 report: baseline

Date: 2026-11-26
Branch: `fork/phase0` (from `main` at `d6b0f71f`)
Status: waiting for review. Phase 1 does not start until you approve the removal list in section 5 and answer the questions in section 7.

Phase 0 changed no source files. The only repository changes are three new files in `docs/fork/`: this report, `PROJECT_BRIEF.md` and `DECISIONS.md`.

## 1. Summary

The codebase installs and runs on this Windows machine. The core renderers work fully offline, and Microsoft Edge works for the browser check without any configuration. The upstream test suites do not pass cleanly on Windows, but every failure traces to one of four causes: features we plan to remove, Windows symlink permissions, missing language toolchains for Code Analysis, or Windows path separators in test harness tests. None of the failures point at the diagram renderers.

The removal work is larger than the brief suggests. Story, explainer and PR features are wired into the core CLI, the SVG export depends on a parser that lives inside the story folder, and the update checker is called on every `deliver` and `finalize`. Each needs careful unhooking, not just directory deletion.

## 2. Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26300 |
| Node | 24.21.0 (repository requires 18 or later) |
| npm | 12.1.0 |
| pnpm | 12.21.0, installed globally for this work (see DECISIONS.md #3) |
| Browser | Microsoft Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Chrome is not installed. |
| Not installed | GitHub CLI (`gh`), Go, Rust/Cargo, Python, JDK |

All runs used `ARCHIFY_UPDATE_CHECK_DISABLED=1` so that nothing contacted upstream.

## 3. Baseline results

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | Pass. 36 packages, 7.8 s. The first global pnpm install needed `--allow-scripts=pnpm`, otherwise nested `pnpm run` calls fail with "not recognized as an internal or external command". |
| Doctor | `node archify/bin/archify.mjs doctor` | Pass. All 28 checks ok. |
| Demo | `node archify/bin/archify.mjs demo <dir>` | Pass. Wrote `archify-demo.html`. |
| Core tests | `pnpm test` | Pass. 19 of 19. This is only the core smoke test, not the full suite. |
| Generated files | `test:generated` (viewer, brand marks, validators, release identity, golden renders) | Pass. |
| Code Analysis tests | `pnpm --dir archify/modules/code-analysis test` | Fail. 930 tests: 755 pass, 138 fail, 37 skipped. Almost every failure reports missing Go, Rust, Python or JDK tooling. |
| Full suite | `pnpm run test:full` | Fail. It stops at the Code Analysis step, so the main suite never runs from this command. |
| Main suite | `node scripts/run-tests.mjs` | Fail. 315 files, 4,185 tests: 3,809 pass, 96 fail, 280 skipped. 65 minutes, because `update-notifier.test.mjs` hung for about an hour and had to be stopped by hand. |
| Browser suite | `node scripts/run-browser-tests.mjs` with `ARCHIFY_CHROME` set to Edge | Fail, 1 test. 65 files, 425 tests: 423 pass, 1 fail, 1 skipped (MP4 check, needs `ARCHIFY_FFMPEG`). 9 minutes. See 4.1. |
| Finalize, dataflow | `finalize dataflow product-analytics.dataflow.json --browser-check` | Pass. All four gates, 6 s, using Edge. |
| Finalize, architecture | `finalize architecture web-app.architecture.json --browser-check` | First run failed, then passed twice in isolation (about 4 s each). See 4.1. |

### 3.1 Main suite failures by cause

| Cause | Tests | Files | Action |
|---|---|---|---|
| Update checker | 49 | `update-notifier`, `delivery-update`, `update-notice`, `release-package-gates` | Removed with the feature in Phase 1. Some failures happen only because the check was disabled for this run. |
| Symlinks need Developer Mode or admin rights on Windows (`EPERM`) | about 24 | `output-path`, `meta-output-contract`, `workflow-migration`, `preview`, `i18n`, three `explainer-*` files | Skip symlink cases when the OS refuses symlinks, or enable Developer Mode on test machines. Decision needed. |
| Test harness expects `/` but Windows produces `\` | 9 | `repository-test-runner`, `browser-gate` | Fix the test expectations. Upstream bug, harmless to the product. |
| PR features | 8 | `pr-preflight`, `integrate-pr-zip`, `pr-pack` | Removed with the feature in Phase 1. |
| Environment specific | 6 | `visual-check` (a staging folder left behind after one cleanup failure), `delivery-sidecar-path` (8.3 short names are off on drive D) | Investigate in Phase 1. Likely test isolation, not product bugs. |

## 4. Findings

### 4.1 Edge works for the browser check

Upstream already searches for Edge on Windows after Chrome, and `ARCHIFY_CHROME` overrides the path. The browser check and `export-svg` share the same lookup, so the brief's "configurable browser path" requirement already exists. Phase 1 only needs to rename the variable and document it.

One risk: the first architecture finalize failed with `viewer/temp-cleanup-incomplete` ("Chrome did not exit") while the test suite was also launching browsers. It left a 100 MB temporary Edge profile in `%TEMP%`, which I deleted afterwards. Isolated reruns passed. Running several browser checks at once on one machine could hit this again, which matters if a shared build server runs packs in parallel.

The browser suite passed 423 of 425 tests on Edge. The one failure is in `export-filename-browser.test.mjs`. The test exports a diagram with a Korean title twice and expects one dark SVG file. Edge left an extra `결제-light.svg` from the light export in the same download folder. This looks like a difference in how Edge handles repeated downloads, not a rendering problem. Phase 1 should check whether Word users would ever see a wrong file name from this.

### 4.2 Network calls

| Location | What it does | When it runs | Plan |
|---|---|---|---|
| `archify/scripts/check-update.mjs`, `update-contract.mjs`, `delivery-update-child.mjs`, `bin/delivery-update.mjs`, `bin/update-notice.mjs` | Fetches `https://tt-a1i.github.io/archify/skill-updates/archify/stable.json` in a background child process | Every `deliver` and `finalize` unless disabled | Remove. The call goes through an injected `fetchImpl(...)`, so the no-network test must catch indirect calls, not only the literal `fetch(`. |
| `archify/renderers/shared/brand-marks.mjs` | Fetches a website's favicon over HTTP(S) | On every render of a node whose `brand` is a URL object, and on `brands capture` | Remove the remote path. Built-in brand IDs keep working offline. |
| `archify/modules/code-analysis/lib/pull-request.mjs` | Calls `api.github.com` and clones from `github.com` | `code-analysis import-review` and `start --pr` | Remove with the PR features. |
| `archify/bin/preview.mjs`, `modules/code-analysis/bin/serve.mjs` | Local HTTP server bound to `127.0.0.1` | `preview`, `code-analysis serve` | Keep. Loopback only, no outbound traffic. The no-network test needs an allowlist entry for loopback servers. |

Generated HTML makes no network calls. It has no `fetch`, `XMLHttpRequest`, beacons, or remote scripts, styles or fonts. It does contain clickable links to `github.com/tt-a1i/archify` (a credit link, a feedback menu and a GitHub star button) and embedded licence and brand provenance text with external URLs. Those links leave the page only when someone clicks them, but they name upstream and must go as part of the rename.

### 4.3 AI and agent content

The renderers and schemas contain no AI code or prompts. Agent material sits in these places:

- `archify/SKILL.md`, `archify/references/` (11 files), `archify/skill-release.json`, `.agents/` (24 files), `AGENTS.md`, `CLAUDE.md`, both `llms.txt` files and `archify.zip`.
- `archify/bin/update-notice.mjs` holds update prompts written for an agent, in five languages.
- `archify/modules/code-analysis/lib/task.mjs`, `task-command.mjs`, `task-id.mjs`, `bin/task.mjs` and the `/task` endpoint in `bin/serve.mjs` produce AI task briefs. `pull-request-impact.mjs` and `overlay/inject.mjs` also import them.
- Many CLI error messages and `supportedFixes` hints are written for an agent. Phase 2 rewrites them.
- `doctor` checks that the agent references exist ("Progressive authoring references", "Scenario recipe guide"). Removing the references breaks `doctor` unless the checks go too.

The built-in brand catalog includes logos for AI products (Claude, ChatGPT and others). It is image data, not AI code. It could label `ai-service` components in Phase 3, so I suggest keeping it.

### 4.4 Coupling that makes removal harder

| Feature | Where the core depends on it |
|---|---|
| Story | `renderers/shared/svg-bake.mjs` imports `story/vendor/html-parser.mjs`, and SVG export relies on it. The parser must move to `renderers/shared/` before `archify/story/` can go. `archify.mjs` dispatches `story` commands. |
| Explainer | `finalize.mjs` imports `explainer/prepare.mjs` at the top level and branches on `type === 'explainer'` in about ten places. `scripts/check-render-output.mjs` imports `explainer/check.mjs`. `archify.mjs` lazy-loads explainer modules in about ten places. Explainer is also a registered diagram type in `doctor` and the core smoke test. |
| PR walkthrough | `archify/pr/` (11 files) is separate from `archify-pr/` (the agent skill) and is dispatched from `archify.mjs`. |
| Update checker | Called from `deliver` and `finalize`, and its result is written into delivery receipts. |
| Code Analysis | The `start` and `code-analysis` commands, the `task` and `serve` code paths, and 12 test files. It is 342 files (17 MB) with vendored parsers. |

`archify/bin/archify.mjs` is 7,487 lines, and most of this wiring lives there. Removal will be several focused commits, not one.

### 4.5 Review profiles (input for Phase 3)

`engineering-profiles.mjs` is 157 lines and easy to follow. It has one hard-coded profile, `deployment-ownership`, selected through `meta.engineering_profile`. That field exists only in `architecture.schema.json`. The dataflow schema has no profile hook, so the `privacy-review` profile needs a new `meta` field in the dataflow schema, then regenerated validators. The current profile stores the owner in the free-text `tag` field. Our profiles should use named fields instead.

### 4.6 GitHub Actions on the fork

`.github/workflows/` has six workflows. `ci.yml` runs on every pull request and on pushes to `main`. `star-history.yml` and `contributors.yml` run on a weekly schedule and publish upstream community data. `release.yml` runs on version tags. I could not check whether Actions is enabled on `blui/archify` because `gh` is not installed.

## 5. Proposed removal list

Test counts are the files in `test/` that belong only to that feature. Removal happens in Phase 1, one concern per commit, each followed by `pnpm run test:changed`.

| # | Item | Size | Tests involved | Risk |
|---|---|---|---|---|
| 1 | `archify-pr/` agent skill | 4 files | `pr-*` tests (6 files) together with item 2 | Low |
| 2 | `archify/pr/` PR walkthrough command and Code Analysis PR import | 11 files plus `lib/pull-request*.mjs` | Shared with item 1 | Medium. Unhook from `archify.mjs`. |
| 3 | Update checker and update notices | 5 runtime files | 7 files (`update-*`, `delivery-update`, `stable-update-manifest`, `release-package-gates`) | Medium. Touches `deliver`, `finalize` and receipt fields. |
| 4 | Remote brand capture (keep built-in brands) | Part of `brand-marks.mjs` and the `brands capture` command | Part of 7 `brand-*` files | Low to medium |
| 5 | Code Analysis AI task briefs | 4 lib/bin files plus the `/task` endpoint | `code-analysis-task-browser` and parts of others | Medium. Depends on the answer to open decision 5. |
| 6 | Story and video | `archify/story/` (27 files) | 5 files (`story*`, `webm-artifact.smoke`) | Medium. Move the HTML parser first. |
| 7 | Explainer | `archify/explainer/` and `renderers/explainer/` | About 20 `explainer-*` files. The `reader-*` files test the core viewer and stay. | High. Most entangled feature. |
| 8 | Agent files | `archify/SKILL.md`, `archify/references/`, `archify/skill-release.json`, `.agents/`, `llms.txt`, `docs/llms.txt`, `archify.zip` (5.5 MB, tracked in Git) | `skill-*`, `llms-txt`, `clean-skill-staging`, `community-packages` and others | Medium. `doctor` checks some of these. |
| 9 | `integrations/` | 29 files | 5 test or script files reference it, and `dsh.yml` | Low |
| 10 | `website/` | 122 files | 4 files (`gallery`, `site-language-*`, `copy-site-assets`) | Low |
| 11 | `benchmarks/`, `experiments/`, `journal/` | 349 files, 13 MB | No test files of their own. 10 test or script files read benchmark data. | Low to medium |
| 12 | `community/`, `tools/contributor-cards/` | 21 files, 3.3 MB | `community-packages` and a few others | Low |
| 13 | Upstream links, sponsor and star content | All five READMEs, viewer feedback menu, credit link | Viewer and golden render tests will need regenerated output | Medium |
| 14 | Non-English READMEs (optional per the brief) | 4 files | 15 test or script files reference README names | Low |
| 15 | Upstream-only workflows | `star-history.yml`, `contributors.yml`, `contributor-cards.yml`, `dsh.yml`, `release.yml` | None | Low |
| 16 | Upstream docs in `docs/` (articles, research, evidence, gallery, releases) | 269 files, 47 MB | Some tests read `docs/` evidence | Medium. Needs a per-folder pass. |
| 17 | Top-level `examples/` (rendered upstream demos) | 35 files, 26 MB | Golden tests read `archify/examples/`, which stays. Top-level use is unclear. | Low to medium |

Items 16 and 17 are not in the brief. I list them because they are large and none of the content belongs in an internal tool. I will not touch them without your approval.

## 6. Risks

1. Unhooking explainer and story from a 7,487-line CLI could break core commands in ways the core smoke test does not catch. Mitigation: run the main suite and the browser suite after each removal commit, not just `test:changed`.
2. Upstream's suite does not pass on Windows today. Until symlink, path separator and update tests are dealt with, "keep the suite green" has no clean baseline. I propose that Phase 1 starts by recording the 96 known failures, then shrinks the list. No new failure is allowed.
3. The full main suite takes about 15 to 20 minutes on this machine without the hang. Running it after every commit is slow, so I suggest `test:changed` per commit and the full suite at each phase end, as the brief says.
4. Golden render tests compare against checked-in output. Removing upstream links from the viewer changes every rendered file, so those goldens get regenerated through the repository script.
5. Running several browser checks at once can leave Edge processes and temporary profiles behind (4.1).
6. Without `gh` I cannot open PRs from here. Either install the GitHub CLI or open PRs in the browser.

## 7. Questions before Phase 1

1. Do you approve the removal list in section 5? Specifically, items 16 and 17 (upstream docs and top-level examples), which are not in the brief.
2. Code Analysis: keep it for later (open decision 5) and remove only the AI task briefs and PR import, or remove the whole module now? Removing it cuts 17 MB and 138 toolchain-dependent test failures.
3. Windows symlink tests: should I make them skip when the OS refuses symlinks, or will test machines have Developer Mode on?
4. May I install the GitHub CLI (`winget install GitHub.cli`), or will you open PRs yourself?
5. Should I disable the upstream-only GitHub Actions workflows now, so that pushing this branch does not trigger them?
