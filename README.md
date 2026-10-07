# GitHub Pull Request Mark All Files as [Install here](https://chromewebstore.google.com/detail/cdodhippkioagjgbchpljiboecdljklm/)

Extension that adds a **Mark All Files** control to GitHub's pull request Files changed toolbar. Works with both the classic `/files` page and the redesigned `/changes` page.

Click to mark all files as viewed, click again to unmark them, and click again to restore the original selection if it was mixed. Individual Viewed changes keep the control in sync. The control survives GitHub's in-place navigation and toolbar rerenders.

Only files whose Viewed controls are loaded on the page can be changed. When GitHub's progress count shows more files than are loaded, the control says **Mark Loaded Files**. Load the remaining files or leave the virtualized/single-file view to include them.

## Try the local fix

1. Open `chrome://extensions` and enable **Developer mode**.
2. Disable the Web Store copy temporarily so only one copy runs.
3. Click **Load unpacked** and select this repository folder (the folder containing `manifest.json`).
4. Refresh the GitHub pull request. **Mark All Files** should appear next to the viewed-file progress indicator.

After editing the extension, click **Reload** on its card and refresh the GitHub page. Loading this checkout does not update the published Web Store extension.

## Development

Use Node.js 24 and pnpm 11:

```sh
pnpm install --frozen-lockfile
node --check content.js
pnpm test
```

Regression tests exercise the actual content script with classic and React DOM fixtures, including delayed rendering, tri-state restoration, navigation, and asynchronous button replacement. CI runs these checks before packaging and publishing.

# Donations
If you like what I do, please consider donating to continue this development as https://www.buymeacoffee.com/developwent
