# Movable review toolbar — v1.2.0

The review toolbar can be kept in GitHub’s review header, moved freely around the window, or docked in a chosen page container. It hides while a review modal is open so review actions remain accessible.

## Controls

- **Header** uses the detected review header and falls back to floating when that header is unavailable.
- **Floating** keeps the toolbar in the window. Drag its grip, or focus the grip and use arrow keys, to move it. Positions are clamped to the viewport, including after resizing.
- Hold **Shift** while dropping the grip to dock into the highlighted page container.
- **Dock in page…** lets you click a container instead of dragging. Escape cancels placement. Choose Header to reset.

Preferences stay in local extension storage. Custom docking is tied to the selected pull request route. If its container disappears, the toolbar falls back to floating. GitHub can change the page structure, so a saved custom location may need selecting again.

## Implementation

`placement.js` owns placement, dragging, docking, persistence, keyboard movement, and modal visibility. `content.js` retains file selection and viewed-state behavior. The manifest loads placement before content; the publishing workflow includes the new file and CI checks its syntax. No new permissions or dependencies were added.

## Validation

- All 77 Node tests pass, including eight new placement regressions covering header reset, modal visibility, keyboard clamping, save errors, container replacement, cancellation, saved positions, Shift-drop behavior, and header recognition without progress text.
- Syntax checks pass for all five runtime scripts; the diff whitespace check passes.
- The collaborative browser exercised the actual scripts against a local GitHub-style fixture: physical pointer dragging, saved position after reload, custom docking, modal hiding, and desktop/narrow layouts (1280 × 800 and 390 × 844). The narrow fixture has no horizontal overflow.
- This is fixture evidence. An installed-extension check against authenticated GitHub has not been performed. The v1.2.0 release is authorized through PR, merge, GitHub release, and store submission. Verify remote CI and provider publication status separately; this document records pre-release validation.

## Try it

Load this repository as an unpacked extension through `chrome://extensions`, or reload an existing unpacked copy, then refresh a GitHub pull request’s Files changed page. Disable any installed store copy during this check so only one copy runs. Exercise the placement menu and open Finish your review to confirm the toolbar disappears until the dialog closes.
