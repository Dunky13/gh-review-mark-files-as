(() => {
  const viewedSelector = [
    'input.js-reviewed-checkbox',
    'button[class*="MarkAsViewedButton"]',
    'button[aria-label="Viewed"][aria-pressed]',
    'button[aria-label="Not Viewed"][aria-pressed]',
  ].join(',');
  const initialFileStates = new Map();
  const fileRegionSelector = '[data-path], [data-file-path], [role="region"][id], [class*="Diff-module"][id]';
  let progressElement = null;
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
    const diff = file.closest(fileRegionSelector);
    const explicitPath = diff?.getAttribute('data-path') || diff?.getAttribute('data-file-path')
      || diff?.querySelector('a[href^="#diff-"][title]')?.getAttribute('title');
    if (explicitPath) return explicitPath;
    // Current GitHub headers use an untitled link and aria-labelledby on the
    // region. Read the header's code text, not arbitrary text from the diff.
    const headings = (diff?.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => document.getElementById(id)).filter(heading => heading && diff.contains(heading));
    const code = headings.map(heading => heading.querySelector('a[href^="#diff-"] code')).find(Boolean)
      || diff?.querySelector('[data-diff-header-wrapper] h3 a[href^="#diff-"] code');
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
    const diff = file.closest(fileRegionSelector);
    return diff?.getAttribute('data-path') || diff?.getAttribute('data-file-path') || diff?.id || file.id || file;
  }

  function isViewed(file) {
    if (file instanceof HTMLInputElement) return file.checked;
    const pressed = file.getAttribute('aria-pressed');
    if (pressed !== null) return pressed === 'true';
    return Boolean(file.querySelector('.octicon-checkbox-fill'));
  }

  function isFileContent(element) {
    return Boolean(element.closest(`${fileRegionSelector}, pre, code, #viewed-state-toolbar`));
  }

  function readProgress(element) {
    if (!element?.isConnected || isFileContent(element)) return null;
    const label = element.getAttribute('aria-label') || '';
    const text = label || element.textContent.trim();
    const count = text.match(/^(\d+)\s*(?:\/|of)\s*(\d+)\s+(?:files?\s+)?viewed$/i);
    if (count) return { element, total: Number(count[2]) };
    const max = element.getAttribute('aria-valuemax');
    if (element.getAttribute('role') === 'progressbar' && /files?\s+viewed|viewed\s+files?/i.test(label) && /^\d+$/.test(max || '')) {
      return { element, total: Number(max) };
    }
    return null;
  }

  function getProgress() {
    const cached = readProgress(progressElement);
    if (cached) return cached;
    // Accessible names and the screen-reader count survive CSS-module renames.
    // Keep the older hooks for GitHub's classic layout and older React pages.
    const candidates = document.querySelectorAll('[aria-label], [role="progressbar"], span, .js-review-count, [class*="ViewedFileProgress"]');
    for (const element of candidates) {
      if (element.children.length && !element.hasAttribute('aria-label') && !element.matches('.js-review-count, [class*="ViewedFileProgress"]')) continue;
      const progress = readProgress(element);
      if (progress) {
        progressElement = element;
        return progress;
      }
    }
    return null;
  }

  function getHeader(progress) {
    const review = Array.from(document.querySelectorAll('button, [role="button"]')).find(button =>
      !isFileContent(button) && /^(?:submit|finish)\s+review\b/i.test((button.getAttribute('aria-label') || button.textContent).trim()));
    if (progress && review) {
      // Mount alongside both controls, never inside the progress-only wrapper
      // that GitHub hides on narrow screens. Do not climb into the file list.
      for (let parent = progress.element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.querySelector(viewedSelector)) break;
        if (parent.contains(review)) return parent;
      }
    }
    const toolbar = review?.closest('[role="toolbar"]');
    if (toolbar && !toolbar.querySelector(viewedSelector)) return toolbar;
    return Array.from(document.querySelectorAll('.pr-review-tools')).find(element => !isFileContent(element))
      || Array.from(document.querySelectorAll('[class*="ViewedFileProgress"]')).find(element => !isFileContent(element))?.closest('.d-flex');
  }

  function mountToolbar(header) {
    let toolbar = document.querySelector('#viewed-state-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'viewed-state-toolbar';
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', 'File review tools');
      const style = document.createElement('style');
      style.textContent = `
        #viewed-state-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:6px; min-width:0; max-width:100%; box-sizing:border-box; font:12px/1.4 system-ui,sans-serif; color:var(--fgColor-default,CanvasText); }
        #viewed-state-toolbar[data-placement="floating"] { position:fixed; inset:auto 16px 16px auto; z-index:2147483646; max-width:calc(100vw - 32px); max-height:40vh; overflow:auto; padding:10px; border:1px solid var(--borderColor-default,GrayText); border-radius:8px; background:var(--bgColor-default,Canvas); box-shadow:0 4px 16px #0003; }
        #viewed-state-controls { display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-width:0; }
        #viewed-state-controls label, #viewed-state-settings { display:inline-flex; align-items:center; gap:6px; box-sizing:border-box; max-width:100%; margin:0; padding:5px 9px; border:1px solid var(--borderColor-default,GrayText); border-radius:6px; font:inherit; font-weight:600; cursor:pointer; }
        #viewed-state-controls label { background:var(--button-primary-bgColor-rest,#1f883d); color:var(--button-primary-fgColor-rest,#fff); }
        #viewed-state-controls span { overflow-wrap:anywhere; min-width:0; }
        #viewed-state-controls input { flex-shrink:0; margin:0; }
        #viewed-state-settings { background:var(--bgColor-muted,ButtonFace); color:var(--fgColor-default,ButtonText); }
        #viewed-state-toolbar :focus-visible { outline:2px solid var(--focus-outlineColor,Highlight); outline-offset:2px; }
        #viewed-state-error { flex-basis:100%; overflow-wrap:anywhere; }
      `;
      toolbar.append(style);
    }
    const placement = header ? 'inline' : 'floating';
    if (toolbar.dataset.placement !== placement) toolbar.dataset.placement = placement;
    const target = header || document.body;
    if (toolbar.parentElement !== target) header ? target.prepend(toolbar) : target.append(toolbar);
    return toolbar;
  }

  function updateControl(control, files, button, total) {
    const filter = button.filter;
    const checked = files.filter(isViewed).length;
    const position = checked === 0 ? 0 : checked === files.length ? 2 : 1;
    control.checked = position === 2;
    control.indeterminate = position === 1;
    const disabled = busy || !settingsReady || Boolean(settingsError) || files.length === 0;
    if (control.disabled !== disabled) control.disabled = disabled;
    // Without a trustworthy total, promise only the files actually loaded.
    const partial = total === undefined || total > getFiles().length;
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
      progressElement = null;
      initialFileStates.clear();
      document.querySelector('#viewed-state-toolbar')?.remove();
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
    const progress = getProgress();
    const header = mountToolbar(getHeader(progress));
    let controls = document.querySelector('#viewed-state-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'viewed-state-controls';
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
      updateControl(control, getTargetFiles(button), button, progress?.total);
    });
    let settingsLink = document.querySelector('#viewed-state-settings');
    if (!settingsLink) {
      settingsLink = document.createElement('button');
      settingsLink.id = 'viewed-state-settings';
      settingsLink.textContent = 'Settings';
      settingsLink.type = 'button';
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
    attributeFilter: ['aria-pressed', 'aria-label', 'aria-valuemax', 'checked', 'class', 'disabled'],
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
