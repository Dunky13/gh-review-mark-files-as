# Live Chrome Web Store publication — gh-review-mark-files-as

Date: 2026-10-20. Scope: merge the migration, repair publication failures, and verify the update through the real provider. The user authorised merge when CI permits and the necessary publishing fixes.

## Current evidence

The [migration PR #7](https://github.com/Dunky13/gh-review-mark-files-as/pull/7) merged after its exact-head CI passed. The [first live v2 publication run](https://github.com/Dunky13/gh-review-mark-files-as/actions/runs/39424090523) failed. Authentication succeeded, but Google rejected the uploaded package as invalid. The CLI omitted the additional provider details. Version 1.1.3 had already been uploaded earlier that day; the follow-up prepares 1.1.4 and makes duplicate/version failures explicit.

The same account inventory found three affected extensions. All three original migration PRs are merged:

- [GitHub review buttons #7](https://github.com/Dunky13/gh-review-mark-files-as/pull/7)
- [QuoteURL Bibtex #1](https://github.com/Dunky13/quoteurl_bibtex/pull/1)
- [Outlook Un-Safelink #6](https://github.com/Dunky13/outlook_unsafelink/pull/6)

Before release repair, live browser reads showed QuoteURL 0.0.7 and Outlook 0.2.1. The first v2 publication runs failed, so CI success on the PRs was not publication proof. The user then authorised merge when CI allows and live update/publication validation, including necessary fixes.

## Publishing repair

The publisher now calls the locked chrome-webstore-upload 6.0.1 library from scripts/publish-cws.mjs. Credentials continue to come from the existing GitHub Actions secret names. No new authentication protocol or credential store was introduced.

The script authenticates, reads published and submitted versions, and rejects duplicate release versions before uploading. It waits for asynchronous processing, requires a successful upload and matching reported version, and then requests DEFAULT_PUBLISH without changing visibility or rollout settings. Only PUBLISHED and PENDING_REVIEW are accepted submission states; rejected or cancelled submissions fail. It reads status again after submission and writes the provider result to the Actions summary. Provider field-violation details are displayed without dumping request objects or credentials.

The manual workflow defaults to status mode, which authenticates and fetches status without uploading or submitting. Pull requests continue to build and test without store credentials. Documentation-only pushes no longer attempt publication.

The prepared release version is 1.1.4. GitHub review buttons and QuoteURL use explicit manifest versions; Outlook preserves its existing generated run-number scheme. Extension runtime behavior is unchanged.

## Validation

- 69 automated tests pass in this repository. Fourteen publishing tests exercise the actual v2 library with intercepted requests, including read-only status, normal publication, pending review, async uploads, duplicate published/submitted versions, auth failures, upload failures, wrong uploaded version, HTTP failures, rejected/cancelled publication, and provider diagnostics.
- Node.js syntax checks and git diff --check pass. No TypeScript or ESLint configuration applies to these JavaScript scopes.
- actionlint passes for all three updated workflows.
- Extension packaging retains explicit runtime-file allowlists. New scripts, dependencies, tests, and reports stay outside the uploaded ZIP.
- A temporary credential-renewal wizard was provided in chat. Hidden inputs write directly to the two sibling repositories' GitHub secret stores. Its bash syntax and shellcheck validation pass; no credential values are saved to the report or repository.

These checks validate the repair locally. The initial live failures remain evidence of unsuccessful publication until a subsequent authenticated run accepts the new version. Google review, published API state, public listing metadata, and the downloadable update are distinct evidence.

## Operator checks

From an authenticated GitHub CLI session, request a read-only provider check:

```sh
gh workflow run publish.yml --repo Dunky13/gh-review-mark-files-as --ref main -f mode=status
gh run list --repo Dunky13/gh-review-mark-files-as --workflow publish.yml --limit 3
```

Expected: a successful status run showing the published/submitted version and state. To submit the prepared release after credentials are valid, the same workflow supports mode=publish. Merging a runtime or publishing change to main also triggers publication. Before retrying a successful or pending submission, check status rather than repeatedly re-uploading the same version.

Credentials rejected with invalid_grant require Google reauthorisation. A machine-local helper was supplied in chat and is not a repository artifact. The workflow never cancels a pending review, changes visibility, or bypasses Google policy requirements.

## References

- [Google v2 status response and version fields](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/fetchStatus)
- [Google v2 publication states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState)
- [Google migration deadline](https://developer.chrome.com/blog/cws-api-v2)
- [OAuth reauthorisation helper documentation](https://github.com/fregante/chrome-webstore-upload-keys)

[Offline HTML version](cws-api-v2.html).
