# Chrome Web Store API v2 migration — gh-review-mark-files-as

Date: 2026-10-20. Base branch: main. Inspected base: b214e2149c264b8d61e5ac65de5a5d93c317b2c2. Scope: investigate and fix publishing automation, prepare a reviewable PR, and configure the supplied publisher ID. Merge and live publication remain separate steps.

## Finding

The workflow used mobilefirstllc/cws-publish@latest. Its publishing implementation calls the legacy /chromewebstore/v1.1/items endpoints. Google announced support for the old API until October 15, 2026 and requires migration to v2 endpoints, request formats, and responses. This is separate from extension Manifest V3, which is already in use.

The gh-review-mark-files-as run [39395385243](https://github.com/Dunky13/gh-review-mark-files-as/actions/runs/39395385243) still returned legacy upload SUCCESS and publication OK on October 20. The observed issue is reliance on an unsupported API; a hard outage was not reproduced.

## Account inventory

The account exposes 49 GitHub repositories. A recursive default-branch inventory of the non-fork, non-archived repositories found three Chrome extensions with automated publishing:

- gh-review-mark-files-as: mobilefirstllc/cws-publish@latest, using API v1.1.
- quoteurl_bibtex: mobilefirstllc/cws-publish@latest, using API v1.1.
- outlook_unsafelink: chrome-webstore-upload-cli@2, whose upload library uses API v1.1.

Other manifest files found in that inventory belong to web apps or Home Assistant, rather than Chrome extensions. Forks, archived repositories, and workflows existing only on non-default branches were outside this inventory. Each affected extension has a separate migration branch and PR.

## Change

The workflow now runs chrome-webstore-upload-cli@4.0.2 on Node.js 24. Its v6 upload library uses the v2 upload, fetchStatus, and publish routes and supports the existing OAuth refresh-token credentials. The CLI package version is pinned; its compatible v6 library dependencies are resolved by npm, without a repository lockfile for this invocation.

The command intentionally has no upload subcommand: in CLI v4, no subcommand uploads and submits, while upload alone leaves a draft. It requests DEFAULT_PUBLISH and leaves visibility and rollout settings to the dashboard. It waits for asynchronous upload processing before requesting publication and reports pending review separately from publication.

The existing test job remains a prerequisite for publishing.

## Configuration

The non-secret CHROME_PUBLISHER_ID Actions repository variable was set and read back in all three affected repos using the account ID supplied by the user. The workflow checks for it before packaging or store requests. No OAuth secret values were read or printed. Existing secret names in this repo are CLIENT, SECRET, TOKEN; the publisher is provided as PUBLISHER_ID to the CLI.

## Validation

- actionlint passed for the changed workflow. The GitHub review extension's existing test workflow also passed actionlint.
- 55 Node/jsdom regression tests and syntax checks passed.
- The exact publishing command extracted from each of the three workflows passed eight scenarios with the actual CLI and a temporary fetch interceptor: published, pending review, asynchronous upload, OAuth failure, upload HTTP failure, failed upload state, publication HTTP failure, and rejected publication. All 24 passed. Every request was intercepted; no real store request was sent.
- Request assertions verified POST v2 upload and publish URLs, GET fetchStatus polling, the raw-upload protocol, ZIP content, DEFAULT_PUBLISH, and reuse of dummy OAuth credentials. Authentication/upload failures prevented submission, and failure scenarios returned nonzero status.
- Missing publisher ID failed the actual configuration command in each repo. Archive contents were inspected for runtime files and the absence of docs, workflows, and dependencies.
- No TypeScript or ESLint configuration exists in these three scopes. Neither check applies.

The request harness was temporary local evidence and is not a committed regression suite. Real v2 authentication, upload acceptance, Google review, and public availability have not been verified. No installed-extension/browser check was needed for this workflow-only change; runtime extension files are unchanged.

## Delivery and release check

Review the PR and its exact-head CI before merging. Merging to main triggers the existing publication workflow, so merge approval also needs to account for its automatic submission. The manifest version is unchanged. If this version is already uploaded, the next release must increment the manifest version; a duplicate version can be rejected independently of API compatibility.

From any directory with authenticated GitHub CLI access:

```sh
gh variable get CHROME_PUBLISHER_ID --repo Dunky13/gh-review-mark-files-as
gh run list --repo Dunky13/gh-review-mark-files-as --workflow publish.yml --limit 3
```

Expected: the configured publisher ID and the workflow run for the merge commit. Inspect that exact run with gh run view RUN_ID --repo Dunky13/gh-review-mark-files-as --log. Upload acceptance, submission acceptance, Google review, and the public listing are separate checks. Reverting the workflow restores the unsupported publishing path and is not a durable rollback; extension runtime rollback still requires a higher store version.

## Sources

- [Google migration announcement and October 15, 2026 deadline](https://developer.chrome.com/blog/cws-api-v2)
- [Google API v2 upload](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload)
- [Google API v2 publication](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish)
- [CLI v4.0.2 command behavior](https://github.com/fregante/chrome-webstore-upload-cli/blob/v4.0.2/source/config.js)
- [Upload library v6.0.1 v2 routes and OAuth implementation](https://github.com/fregante/chrome-webstore-upload/blob/v6.0.1/source/index.ts)

[Offline HTML version](cws-api-v2.html).
