# Chrome Web Store listing

Last updated: 2026-10-23

## Store listing

Name: GitHub Pull Request Mark All Files as

Short description: Mark GitHub pull request files viewed or unviewed with custom buttons and file patterns.

Detailed description:

Mark GitHub pull request files as viewed or unviewed in a click.

Create named review buttons for tests, documentation, or any file patterns. Each button has its own include and exclude patterns. Other files keep their viewed state. Buttons stay in sync when their patterns overlap.

Filter each button by file changes: delete-only, move-only, or both. Delete-only includes removed files and lines with no additions. Move-only includes renames and moves without content changes. Combine change filters with path patterns or leave patterns blank to include every matching loaded file. Unknown change types stay untouched.

Open Settings from the extension icon or the pull request toolbar. Add patterns with individual fields and +/− controls, then select Save. Settings stay in this browser and apply across repositories.

Works on both Files changed layouts. Only files loaded on the page can be changed. Cycle matching files through viewed, unviewed, and their original selection when mixed.

Review tools also appear when you click through from GitHub notifications, the dashboard, or a repository to a pull request, without refreshing the page.

Keep review tools in the header, drag them freely around the window, or dock them in a chosen page container. Placement is saved locally and reused across pull requests. Docking confirmations disappear automatically. Review tools hide while a review dialog is open. If GitHub changes a saved container, controls remain available in a floating panel.

Support: https://github.com/Dunky13/gh-review-mark-files-as/issues

Category: Developer Tools

Single purpose: Control the viewed state of GitHub pull request files using configurable file patterns.

Language: English

## Permissions justification

- `storage`: Save review button names, include/exclude patterns, file change filters, and toolbar placement locally so users do not need to reconfigure them on each pull request.
- `https://github.com/**`: Read loaded file paths and Viewed controls on GitHub pull requests and operate those controls when the user selects a review button. Content scripts start on GitHub pages so they can follow in-place navigation from the dashboard, notifications, and repositories. Review tools and file-state processing are limited to pull request `/files` and `/changes` routes.

## Privacy and data use

Saved data consists of button IDs, names, include/exclude patterns, file change filters, and toolbar placement preferences in this browser. Pull request file paths, change summaries, and current viewed states are read transiently to select matching controls. The extension does not upload these settings or send telemetry, analytics, credentials, or repository contents to the developer or third parties. Viewed-state changes use GitHub's own controls and are handled by GitHub.

Data is not sold, used for unrelated purposes, or used for creditworthiness or lending. The extension has no remote executable code or external analytics dependency.

Privacy policy: https://github.com/Dunky13/gh-review-mark-files-as/blob/main/PRIVACY.md

## Developer and distribution

Publisher: Dunky13

Contact: info@developwent.io (verified from the current public listing)

Homepage: https://github.com/Dunky13/gh-review-mark-files-as

Distribution: Existing public listing; do not change regions or visibility as part of this release.

## Assets

Icons remain unchanged (`images/icon.128.png` is the store icon). Existing public screenshots show the original Mark All Files feature, which remains available. Future listing edits should also show the compact custom-button settings with individual pattern fields. The automated release uploads the extension package; it does not edit listing copy or screenshots.

The 1.1.2 compatibility update supplies its own button styling and a floating fallback panel. Refresh toolbar screenshots and include the fallback panel before updating the listing assets.

## Version history

- 1.3.0 — 2026-10-23: Add per-button delete-only, move-only, and combined change filters. Existing buttons retain All changes. Prepared for release and Chrome Web Store submission; publication status must be verified separately.

- 1.2.1 — 2026-10-22: Clear docking confirmations after five seconds and remember custom docking across pull requests. Preserve instructions and save errors. Verified in Chrome with the unpacked extension; publication status must be verified separately.

- 1.2.0 — 2026-10-22: Choose header placement, freely move the toolbar with a drag handle or arrow keys, and dock it in a page container. Save placement locally and hide tools during review dialogs. Prepared for automated publication; verify workflow and store status separately.

- 1.1.4 — 2026-10-20: Publishing verification release with a locked API v2 library, provider status reporting, duplicate-version checks, and read-only status mode. Extension runtime behavior is unchanged.

- 1.1.3 — 2026-10-20: Show review tools when opening a pull request through in-place navigation from another GitHub page. Prepared for the main-branch publishing workflow; verify its result and the public listing for publication status.
- 1.1.2 — 2026-10-19: Detect review progress using accessible text and ARIA metadata, preserve controls when the toolbar cannot be identified, and provide independent control styling. Prepared for submission; verify the release workflow and public listing for publication status.
- 1.1.1 — 2026-10-09: Recognize filenames in GitHub's current untitled diff-header links and explain zero-target buttons. Publication status must be verified from the release workflow and store.
- 1.1.0 — 2026-10-08: Configurable named buttons, include/exclude patterns, compact settings, individual pattern rows, and bounded wildcard matching. Prepared for submission by the main-branch publishing workflow; check the workflow and store for actual publication/review state.
- 1.0.5 — 2026-10-07: Compatibility with GitHub's redesigned pull request pages. Public listing confirmed at 1.0.5 before this release.

## Known limits

Only loaded files can be changed. Filters with active patterns leave files without an identifiable path untouched. Settings apply to every repository in this browser. Up to 20 buttons can be configured. Public store propagation and Google review are separate from upload/publish API acceptance.

## Publishing automation

The main-branch workflow uses Chrome Web Store API v2 through the locked `chrome-webstore-upload@6.0.1` library on Node.js 26.12.1. It retains the existing `CLIENT`, `SECRET`, and `TOKEN` repository secrets. The `CHROME_PUBLISHER_ID` repository variable must contain the publisher account ID from the Developer Dashboard, not the extension ID or display name. It is configured for this repository.

The tested `scripts/publish-cws.mjs` checks published/submitted versions, uploads, requests `DEFAULT_PUBLISH`, and fetches status again. `pnpm publish:cws --status` is read-only. The manually dispatched workflow defaults to status mode. Existing store visibility and rollout settings remain in effect. See the [migration handoff](docs/cws-api-v2.md) or its [offline HTML version](docs/cws-api-v2.html) for evidence and release checks.

Documentation-only pushes no longer trigger publication. Live provider evidence and pending review are recorded separately in the migration handoff.
