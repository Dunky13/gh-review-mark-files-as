# Delete-only and move-only review buttons

Release 1.3.0, prepared on 2026-10-23. Commit, push, PR, release, and publication are authorized. Hosted CI, merge, and store status must be verified separately.

Release PR: https://github.com/Dunky13/gh-review-mark-files-as/pull/11

## Configure a button

1. Open Settings and select Add button.
2. Name it Deletes and moves.
3. Set File changes to Delete-only and move-only.
4. Leave Include and Exclude blank to include every matching loaded file, then Save.

Delete-only and Move-only can also be selected separately. Existing buttons keep All changes. Each button retains its own include and exclude patterns, and both path and change filters must match.

## Behavior

Delete-only includes deleted files and edits that remove lines with no additions. Move-only includes renames and moves without content changes. Renames with edits do not qualify as move-only. The button retains the existing viewed, unviewed, and original mixed-selection cycle; overlapping buttons stay synchronized.

Classification reads GitHub's file-header summaries and dedicated status messages, rather than counting visible diff lines. Unknown change types stay untouched. Files without a reliable path, including ambiguous rename headings, stay untouched when path filters are active. Only loaded Viewed controls can be changed.

## Implementation

- settings.js validates and migrates the optional per-button changeType setting and compiles independent path and change filters.
- options.js, options.html, and options.css provide the labelled native selector, help text, persistence, and responsive layout.
- content.js reads classic and React file metadata and applies both filters before running the existing batch operation.
- README.md, CHROMEWEBSTORE.md, and PRIVACY.md describe the behavior and locally stored filter preference. Extension permissions are unchanged. The manifest version is 1.3.0.

## Verification

- pnpm test: 91 tests passed, none failed or skipped.
- JavaScript syntax checks and git diff --check passed. This package has no TypeScript or ESLint configuration.
- Regression coverage includes both files and changes routes, classic and React controls, deletion-only edits, deleted files, unchanged moves, renames with edits, missing metadata, exclusions, live settings changes, tri-state restoration, collapsed rename headers, and binary-size exclusions.
- Browser fixture: added a button, selected the combined filter, saved, reloaded, marked only the two eligible files among four, and unmarked them again.
- Settings visually inspected at 1000px and 390px widths; no horizontal overflow.
- T3 preview snapshots timed out twice. Browser verification used Playwright with Chrome after that failure. The HTTP-only demo supplies browser-extension API shims; it does not change shipped scripts.

Authenticated GitHub server persistence was not tested. Release 1.3.0 is prepared for the existing publishing workflow; store upload, review, and public availability are separate states.
