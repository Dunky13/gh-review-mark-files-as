# Release 1.1.3 handoff

Date: 2026-10-20. Branch: `dunky13/fix-github-soft-navigation`. Base: `0c7a430`.

Release candidate 1.1.3 fixes review tools missing after navigation from another GitHub page. The user authorized commit, push, PR, merge, and release. Local validation is complete; remote delivery must be verified against the PR head and resulting merge commit.

## Cause and change

The manifest injected scripts only on `https://github.com/**/pull/**`. A document opened on notifications, the dashboard, or a repository therefore had no content script to handle later navigation into a PR without a reload. Existing Turbo/PJAX handlers, DOM observation, and route polling could not run in those documents. Earlier tests injected scripts directly and missed the manifest gate.

The manifest now injects on `https://github.com/*`. The existing content-script route guard still limits review tools and file-state processing to PR `/files` and `/changes` pages. Host permissions remain unchanged. No external requests were added. README and store permission explanations reflect the broader startup scope.

Chrome documents the manifest injection rules in [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) and [Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).

## Verification

- Before the fix, manifest-aware notification-to-diff tests failed on both `/files` and `/changes` because the review tools never appeared.
- After the fix, all 55 tests passed. Fifteen new cases cover five non-PR starting pages on both diff routes, inactive review markup outside a diff route, and four excluded origins.
- Runtime scripts and the modified test file passed `node --check`; `git diff --check` passed. This JavaScript package uses neither TypeScript nor ESLint.
- Browser fixtures at 1280px and 375px reproduced the original failure and verified the fix. One toolbar appeared after navigation, the Tests button changed only its matching file, leaving the diff removed the toolbar, returning restored it, and the mobile All Files action updated both files without overflow or an alert.

The fixtures load real extension scripts using manifest-based gating, synthetic GitHub controls, and extension API stubs. The preview browser was signed out and had no installed extension. Installed-Chrome behavior and GitHub server persistence remain unverified. Remote checks and publication are separate delivery evidence. The supplied console summary alone does not establish an ad-blocker or CSP cause.

## Delivery

Merging to main triggers Publish Chrome Extension. It tests the merge commit, packages the runtime files and icons, uploads the ZIP artifact, and requests Chrome Web Store publication for `cdodhippkioagjgbchpljiboecdljklm`.

Verify the exact PR head's checks and review state before merging, then verify the workflow and artifact for the resulting merge commit. Upload acceptance, publication-request acceptance, Google review, and public availability are separate states. This handoff does not assert public availability. A rollback must restore the previous behavior under a new, higher manifest version; the store does not accept a version downgrade.

## Try this checkout

1. Open `chrome://extensions`, enable Developer mode, and disable the store copy temporarily.
2. Select Load unpacked and choose the repository folder containing `manifest.json`. If already loaded, select Reload on its card.
3. Open GitHub notifications or a repository in a fresh tab, then click through to a PR's Files changed tab. The review tools should appear without refreshing. Leaving Files changed should remove them; returning should restore one toolbar.

Validation commands from the repository root, using Node.js 24 and pnpm 11:

```sh
pnpm install --frozen-lockfile
node --check content.js
node --check settings.js
node --check options.js
node --check background.js
node --check tests/content.test.cjs
pnpm test
git diff --check
```

Expected: 55 passing tests, successful syntax checks, and no whitespace errors. See [the offline HTML version](release-1.1.3.html) for the same handoff.
