# GitHub Pull Request Mark All Files as [Install here](https://chromewebstore.google.com/detail/cdodhippkioagjgbchpljiboecdljklm/)

Extension that adds a **Mark All Files** control to GitHub's pull request Files changed toolbar. Works with both the classic `/files` page and the redesigned `/changes` page.

Click to mark all files as viewed, click again to unmark them, and click again to restore the original selection if it was mixed. Individual Viewed changes keep the control in sync. The control survives GitHub's in-place navigation and toolbar rerenders.

You can open GitHub on the dashboard, notifications, or a repository and click through to a pull request without refreshing. The content script starts on GitHub pages so it can follow in-place navigation; review tools appear only on pull request `/files` and `/changes` routes.

Review tools use GitHub's accessible progress and control labels, with compatibility hooks for older layouts. If the toolbar cannot be identified, the tools appear in a floating panel at the bottom right. In **Header** mode they return to the toolbar when it becomes available. Use the placement menu to choose **Floating**, then drag the grip to move the panel anywhere in the window (or focus the grip and use arrow keys). Hold **Shift** while dropping to dock into a highlighted page container, or choose **Dock in page…** and click a container. **Escape** cancels placement. All placement preferences persist in this browser across pull requests. Custom docking reuses the selected page container and falls back to floating when that container is unavailable. Docking confirmations disappear after five seconds; placement instructions and save errors remain visible. Choose **Header** to reset. Tools hide while a review modal is open so they cannot cover its actions. The extension supplies its own control styling so GitHub button-class changes do not remove it.

Only files whose Viewed controls are loaded on the page can be changed. When GitHub's progress count shows more files than are loaded, or the total cannot be determined, the control says **Mark Loaded Files**. Load the remaining files or leave the virtualized/single-file view to include them.

## Custom review buttons

Open **Settings** beside the review buttons, click the extension icon, or open the extension's **Options** menu. Choose **Add button** and give each button a name and its own include/exclude patterns. Each pattern has an individual input field with **+** and **−** buttons to add or remove rows:

- **Tests**: include `**/*.test.*` and `**/tests/**`, in separate fields; exclude `**/fixtures/**` to leave fixtures untouched.
- **Docs**: include `**/*.md` and `docs/**`.
- **All Files**: leave both pattern fields blank to target all loaded files.

Add, rename, or remove up to 20 buttons, then **Save** to update open pull requests immediately. Removing every button leaves only Settings in the toolbar. **Reset** saves the default configuration.

Patterns are relative to the repository root. `*` matches within a path segment, `**` crosses folders, and `?` matches one character. `**/` also matches zero folders, so root-level tests are included. Patterns are case-sensitive; other characters are literal. A file must match any include pattern (unless the include field is blank) and must not match any exclude pattern.

Each custom button shows its matching loaded-file count and cycles those files through viewed, unviewed, and their original selection when mixed. Nonmatching files keep their state. Overlapping buttons stay in sync; only one batch runs at a time. Settings changed during a batch apply to subsequent clicks. Files without an identifiable path are left untouched when filtering is active. Settings persist locally in this browser and apply across repositories.

## Try the local fix

1. Open `chrome://extensions` and enable **Developer mode**.
2. Disable the Web Store copy temporarily so only one copy runs.
3. Click **Load unpacked** and select this repository folder (the folder containing `manifest.json`).
4. Refresh the GitHub pull request. **Mark All Files** should appear next to the viewed-file progress indicator.

To check navigation, open a repository or notifications in a fresh tab, then click through to a pull request's **Files changed** tab. The review tools should appear without refreshing. Leaving Files changed removes the tools; returning restores them.

After editing the extension, click **Reload** on its card and refresh the GitHub page. Loading this checkout does not update the published Web Store extension.

## Development

Use Node.js 24 and pnpm 11:

```sh
pnpm install --frozen-lockfile
node --check placement.js && node --check content.js && node --check settings.js && node --check options.js && node --check background.js
pnpm test
```

Regression tests load the actual scripts according to the manifest's URL matches and file order, then exercise classic and React DOM fixtures, including navigation from non-PR entry pages, delayed rendering, tri-state restoration, and asynchronous button replacement. CI runs these checks before packaging and publishing.

# Donations
If you like what I do, please consider donating to continue this development as https://www.buymeacoffee.com/developwent
