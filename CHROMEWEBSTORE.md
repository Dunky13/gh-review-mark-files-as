# Chrome Web Store listing

Last updated: 2026-10-09

## Store listing

Name: GitHub Pull Request Mark All Files as

Short description: Mark GitHub pull request files viewed or unviewed with custom buttons and file patterns.

Detailed description:

Mark GitHub pull request files as viewed or unviewed in a click.

Create named review buttons for tests, documentation, or any file patterns. Each button has its own include and exclude patterns. Other files keep their viewed state. Buttons stay in sync when their patterns overlap.

Open Settings from the extension icon or the pull request toolbar. Add patterns with individual fields and +/− controls, then select Save. Settings stay in this browser and apply across repositories.

Works on both Files changed layouts. Only files loaded on the page can be changed. Cycle matching files through viewed, unviewed, and their original selection when mixed.

Support: https://github.com/Dunky13/gh-review-mark-files-as/issues

Category: Developer Tools

Single purpose: Control the viewed state of GitHub pull request files using configurable file patterns.

Language: English

## Permissions justification

- `storage`: Save review button names and include/exclude patterns locally so users do not need to reconfigure them on each pull request.
- `https://github.com/**`: Read loaded file paths and Viewed controls on GitHub pull requests and operate those controls when the user selects a review button. Content scripts are restricted to GitHub pull request pages.

## Privacy and data use

Saved data consists of button IDs, names, and include/exclude patterns in this browser. Pull request file paths and current viewed states are read transiently to select matching controls. The extension does not upload these settings or send telemetry, analytics, credentials, or repository contents to the developer or third parties. Viewed-state changes use GitHub's own controls and are handled by GitHub.

Data is not sold, used for unrelated purposes, or used for creditworthiness or lending. The extension has no remote executable code or external analytics dependency.

Privacy policy: https://github.com/Dunky13/gh-review-mark-files-as/blob/main/PRIVACY.md

## Developer and distribution

Publisher: Dunky13

Contact: info@developwent.io (verified from the current public listing)

Homepage: https://github.com/Dunky13/gh-review-mark-files-as

Distribution: Existing public listing; do not change regions or visibility as part of this release.

## Assets

Icons remain unchanged (`images/icon.128.png` is the store icon). Existing public screenshots show the original Mark All Files feature, which remains available. Future listing edits should also show the compact custom-button settings with individual pattern fields. The automated release uploads the extension package; it does not edit listing copy or screenshots.

## Version history

- 1.1.1 — 2026-10-09: Recognize filenames in GitHub's current untitled diff-header links and explain zero-target buttons. Publication status must be verified from the release workflow and store.
- 1.1.0 — 2026-10-08: Configurable named buttons, include/exclude patterns, compact settings, individual pattern rows, and bounded wildcard matching. Prepared for submission by the main-branch publishing workflow; check the workflow and store for actual publication/review state.
- 1.0.5 — 2026-10-07: Compatibility with GitHub's redesigned pull request pages. Public listing confirmed at 1.0.5 before this release.

## Known limits

Only loaded files can be changed. Filters with active patterns leave files without an identifiable path untouched. Settings apply to every repository in this browser. Up to 20 buttons can be configured. Public store propagation and Google review are separate from upload/publish API acceptance.
