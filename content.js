(() => {
  const viewedSelector = [
    'input.js-reviewed-checkbox',
    'button[class*="MarkAsViewedButton"]',
    'button[aria-label="Viewed"][aria-pressed]',
    'button[aria-label="Not Viewed"][aria-pressed]',
  ].join(',');
  const initialFileStates = new Map();
  let page = '';
  let position = 0;
  let busy = false;
  let scheduled = false;

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

  function updateControl(control, files) {
    const checked = files.filter(isViewed).length;
    position = checked === 0 ? 0 : checked === files.length ? 2 : 1;
    control.checked = position === 2;
    control.indeterminate = position === 1;
    const disabled = busy || files.length === 0;
    if (control.disabled !== disabled) control.disabled = disabled;
    const progress = document.querySelector('[class*="ViewedFileProgress"], .js-review-count');
    const total = Number(progress?.textContent.match(/\d+\s*\/\s*(\d+)/)?.[1]);
    const partial = total > files.length;
    const text = partial ? 'Mark Loaded Files' : 'Mark All Files';
    const labelText = document.querySelector('#viewed-state-label');
    if (labelText && labelText.textContent !== text) labelText.textContent = text;
    const title = partial
      ? 'Only loaded files can be changed. Load the remaining files to include them.'
      : 'Cycle between all viewed, none viewed, and the original selection';
    if (control.title !== title) control.title = title;
  }

  function synchronize() {
    scheduled = false;
    const path = window.location.pathname;
    const isFilesPage = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/|$)/.test(path);
    if (path !== page) {
      page = path;
      initialFileStates.clear();
      document.querySelector('#viewed-state-control')?.remove();
      document.querySelector('#viewed-state-error')?.remove();
    }
    if (!isFilesPage) return;
    const files = getFiles();
    for (const file of files) {
      const key = fileKey(file);
      if (!initialFileStates.has(key)) initialFileStates.set(key, isViewed(file));
    }
    const header = getHeader();
    if (!header) return;
    let control = document.querySelector('#viewed-state-checkbox');
    if (!control) {
      const label = document.createElement('label');
      label.id = 'viewed-state-control';
      label.className = 'diffbar-item Button--primary Button--small Button';
      label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-right:10px;flex-shrink:0;cursor:pointer';
      control = document.createElement('input');
      control.id = 'viewed-state-checkbox';
      control.type = 'checkbox';
      const text = document.createElement('span');
      text.id = 'viewed-state-label';
      text.textContent = 'Mark All Files';
      label.append(control, text);
      header.prepend(label);
      control.addEventListener('click', toggleFiles);
    } else if (control.parentElement.parentElement !== header) {
      header.prepend(control.parentElement);
    }
    if (!busy) updateControl(control, files);
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

  async function toggleFiles(event) {
    const control = event.currentTarget;
    if (busy) return;
    const files = getFiles();
    // Capture newly loaded files before choosing the restore state.
    for (const file of files) {
      const key = fileKey(file);
      if (!initialFileStates.has(key)) initialFileStates.set(key, isViewed(file));
    }
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
    control.disabled = true;
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
          control.parentElement.after(status);
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
