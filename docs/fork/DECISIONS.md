# Decisions log

Each entry records a decision, when it was made, why, and who approved it. Add new entries at the bottom.

| # | Date | Decision | Reason | Approved by |
|---|---|---|---|---|
| 1 | 2026-11-25 | Git commands are allowed in this repository. | It is a live Git fork, and the working agreement depends on commits and PRs. | Project owner |
| 2 | 2026-11-25 | All enhancements and refactors happen on feature branches and merge into `main` on the fork (`blui/archify`) through PRs. Nobody commits directly to `main`. | Keeps every change reviewable. PRs target the fork, never upstream `tt-a1i/archify`. | Project owner |
| 3 | 2026-11-25 | pnpm 12.21.0, the version pinned in `package.json`, is installed globally with `npm install --global --allow-scripts=pnpm pnpm@12.21.0`. | CONTRIBUTING.md documents this method. pnpm needs its install script, or nested `pnpm run` calls fail on Windows. | Project owner |
| 4 | 2026-11-25 | The project brief is stored at `docs/fork/PROJECT_BRIEF.md`, and phase reports go next to it. | The brief is the fork's source of truth, so it must live in the repository. | Project owner |
