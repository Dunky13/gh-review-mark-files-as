# Release 1.1.2 handoff

GitHub's changed progress-indicator classes caused every extension control, including Settings, to disappear. The affected page still exposed seven Viewed buttons, but neither toolbar selector matched. A fixture with the captured markup reproduced the failure; the existing 34 tests used the older progress class.

## Resulting behavior

- Read accessible progress text or ARIA progress metadata, retaining compatibility with older layouts.
- Use Viewed/Not Viewed labels and aria-pressed when GitHub changes its generated button classes.
- Mount beside the progress indicator and Submit review, outside the progress-only wrapper hidden on narrow screens.
- Keep independently styled controls in a floating panel when no toolbar anchor is identifiable; move them back when the toolbar returns.
- Use Mark Loaded Files when the total is unknown, and read filenames from the file region's labelled heading even if its header wrapper changes.
- Preserve pattern scopes, mixed-state restoration, sequential updates, navigation cleanup, and safeguards against treating diff contents as toolbar controls.

## Validation

All 40 Node/jsdom tests passed, including six new regression cases. The new captured-markup and missing-anchor tests failed before the implementation change. All four runtime-script syntax checks and git diff --check passed.

A browser fixture using the actual runtime scripts was checked at 1280px and 375px. Filtered clicks changed only matching files. Controls remained visible when the progress-only wrapper was hidden, survived removal of the toolbar in a floating panel, and returned to the restored toolbar without duplicate controls or lost file states. Both layouts stayed within the viewport.

The fixture simulates GitHub state acknowledgements and extension storage. The extension was not installed in that browser; real authenticated GitHub persistence and installed-Chrome behavior remain unverified.

## Delivery

The manifest version is 1.1.2. Merging to main triggers Publish Chrome Extension: it tests the merge commit, packages the runtime files and icons, uploads the ZIP artifact, and requests Chrome Web Store publication for cdodhippkioagjgbchpljiboecdljklm.

Verify the PR head's checks and review state before merging, then verify the workflow for the resulting merge commit. Package upload, publication-request acceptance, Google review, and public availability are separate states. This handoff does not assert public availability.

To validate an unpacked copy, follow README.md's local-install steps, reload the extension, refresh a GitHub Files changed page, and verify the named scopes and Settings entry point. To roll back a published version, restore the previous runtime behavior and publish a new, higher manifest version; the store does not accept a version downgrade.
