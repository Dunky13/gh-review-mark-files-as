(() => {
  const viewedSelector = [
    'input.js-reviewed-checkbox',
    'button[class*="MarkAsViewedButton"]',
    'button[aria-label="Viewed"][aria-pressed]',
    'button[aria-label="Not Viewed"][aria-pressed]',
  ].join(',');
  const initialFileStates = new Map();
  let page = '';
  let busy = false;
  let scheduled = false;
  let buttons = reviewFileSettings.defaults.buttons.map(button => ({ ...button, filter: reviewFileSettings.compile(button) }));
  let settingsReady = false;
  let settingsError = '';
  let settingsRevision = 0;

  function applySettings(value) {
    try {
      buttons = reviewFileSettings.normalize(value).buttons.map(button => ({ ...button, filter: reviewFileSettings.compile(button) }));
      settingsError = '';
    } catch (error) {
      settingsError = error.message;
    }
    settingsReady = true;
    scheduleSynchronize();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.filePatterns) return;
    settingsRevision++;
    applySettings(changes.filePatterns.newValue);
  });
  const loadRevision = settingsRevision;
  void (async () => {
    try {
      const stored = await chrome.storage.local.get('filePatterns');
      if (settingsRevision === loadRevision) applySettings(stored.filePatterns);
    } catch (error) {
      if (settingsRevision !== loadRevision) return;
      settingsError = `Could not load file patterns: ${error.message}. Reload the extension and try again.`;
      settingsReady = true;
      scheduleSynchronize();
    }
  })();

  function filePath(file) {
    const diff = file.closest('[data-path], [data-file-path], [role="region"][id], [class*="Diff-module"][id]');
    const explicitPath = diff?.getAttribute('data-path') || diff?.getAttribute('data-file-path')
      || diff?.querySelector('a[href^="#diff-"][title]')?.getAttribute('title');
    if (explicitPath) return explicitPath;
    // Current GitHub headers use an untitled link and aria-labelledby on the
    // region. Read the header's code text, not arbitrary text from the diff.
    const code = diff?.querySelector('[data-diff-header-wrapper] h3 a[href^="#diff-"] code');
    if (code && !code.children.length) {
      // GitHub wraps the filename in left-to-right markers for display.
      return code.textContent.replace(/^\u200e|\u200e$/g, '');
    }
    // A rename header has separate visible and accessible descriptions, not
    // one plain path. Leave it untouched rather than matching display text.
    return diff?.getAttribute('aria-label') || '';
  }

  function getTargetFiles(button) {
    const filter = button.filter;
    return getFiles().filter(file => !filter.active || (filePath(file) && filter.matches(filePath(file))));
  }

  function getFiles() {
    return Array.from(document.querySelectorAll(viewedSelector));
  }

  function fileKey(file) {
    const diff = file.closest('[data-path], [data-file-path], [role="region"][id], [class*="Diff-module"][id]');
    return diff?.getAttribute('data-path') || diff?.getAttribute('data-file-path') || diff?.id || file.id || file;
  }

  function isViewed(file) {
    if (file instanceof HTMLInputElement) return file.checked;
    const pressed = file.getAttribute('aria-pressed');
    if (pressed !== null) return pressed === 'true';
    return Boolean(file.querySelector('.octicon-checkbox-fill'));
  }

  function getHeader() {
    return document.querySelector('.pr-review-tools')
      || document.querySelector('[class*="ViewedFileProgress"]')?.closest('.d-flex')
      || document.querySelector('[class*="ViewedFileProgress"]')?.parentElement;
  }

  function updateControl(control, files, button) {
    const filter = button.filter;
    const checked = files.filter(isViewed).length;
    const position = checked === 0 ? 0 : checked === files.length ? 2 : 1;
    control.checked = position === 2;
    control.indeterminate = position === 1;
    const disabled = busy || !settingsReady || Boolean(settingsError) || files.length === 0;
    if (control.disabled !== disabled) control.disabled = disabled;
    const progress = document.querySelector('[class*="ViewedFileProgress"], .js-review-count');
    const total = Number(progress?.textContent.match(/\d+\s*\/\s*(\d+)/)?.[1]);
    const partial = total > getFiles().length;
    const text = button.name === 'All Files' && !filter.active
      ? partial ? 'Mark Loaded Files' : 'Mark All Files'
      : `Mark ${button.name} (${files.length})`;
    const labelText = control.nextElementSibling;
    if (labelText && labelText.textContent !== text) labelText.textContent = text;
    const unknownPaths = filter.active ? getFiles().filter(file => !filePath(file)).length : 0;
    const title = settingsError || (!settingsReady ? 'Loading file patterns…' : filter.active && files.length === 0
      ? `No matching loaded files.${unknownPaths ? ` Could not read paths for ${unknownPaths} loaded file${unknownPaths === 1 ? '' : 's'}.` : ' Check your patterns or load more files.'}`
      : filter.active
      ? 'Cycle matching loaded files between viewed, unviewed, and their original selection. Other files stay untouched.'
      : partial
      ? 'Only loaded files can be changed. Load the remaining files to include them.'
      : 'Cycle between all viewed, none viewed, and the original selection');
    if (control.title !== title) control.title = title;
    if (control.parentElement.title !== title) control.parentElement.title = title;
  }

  function synchronize() {
    scheduled = false;
    const path = window.location.pathname;
    const isFilesPage = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/|$)/.test(path);
    if (path !== page) {
      page = path;
      initialFileStates.clear();
      document.querySelector('#viewed-state-controls')?.remove();
      document.querySelector('#viewed-state-error')?.remove();
      document.querySelector('#viewed-state-settings')?.remove();
    }
    if (!isFilesPage) return;
    const files = getFiles();
    for (const file of files) {
      const key = fileKey(file);
      if (!initialFileStates.has(key)) initialFileStates.set(key, isViewed(file));
    }
    if (!settingsReady) return;
    const header = getHeader();
    if (!header) return;
    let controls = document.querySelector('#viewed-state-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'viewed-state-controls';
      controls.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap';
      header.prepend(controls);
    } else if (controls.parentElement !== header) header.prepend(controls);
    for (const label of Array.from(controls.children)) {
      if (!buttons.some(button => button.id === label.dataset.buttonId)) label.remove();
    }
    buttons.forEach((button, index) => {
      let label = Array.from(controls.children).find(child => child.dataset.buttonId === button.id);
      if (!label) {
        label = document.createElement('label');
        label.dataset.buttonId = button.id;
        label.className = 'diffbar-item Button--primary Button--small Button';
        label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-shrink:0;cursor:pointer';
        const control = document.createElement('input');
        control.type = 'checkbox';
        const text = document.createElement('span');
        label.append(control, text);
        control.addEventListener('click', event => {
          const current = buttons.find(candidate => candidate.id === label.dataset.buttonId);
          if (current) void toggleFiles(event, current);
        });
        controls.append(label);
      }
      const control = label.querySelector('input');
      control.id = index === 0 ? 'viewed-state-checkbox' : `viewed-state-checkbox-${button.id}`;
      label.querySelector('span').id = index === 0 ? 'viewed-state-label' : `viewed-state-label-${button.id}`;
      if (controls.children[index] !== label) controls.insertBefore(label, controls.children[index] || null);
      updateControl(control, getTargetFiles(button), button);
    });
    let settingsLink = document.querySelector('#viewed-state-settings');
    if (!settingsLink) {
      settingsLink = document.createElement('button');
      settingsLink.id = 'viewed-state-settings';
      settingsLink.textContent = 'Settings';
      settingsLink.type = 'button';
      settingsLink.className = 'Button Button--small';
      settingsLink.addEventListener('click', async () => {
        try {
          const result = await chrome.runtime.sendMessage({ type: 'open-file-review-settings' });
          if (!result?.opened) throw new Error(result?.error || 'The extension did not respond.');
        } catch (error) {
          let status = document.querySelector('#viewed-state-error');
          if (!status) {
            status = document.createElement('span');
            status.id = 'viewed-state-error';
            status.setAttribute('role', 'alert');
            settingsLink.after(status);
          }
          status.textContent = `Could not open Settings: ${error.message}. Try the extension’s Options menu.`;
        }
      });
      settingsLink.style.cssText = 'margin-right:10px;flex-shrink:0';
    }
    if (controls.nextSibling !== settingsLink) controls.after(settingsLink);
  }

  function scheduleSynchronize() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(synchronize, 0);
  }

  // React can replace every Viewed button after a click. Resolve each file again
  // and wait for its state to change before moving on to the next one.
  function setViewed(key, targetState, batchPage) {
    return new Promise((resolve, reject) => {
      if (window.location.pathname !== batchPage) {
        reject(new Error('The pull request page changed while updating files.'));
        return;
      }
      const file = getFiles().find(candidate => fileKey(candidate) === key);
      if (!file) {
        reject(new Error('A file was unloaded while updating its viewed state.'));
        return;
      }
      if (isViewed(file) === targetState) {
        resolve();
        return;
      }
      if (file.disabled || file.getAttribute('aria-disabled') === 'true') {
        reject(new Error('GitHub has disabled a file’s Viewed control.'));
        return;
      }
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => finish(new Error('GitHub did not update a file’s viewed state. Please retry.')), 5000);
      function finish(error) {
        observer.disconnect();
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      }
      function check() {
        if (window.location.pathname !== batchPage) {
          finish(new Error('The pull request page changed while updating files.'));
          return;
        }
        const current = getFiles().find(candidate => fileKey(candidate) === key);
        if (current && isViewed(current) === targetState) finish();
      }
      observer.observe(document.body, {subtree: true, childList: true, attributes: true});
      file.click();
      check();
    });
  }

  async function toggleFiles(event, button) {
    const control = event.currentTarget;
    if (busy || !settingsReady || settingsError) return;
    const files = getTargetFiles(button);
    if (!files.length) return;
    // Capture newly loaded files before choosing the restore state.
    for (const file of files) {
      const key = fileKey(file);
      if (!initialFileStates.has(key)) initialFileStates.set(key, isViewed(file));
    }
    const checked = files.filter(isViewed).length;
    const position = checked === 0 ? 0 : checked === files.length ? 2 : 1;
    let next = (position + 1) % 3;
    const originalStates = files.map(file => initialFileStates.get(fileKey(file)));
    if (next === 1 && (!originalStates.some(Boolean) || originalStates.every(Boolean))) next = 2;
    const batchPage = page;
    document.querySelector('#viewed-state-error')?.remove();
    const targets = files.map(file => ({
      key: fileKey(file),
      state: next === 1 ? initialFileStates.get(fileKey(file)) : next === 2,
    }));
    busy = true;
    synchronize();
    try {
      for (const target of targets) await setViewed(target.key, target.state, batchPage);
    } catch (error) {
      console.error('GitHub Mark All Files:', error);
      if (window.location.pathname === batchPage && control.isConnected) {
        let status = document.querySelector('#viewed-state-error');
        if (!status) {
          status = document.createElement('span');
          status.id = 'viewed-state-error';
          status.setAttribute('role', 'alert');
          document.querySelector('#viewed-state-controls').after(status);
        }
        status.textContent = error.message;
      }
    } finally {
      busy = false;
      synchronize();
    }
  }

  new MutationObserver(scheduleSynchronize).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'checked', 'class', 'disabled'],
  });
  document.addEventListener('change', scheduleSynchronize);
  document.addEventListener('click', scheduleSynchronize);
  document.addEventListener('turbo:load', scheduleSynchronize);
  document.addEventListener('pjax:end', scheduleSynchronize);
  window.addEventListener('popstate', scheduleSynchronize);
  // Also catch pushState navigation and checkbox property updates without a DOM mutation.
  setInterval(scheduleSynchronize, 1000);
  synchronize();
})();
