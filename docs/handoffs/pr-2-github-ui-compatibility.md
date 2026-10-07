# PR #2: GitHub Files changed compatibility handoff

Pull request: https://github.com/Dunky13/gh-review-mark-files-as/pull/2

The extension stopped appearing on GitHub's redesigned `/changes` page because initialization accepted only `/files` and required classic diff and toolbar markup. GitHub's Viewed controls also changed from native checkboxes to React buttons. URL-only initialization missed delayed page rendering.

Version 1.0.5 supports both routes and layouts, retries mounting after rendering and navigation, and restores original mixed selections using stable file identities. Batches reacquire React controls after each update and wait for the actual state change. Disabled or unacknowledged updates show an error. Navigation cancels the previous page's batch. A uniform initial selection toggles directly between all and none.

Only loaded Viewed controls are included. When the progress count indicates additional unloaded files, the label becomes **Mark Loaded Files**. The control is disabled while no file controls exist. Full support for virtualized or single-file views is outside this compatibility fix; users must load remaining files to include them.

## Verification

- Baseline: only 1 of the initial 8 regression tests passed; the other 7 failed before the fix.
- Final: 15 Node/jsdom tests pass, covering both layouts, route detection, delayed mounts, toolbar and button replacement, selection restoration, individual clicks, partial lists, failures, and navigation cancellation.
- `node --check content.js`, `git diff --check`, and actionlint pass.
- A Chromium fixture verifies all -> none -> original mixed selection while every Viewed button is replaced asynchronously.
- The fixed extension was installed in the user's native Chrome and tested on the authenticated Hikyo PR #858 `/changes` page. The control appeared and GitHub's progress changed 0 of 1 -> 1 of 1 -> 0 of 1. The initial unviewed state was restored. The installed Web Store copy was disabled to avoid duplicate content scripts.

## Delivery

The PR adds a reusable test workflow and makes publication wait for it. The package includes only `manifest.json`, `content.js`, `images`, and `LICENSE`. Merging `main` triggers the existing Chrome Web Store publishing workflow for version 1.0.5. No merge or publication is authorized by this handoff. Browser installation is a local unpacked copy; it does not establish Web Store publication.

Modern selectors are grounded in Refined GitHub's current `batch-mark-files-as-viewed.tsx` and `pr-jump-to-first-non-viewed-file.tsx` implementations and were subsequently verified through the live Chrome interaction above. If GitHub changes these components again, inspect the actual toolbar and Viewed controls before changing selectors.
