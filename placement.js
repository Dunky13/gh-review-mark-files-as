(() => {
  const key = 'reviewToolbarPlacement';
  let preference = { mode: 'header' };
  let revision = 0;
  let active = null;
  let dockTarget = null;
  let picking = false;
  let drag = null;
  let sizeObserver = null;
  let reportTimer = null;
  const containerSelector = 'header, nav, aside, main, footer, section, div, [role="toolbar"]';

  function normalize(value) {
    if (value?.mode === 'floating' && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { mode: 'floating', x: value.x, y: value.y };
    }
    if (value?.mode === 'custom' && typeof value.selector === 'string' && value.selector.length < 2000) {
      return { mode: 'custom', selector: value.selector };
    }
    return { mode: 'header' };
  }

  function report(message, temporary = false) {
    clearTimeout(reportTimer);
    reportTimer = null;
    const status = active?.querySelector('#viewed-state-placement-status');
    if (!status) return;
    status.textContent = message;
    if (temporary) reportTimer = setTimeout(() => {
      status.textContent = '';
      reportTimer = null;
    }, 5000);
  }

  async function save() {
    revision++;
    try { await chrome.storage.local.set({ [key]: preference }); }
    catch (error) { report(`Could not save toolbar position: ${error.message}`); }
  }

  const loadRevision = revision;
  void (async () => {
    try {
      const stored = await chrome.storage.local.get(key);
      if (revision === loadRevision) preference = normalize(stored[key]);
    } catch (error) { console.error('Could not load review toolbar position:', error); }
  })();

  function clearTarget() {
    dockTarget?.removeAttribute('data-review-dock-target');
    dockTarget = null;
  }

  function targetAt(x, y) {
    const target = document.elementsFromPoint(x, y).find(element => !active?.contains(element));
    const container = target?.closest(containerSelector);
    if (!container || container === document.body || container.contains(active)
      || container.closest('dialog, [role="dialog"], pre, code, button, a, label, form')) return null;
    return container;
  }

  function highlight(x, y) {
    const target = targetAt(x, y);
    if (target === dockTarget) return;
    clearTarget();
    dockTarget = target;
    dockTarget?.setAttribute('data-review-dock-target', '');
  }

  function selectorFor(element) {
    const parts = [];
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (/^[a-zA-Z][\w-]*$/.test(node.id)) return `#${node.id}${parts.length ? ' > ' + parts.join(' > ') : ''}`;
      const siblings = Array.from(node.parentElement.children).filter(child => child.localName === node.localName);
      parts.unshift(`${node.localName}:nth-of-type(${siblings.indexOf(node) + 1})`);
    }
    return `body > ${parts.join(' > ')}`;
  }

  function dock() {
    if (!dockTarget) return false;
    dockTarget.prepend(active);
    preference = { mode: 'custom', selector: selectorFor(dockTarget) };
    clearTarget();
    picking = false;
    report('Toolbar docked. Choose Header to reset.', true);
    void save();
    return true;
  }

  function move(x, y) {
    const rect = active.getBoundingClientRect();
    preference = { mode: 'floating',
      x: Math.max(8, Math.min(x, Math.max(8, innerWidth - rect.width - 8))),
      y: Math.max(8, Math.min(y, Math.max(8, innerHeight - rect.height - 8))) };
    active.dataset.placement = 'floating';
    active.style.left = `${preference.x}px`;
    active.style.top = `${preference.y}px`;
    active.style.right = 'auto';
    active.style.bottom = 'auto';
  }

  function initialize(toolbar) {
    const handle = document.createElement('button');
    handle.id = 'viewed-state-drag';
    handle.type = 'button';
    handle.textContent = '⠿';
    handle.setAttribute('aria-label', 'Move review tools; use arrow keys to move, Escape to cancel');
    handle.title = 'Drag to move. Hold Shift while dropping to dock in the page. Arrow keys also move.';
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || picking) return;
      const rect = toolbar.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, original: preference };
      toolbar.dataset.dragging = 'true';
      move(rect.left, rect.top);
      document.body.append(toolbar);
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      move(event.clientX - drag.x, event.clientY - drag.y);
      if (event.shiftKey) highlight(event.clientX, event.clientY);
      else clearTarget();
    });
    handle.addEventListener('pointerup', event => {
      if (drag?.id !== event.pointerId) return;
      if (event.shiftKey) { highlight(event.clientX, event.clientY); dock(); }
      clearTarget();
      drag = null;
      delete toolbar.dataset.dragging;
      void save();
    });
    const cancelDrag = () => {
      if (drag) preference = drag.original;
      drag = null;
      delete toolbar.dataset.dragging;
      clearTarget();
    };
    handle.addEventListener('pointercancel', cancelDrag);
    handle.addEventListener('lostpointercapture', cancelDrag);
    handle.addEventListener('keydown', event => {
      const delta = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, -15], ArrowDown: [0, 15] }[event.key];
      if (!delta) return;
      event.preventDefault();
      const rect = toolbar.getBoundingClientRect();
      move(rect.left + delta[0], rect.top + delta[1]);
      document.body.append(toolbar);
      void save();
    });
    if (typeof ResizeObserver === 'function') {
      sizeObserver?.disconnect();
      sizeObserver = new ResizeObserver(() => {
        if (active === toolbar && preference.mode === 'floating') move(preference.x, preference.y);
      });
      sizeObserver.observe(toolbar);
    }
    const select = document.createElement('select');
    select.id = 'viewed-state-placement';
    select.setAttribute('aria-label', 'Review tools placement');
    for (const [value, text] of [['header', 'Header'], ['floating', 'Floating'], ['custom', 'Dock in page…'], ['docked', 'Docked in page']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      if (value === 'docked') { option.disabled = true; option.hidden = true; }
      select.append(option);
    }
    select.addEventListener('change', () => {
      picking = select.value === 'custom';
      clearTarget();
      if (picking) report('Select a page container to dock here. Press Escape to cancel.');
      else {
        if (select.value === 'floating') {
          const rect = toolbar.getBoundingClientRect();
          move(rect.left, rect.top);
        } else preference = { mode: 'header' };
        report('');
        void save();
      }
    });
    const status = document.createElement('span');
    status.id = 'viewed-state-placement-status';
    status.setAttribute('role', 'status');
    toolbar.append(handle, select, status);
  }

  document.addEventListener('pointermove', event => {
    if (picking && active?.isConnected) highlight(event.clientX, event.clientY);
  });
  document.addEventListener('click', event => {
    if (!picking || !active?.isConnected || active.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Keyboard-generated clicks use their focused element instead of coordinates.
    if (event.detail === 0) {
      clearTarget();
      dockTarget = event.target.closest(containerSelector);
      if (dockTarget?.contains(active) || dockTarget === document.body
        || dockTarget?.closest('dialog, [role="dialog"], pre, code, button, a, label, form')) dockTarget = null;
    } else highlight(event.clientX, event.clientY);
    dock();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || (!picking && !drag)) return;
    event.preventDefault();
    if (drag) preference = drag.original;
    drag = null;
    picking = false;
    clearTarget();
    if (active) delete active.dataset.dragging;
    report('Placement cancelled.', true);
  }, true);
  window.addEventListener('resize', () => {
    if (preference.mode === 'floating' && active?.isConnected) move(preference.x, preference.y);
  });

  globalThis.reviewToolbarPlacement = {
    mount(toolbar, header) {
      if (active !== toolbar) {
        report('');
        clearTarget();
        picking = false;
        drag = null;
        active = toolbar;
        initialize(toolbar);
      }
      let target = preference.mode === 'header' ? header : null;
      if (preference.mode === 'custom') {
        try { target = document.querySelector(preference.selector); } catch { target = null; }
        if (target === toolbar || toolbar.contains(target)) target = null;
      }
      if (!drag) {
        toolbar.dataset.placement = target ? 'inline' : 'floating';
        if (target) {
          toolbar.style.left = toolbar.style.top = toolbar.style.right = toolbar.style.bottom = '';
        } else if (preference.mode === 'floating') move(preference.x, preference.y);
        const parent = target || document.body;
        if (toolbar.parentElement !== parent) target ? parent.prepend(toolbar) : parent.append(toolbar);
      }
      const select = toolbar.querySelector('#viewed-state-placement');
      if (!picking) select.value = preference.mode === 'custom' ? 'docked' : preference.mode;
      // Never cover a review dialog, including GitHub's custom modal implementation.
      const hidden = Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]'))
        .some(dialog => !dialog.hidden && dialog.getAttribute('aria-hidden') !== 'true'
          && getComputedStyle(dialog).display !== 'none' && getComputedStyle(dialog).visibility !== 'hidden');
      if (toolbar.hidden !== hidden) toolbar.hidden = hidden;
    },
  };
})();
