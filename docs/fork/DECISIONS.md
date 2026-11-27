# Decisions log

Each entry records a decision, when it was made, why, and who approved it. Add new entries at the bottom.

| # | Date | Decision | Reason | Approved by |
|---|---|---|---|---|
| 1 | 2026-11-25 | Git commands are allowed in this repository. | It is a live Git fork, and the working agreement depends on commits and PRs. | Project owner |
| 2 | 2026-11-25 | All enhancements and refactors happen on feature branches and merge into `main` on the fork (`blui/archify`) through PRs. Nobody commits directly to `main`. | Keeps every change reviewable. PRs target the fork, never upstream `tt-a1i/archify`. | Project owner |
| 3 | 2026-11-25 | pnpm 12.21.0, the version pinned in `package.json`, is installed globally with `npm install --global --allow-scripts=pnpm pnpm@12.21.0`. | CONTRIBUTING.md documents this method. pnpm needs its install script, or nested `pnpm run` calls fail on Windows. | Project owner |
| 4 | 2026-11-25 | The project brief is stored at `docs/fork/PROJECT_BRIEF.md`, and phase reports go next to it. | The brief is the fork's source of truth, so it must live in the repository. | Project owner |
| 5 | 2026-11-26 | The Phase 1 removal list in `PHASE0_REPORT.md` section 5 is approved in full, including upstream `docs/` content and top-level `examples/`. | None of it belongs in an internal, offline, AI-free tool. | Project owner |
| 6 | 2026-11-26 | Code Analysis stays, provided every AI feature is removed from it. That covers AI task briefs, agent handoff text, "Copy for AI" actions, AI review imports and the GitHub PR import. | Static repo health analysis is useful on its own and uses no AI. | Project owner |
| 7 | 2026-11-26 | Tests assume a locked-down Windows machine. Tests that create symlinks are skipped by default and run only when a toggle environment variable is set. | Staff machines will not have Developer Mode or admin rights. | Project owner |
| 8 | 2026-11-26 | The project owner opens and merges PRs in the browser. The GitHub CLI is not installed. | Keeps the toolchain small. | Project owner |
| 9 | 2026-11-26 | Upstream-only GitHub Actions workflows are disabled. | They publish upstream community data or target upstream infrastructure. | Project owner |
| 10 | 2026-11-26 | Upstream `ci.yml`, `release.yml` and the shared setup action are removed, and the fork has no CI for now. CI comes back once internal hosting is decided (open decision 4). | Most of the upstream pipeline deploys or releases features this fork removes. Local test runs carry verification until then. | Project owner |
| 11 | 2026-11-26 | Story and its WebM video export are removed. The viewer keeps its own in-browser WebM export, and the shared HTML parser moves to `renderers/shared/vendor/`. | Story existed for presentation video, which the fork does not need. The SVG baker still uses the parser. | Project owner |
| 12 | 2026-11-26 | The explainer document type is removed, along with the `patch` command and the `--writing` option. Diagram browser checks stay in `bin/visual-check.mjs`. | Explainer pages are outside the fork's scope, and the checks they had were specific to explainer pages. | Project owner |
| 13 | 2026-11-27 | Code Analysis keeps the offline comparison of two local commits (`--base` and `--head`) and its impact view. Only the GitHub path (`--pr`, `--repository` and the API fetch) is removed. | The local comparison makes no network calls and uses no AI. | Project owner |
| 14 | 2026-11-27 | The Code Analysis question tool (`explain`, `task --question` and the change-question brief) is removed. The call and reference readers the impact view needs move into a module the impact view owns. Test cases for the deleted tool are dropped, and language tests switch to the kept readers where they can. | The question tool only prepared input for an agent. The impact view still needs the readers. | Project owner |
