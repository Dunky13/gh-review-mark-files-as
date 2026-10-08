# PR #3 - Release 1.1.0 handoff

Pull request: https://github.com/Dunky13/gh-review-mark-files-as/pull/3

The approved change adds multiple named review buttons, each with include/exclude file patterns, and a compact Options page. Patterns use individual fields with +/− controls. Each button changes only matching loaded files and preserves the existing viewed/unviewed/original-mixed-selection cycle. Default settings retain All Files.

Settings are stored locally and applied to open pull requests. The extension icon, Chrome Options menu, and GitHub Settings button open the same page. Overlapping scopes stay synchronized and batches run sequentially. Settings changed during a batch apply to subsequent actions.

## Verification

31 Node/jsdom tests pass. Syntax checks cover all four scripts. Coverage includes classic and React controls on /files and /changes, asynchronous rerenders, navigation cancellation, acknowledgement failures, exclusions, restore behavior, overlapping buttons, live settings, row focus, and saving. Browser fixtures verified adding/removing/saving patterns and responsive layout; the local Chrome installation was loaded and its Settings page verified. These fixtures do not prove live GitHub server persistence.

Adversarial Standards and Spec reviews found a wildcard-backtracking slowdown and stale README labels. Both are fixed. Matching now scans each path once per pattern token, with regression coverage, and filters compile when settings change.

## Release path

The main-branch Publish Chrome Extension workflow runs tests, packages only runtime files and icons, uploads the ZIP artifact, then invokes Chrome Web Store upload/publish. Manifest version is 1.1.0. Confirm success on the exact merge commit and distinguish API acceptance from Google review/public propagation.

CHROMEWEBSTORE.md contains listing copy and permission justifications; PRIVACY.md documents local settings and ordinary GitHub viewed-state updates. The workflow updates the package, not listing copy or screenshots.

## Local installation

The user has an unpacked copy at ~/.local/share/browser-extensions/gh-review-mark-files-as, extension ID nljolmodahejifngfgbbjbhkelhionak. The public Web Store ID is cdodhippkioagjgbchpljiboecdljklm. Keep one copy enabled. Update the unpacked runtime files, reload its extension card when the manifest changes, and refresh PR pages. Reloading the unpacked extension does not publish a release.
