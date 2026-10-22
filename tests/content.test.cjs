const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const manifest = require('../manifest.json');
const source = readFileSync(process.env.CONTENT_SCRIPT_PATH || 'content.js', 'utf8');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, message) {
  const deadline = Date.now() + 1800;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(10);
  }
  assert.fail(message);
}

function toolbar() {
  return '<div class="d-flex"><span class="ViewedFileProgress-module__progress__abc">0 / 3 viewed</span><button>Submit review</button></div>';
}

function modernFile(name, index, checked, iconOnly = false) {
  const state = iconOnly
    ? `<svg class="octicon ${checked ? 'octicon-checkbox-fill' : 'octicon-square'}"></svg>`
    : '';
  return `<section role="region" id="diff-${index}" aria-label="${name}"><div><a href="#diff-${index}" title="${name}">${name}</a><button class="MarkAsViewedButton-module__button__abc" ${iconOnly ? '' : `aria-pressed="${checked}"`}>${state}Viewed</button></div></section>`;
}

function modernPage(states = [true, false, false], options = {}) {
  return toolbar() + states.map((checked, index) => modernFile(`src/file-${index}.js`, index, checked, options.iconOnly)).join('');
}

function classicPage(states = [true, false, false]) {
  return '<div class="pr-review-tools"><span class="js-review-count">1 / 3 viewed</span></div><div class="js-diff-progressive-container">' + states.map((checked, index) => `<div class="file" data-path="src/file-${index}.js"><input type="checkbox" id="viewed-${index}" class="js-reviewed-checkbox" ${checked ? 'checked' : ''}></div>`).join('') + '</div>';
}

function setup(t, html, route = '/Hikyo-Org/Hikyo/pull/858/changes', { rerender = false, iconOnly = false, patterns, storageError, placementPreference, placementLoadDelay = 0 } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM(html, { url: new URL(route, 'https://github.com').href, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const clicks = [];
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[class*="MarkAsViewedButton-module__"], button[aria-label="Viewed"][aria-pressed], button[aria-label="Not Viewed"][aria-pressed]');
    if (!button) return;
    const section = button.closest('section');
    clicks.push(section.id);
    const checked = iconOnly ? !!button.querySelector('.octicon-checkbox-fill') : button.getAttribute('aria-pressed') === 'true';
    const update = () => {
      if (rerender) {
        const sections = Array.from(document.querySelectorAll('section'));
        for (const file of sections) {
          const current = file.querySelector('button');
          const next = current.cloneNode(true);
          if (file === section) next.setAttribute('aria-pressed', String(!checked));
          current.replaceWith(next);
        }
      } else if (iconOnly) {
        button.querySelector('svg').setAttribute('class', `octicon ${checked ? 'octicon-square' : 'octicon-checkbox-fill'}`);
      } else {
        button.setAttribute('aria-pressed', String(!checked));
      }
    };
    rerender ? dom.window.setTimeout(update, 15) : update();
  });
  const wrap = value => value === undefined || value.buttons ? value : { buttons: [{ id: 'matching', name: 'Matching Files', ...value }] };
  let storedPatterns = wrap(patterns);
  const listeners = [];
  dom.window.chrome = {
    runtime: { sendMessage: async () => ({ opened: true }) },
    storage: {
      local: { get: async key => {
        if (storageError) throw new Error(storageError);
        if (key === 'reviewToolbarPlacement' && placementLoadDelay) await delay(placementLoadDelay);
        return { filePatterns: storedPatterns, reviewToolbarPlacement: placementPreference };
      } },
      onChanged: { addListener: listener => listeners.push(listener) },
    },
  };
  // Respect the manifest at document load. Soft navigation must work without
  // injecting again when the URL changes to a pull request.
  for (const entry of manifest.content_scripts) {
    const matches = entry.matches.some(pattern => {
      const match = new URL(pattern);
      const path = match.pathname.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      return match.origin === dom.window.location.origin && new RegExp(`^${path}$`).test(dom.window.location.pathname + dom.window.location.search);
    });
    if (!matches) continue;
    for (const script of entry.js) dom.window.eval(script === 'content.js' ? source : readFileSync(script, 'utf8'));
  }
  return {
    document, window: dom.window, errors, clicks,
    setPatterns: value => {
      storedPatterns = wrap(value);
      for (const listener of listeners) listener({ filePatterns: { newValue: storedPatterns } }, 'local');
    },
    control: () => document.querySelector('#viewed-state-checkbox'),
    states: () => Array.from(document.querySelectorAll('input.js-reviewed-checkbox, button[class*="MarkAsViewedButton-module__"], button[aria-label="Viewed"][aria-pressed], button[aria-label="Not Viewed"][aria-pressed]'), (node) => node.tagName === 'INPUT' ? node.checked : iconOnly ? !!node.querySelector('.octicon-checkbox-fill') : node.getAttribute('aria-pressed') === 'true'),
  };
}

for (const route of ['files', 'changes']) {
  for (const entry of ['/', '/notifications', '/org/repo', '/org/repo/pulls', '/org/repo/issues/42']) {
    test(`soft navigation from ${entry} mounts working tools on /${route} without a reload`, async t => {
      const page = setup(t, '<main>GitHub entry page</main>', entry);
      await delay(20);
      assert.equal(page.document.querySelector('#viewed-state-toolbar'), null, 'Tools appeared outside a diff route');
      page.window.history.pushState({}, '', `/org/repo/pull/42/${route}`);
      page.document.querySelector('main').innerHTML = modernPage([false, false, false]);
      page.document.dispatchEvent(new page.window.Event('turbo:load'));
      await waitFor(() => page.control() && !page.control().disabled, 'Tools missing after soft navigation from a non-PR document');
      page.control().click();
      await waitFor(() => page.states().every(Boolean), 'Tools did not update files after soft navigation');
      await waitFor(() => !page.control().disabled, 'Tools stayed busy');
      assert.equal(page.document.querySelectorAll('#viewed-state-toolbar').length, 1);
      assert.equal(page.errors.length, 0);
    });
  }

  test(`shows one control on the React /${route} page`, async (t) => {
    const page = setup(t, modernPage(), `/Hikyo-Org/Hikyo/pull/858/${route}`);
    await waitFor(() => page.control(), 'Mark All Files control missing on React page');
    assert.equal(page.control().indeterminate, true);
    page.document.body.append(page.document.createElement('div'));
    await delay(50);
    assert.equal(page.document.querySelectorAll('#viewed-state-checkbox').length, 1);
    assert.equal(page.errors.length, 0);
  });
}

test('GitHub entry pages keep review markup untouched until a diff route opens', async t => {
  const page = setup(t, modernPage(), '/notifications');
  await waitFor(() => page.window.reviewFileSettings, 'Scripts did not load on the entry page');
  await delay(20);
  assert.equal(page.document.querySelector('#viewed-state-toolbar'), null);
  assert.deepEqual(page.states(), [true, false, false]);
  assert.equal(page.clicks.length, 0);
  assert.equal(page.errors.length, 0);
});

for (const origin of ['https://example.com', 'https://github.com.example.com', 'https://gist.github.com', 'http://github.com']) {
  test(`does not load GitHub content scripts on ${origin}`, async t => {
    const page = setup(t, modernPage(), `${origin}/org/repo/pull/42/files`);
    await delay(20);
    assert.equal(page.window.reviewFileSettings, undefined);
    assert.equal(page.control(), null);
    assert.equal(page.errors.length, 0);
  });
}

test('classic checkboxes support all, none, and restoring the initial mixed selection', async (t) => {
  const page = setup(t, classicPage(), '/Hikyo-Org/Hikyo/pull/858/files');
  await waitFor(() => page.control(), 'Classic control missing');
  for (const expected of [[true, true, true], [false, false, false], [true, false, false]]) {
    page.control().click();
    await waitFor(() => JSON.stringify(page.states()) === JSON.stringify(expected), `Wrong classic selection: ${expected}`);
    await waitFor(() => !page.control().disabled, 'Control stayed disabled');
  }
  assert.equal(page.control().indeterminate, true);
  assert.equal(page.errors.length, 0);
});

test('React buttons support all, none, and restoring the initial mixed selection', async (t) => {
  const page = setup(t, modernPage());
  await waitFor(() => page.control(), 'React control missing');
  for (const expected of [[true, true, true], [false, false, false], [true, false, false]]) {
    page.control().click();
    await waitFor(() => JSON.stringify(page.states()) === JSON.stringify(expected), `Wrong React selection: ${expected}`);
    await waitFor(() => !page.control().disabled, 'Control stayed disabled');
  }
  assert.equal(page.control().indeterminate, true);
  assert.equal(page.clicks.length, 6, 'Only controls that need changing should receive clicks');
});

test('reads the checked icon when GitHub renders no aria-pressed state', async (t) => {
  const page = setup(t, modernPage([true, false, false], { iconOnly: true }), undefined, { iconOnly: true });
  await waitFor(() => page.control(), 'Icon-only React control missing');
  assert.equal(page.control().indeterminate, true);
  page.control().click();
  await waitFor(() => page.states().every(Boolean), 'Icon state was not respected');
  assert.equal(page.clicks.length, 2);
});

test('reacquires React buttons after an asynchronous render replaces every file control', async (t) => {
  const page = setup(t, modernPage([false, false, false]), undefined, { rerender: true });
  await waitFor(() => page.control(), 'React control missing');
  page.control().click();
  await waitFor(() => page.states().every(Boolean), 'Stale controls missed files after React rerender');
  assert.equal(page.clicks.length, 3);
});

test('mounts after delayed DOM insertion and remounts after GitHub replaces its toolbar', async (t) => {
  const page = setup(t, '<main></main>');
  await delay(30);
  page.document.querySelector('main').innerHTML = modernPage();
  await waitFor(() => page.control()?.indeterminate && page.document.querySelector('#viewed-state-toolbar').dataset.placement === 'inline', 'Loaded files did not update the tools after delayed DOM insertion');
  page.document.querySelector('.d-flex').outerHTML = toolbar();
  await waitFor(() => page.control(), 'Control missing after toolbar remount');
  assert.equal(page.control().indeterminate, true);
  assert.equal(page.document.querySelectorAll('#viewed-state-checkbox').length, 1);
});

test('resets initial file selection for another PR and removes the control outside a diff route', async (t) => {
  const page = setup(t, modernPage());
  await waitFor(() => page.control(), 'React control missing');
  page.control().click();
  await waitFor(() => page.states().every(Boolean), 'Initial mark-all failed');
  page.window.history.pushState({}, '', '/Hikyo-Org/Hikyo/pull/859/changes');
  page.document.body.innerHTML = modernPage([false, true, false]);
  page.document.dispatchEvent(new page.window.Event('turbo:load'));
  await waitFor(() => page.control(), 'Control missing after PR navigation');
  for (const expected of [[true, true, true], [false, false, false], [false, true, false]]) {
    page.control().click();
    await waitFor(() => JSON.stringify(page.states()) === JSON.stringify(expected), 'Previous PR initial state leaked into next PR');
    await waitFor(() => !page.control().disabled, 'Control stayed disabled');
  }
  page.window.history.pushState({}, '', '/Hikyo-Org/Hikyo/pull/859');
  page.document.dispatchEvent(new page.window.Event('turbo:load'));
  await waitFor(() => !page.control(), 'Control remained outside the files-changed route');
});

for (const initial of [false, true]) {
  test(`uniform ${initial ? 'viewed' : 'unviewed'} selection toggles directly between all and none`, async (t) => {
    const page = setup(t, modernPage([initial, initial, initial]));
    await waitFor(() => page.control(), 'React control missing');
    assert.equal(page.control().checked, initial);
    assert.equal(page.control().indeterminate, false);
    for (const expected of [!initial, initial]) {
      page.control().click();
      await waitFor(() => page.states().every((state) => state === expected), 'Uniform selection did not toggle directly');
      await waitFor(() => !page.control().disabled, 'Control stayed disabled');
      assert.equal(page.control().checked, expected);
      assert.equal(page.control().indeterminate, false);
    }
  });
}

test('individual Viewed clicks update the aggregate state without losing the original selection', async (t) => {
  const page = setup(t, modernPage([true, true, false]));
  await waitFor(() => page.control(), 'React control missing');
  page.document.querySelector('#diff-2 button').click();
  await waitFor(() => page.control().checked && !page.control().indeterminate, 'Manual Viewed click did not update aggregate state');
  page.control().click();
  await waitFor(() => page.states().every((state) => !state), 'Aggregate state ignored manual click');
  await waitFor(() => !page.control().disabled, 'Control stayed disabled');
  page.control().click();
  await waitFor(() => JSON.stringify(page.states()) === JSON.stringify([true, true, false]), 'Original selection was lost after manual click');
});

test('labels partial file lists honestly and disables the control while no files are loaded', async (t) => {
  const page = setup(t, toolbar());
  await waitFor(() => page.control(), 'Control missing while files are loading');
  assert.equal(page.control().disabled, true);
  page.document.body.insertAdjacentHTML('beforeend', modernFile('src/lazy.js', 0, false));
  await waitFor(() => !page.control().disabled, 'Control remained disabled after file loaded');
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Loaded Files');
  assert.match(page.control().title, /Only loaded files/);
  page.control().click();
  await waitFor(() => page.states()[0], 'Loaded file was not marked');
  await waitFor(() => !page.control().disabled, 'Control remained disabled');
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Loaded Files');
});

test('reports disabled GitHub controls and avoids claiming the batch succeeded', async (t) => {
  const page = setup(t, modernPage([false, false, false]));
  await waitFor(() => page.control(), 'React control missing');
  page.document.querySelector('#diff-1 button').disabled = true;
  page.control().click();
  await waitFor(() => page.document.querySelector('#viewed-state-error'), 'Disabled file control was silently ignored');
  await waitFor(() => !page.control().disabled, 'Aggregate control did not recover');
  assert.deepEqual(page.states(), [true, false, false]);
  assert.equal(page.control().indeterminate, true);
  assert.equal(page.document.querySelector('#viewed-state-error').getAttribute('role'), 'alert');
});

test('cancels an in-flight batch when navigating to another pull request', async (t) => {
  const page = setup(t, modernPage([false, false, false]), undefined, { rerender: true });
  await waitFor(() => page.control(), 'React control missing');
  page.control().click();
  page.window.history.pushState({}, '', '/Hikyo-Org/Hikyo/pull/860/changes');
  page.document.body.innerHTML = modernPage([false, false, false]);
  page.document.dispatchEvent(new page.window.Event('turbo:load'));
  await waitFor(() => page.control() && !page.control().disabled, 'New PR control did not recover after cancellation');
  await delay(40);
  assert.deepEqual(page.states(), [false, false, false], 'Old batch changed files on the new PR');
  assert.equal(page.document.querySelector('#viewed-state-error'), null, 'Old PR error leaked into new PR');
  page.control().click();
  await waitFor(() => page.states().every(Boolean), 'New PR could not be updated after cancellation');
});

test('reports a GitHub state update that never acknowledges instead of showing success', async (t) => {
  const page = setup(t, modernPage([false, false, false]));
  await waitFor(() => page.control(), 'React control missing');
  page.document.addEventListener('click', (event) => {
    if (event.target.matches('button[class*="MarkAsViewedButton"]')) event.stopImmediatePropagation();
  }, true);
  // Exercise the real timeout branch without waiting five seconds in the test.
  const setTimeout = page.window.setTimeout.bind(page.window);
  page.window.setTimeout = (callback, ms, ...args) => setTimeout(callback, ms === 5000 ? 40 : ms, ...args);
  page.control().click();
  await waitFor(() => page.document.querySelector('#viewed-state-error'), 'Missing acknowledgement was silently treated as success');
  await waitFor(() => !page.control().disabled, 'Aggregate control did not recover after timeout');
  assert.deepEqual(page.states(), [false, false, false]);
  assert.equal(page.control().checked, false);
  assert.match(page.document.querySelector('#viewed-state-error').textContent, /did not update/);
});

for (const classic of [false, true]) {
  test(`patterns scope the complete viewed/unviewed/restore cycle on ${classic ? 'classic' : 'React'} pages`, async t => {
    const html = classic ? classicPage([true, false, true]) : modernPage([true, false, true]);
    const page = setup(t, html, undefined, { patterns: { include: '**/file-?.js', exclude: '**/file-2.js' }, rerender: !classic });
    await waitFor(() => page.control(), 'Filtered control missing');
    assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Matching Files (2)');
    for (const expected of [[true, true, true], [false, false, true], [true, false, true]]) {
      page.control().click();
      await waitFor(() => JSON.stringify(page.states()) === JSON.stringify(expected), 'A nonmatching file changed or a matching file was missed');
      await waitFor(() => !page.control().disabled, 'Filtered batch stayed busy');
    }
  });
}

test('live settings changes, reset, missing paths, and no matches update the control safely', async t => {
  const page = setup(t, modernPage([false, false, false]));
  await waitFor(() => page.control(), 'Control missing');
  page.setPatterns({ include: '**/*.test.js', exclude: '' });
  await waitFor(() => page.control().disabled, 'No-match control should be disabled');
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Matching Files (0)');
  page.document.querySelector('#diff-0').removeAttribute('aria-label');
  page.document.querySelector('#diff-0 a').remove();
  page.setPatterns({ include: '**/*.js', exclude: '' });
  await waitFor(() => !page.control().disabled, 'Live settings did not apply');
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Matching Files (2)');
  page.control().click();
  await waitFor(() => JSON.stringify(page.states()) === '[false,true,true]', 'Unknown path was changed');
  await waitFor(() => !page.control().disabled, 'Batch stayed busy');
  page.setPatterns(undefined);
  await waitFor(() => page.document.querySelector('#viewed-state-label').textContent === 'Mark All Files', 'Reset did not restore default scope');
  assert.equal(page.document.querySelector('#viewed-state-settings').textContent, 'Settings');
});

test('storage errors and invalid settings disable bulk updates until repaired', async t => {
  const page = setup(t, modernPage([false, false, false]), undefined, { storageError: 'Storage unavailable' });
  await waitFor(() => page.control(), 'Control missing');
  assert.equal(page.control().disabled, true);
  assert.match(page.control().title, /Storage unavailable/);
  page.setPatterns({ include: 123, exclude: '' });
  await delay(20);
  assert.equal(page.control().disabled, true);
  assert.match(page.control().title, /invalid/);
  page.setPatterns({ include: '', exclude: '**/file-1.js' });
  await waitFor(() => !page.control().disabled, 'Repaired settings did not recover');
  page.control().click();
  await waitFor(() => JSON.stringify(page.states()) === '[true,false,true]', 'Exclude-only scope failed');
});

test('settings scope is retained when the toolbar rerenders and another PR opens', async t => {
  const page = setup(t, modernPage([false, false, false]), undefined, { patterns: { include: '**/file-1.js', exclude: '' } });
  await waitFor(() => page.control(), 'Control missing');
  page.document.querySelector('.d-flex').outerHTML = toolbar();
  await waitFor(() => page.control(), 'Control missing after toolbar rerender');
  assert.equal(page.document.querySelectorAll('#viewed-state-settings').length, 1);
  page.window.history.pushState({}, '', '/org/repo/pull/99/files');
  page.document.body.innerHTML = modernPage([false, false, false]);
  page.document.dispatchEvent(new page.window.Event('turbo:load'));
  await waitFor(() => page.control(), 'Control missing on new PR');
  page.control().click();
  await waitFor(() => JSON.stringify(page.states()) === '[false,true,false]', 'Settings lost on navigation');
});

test('multiple buttons have independent scopes and keep overlapping button states synchronized', async t => {
  const page = setup(t, modernPage([false, false, false]), undefined, { rerender: true, patterns: { buttons: [
    { id: 'tests', name: 'Tests', include: '**/file-0.js\n**/file-1.js', exclude: '' },
    { id: 'docs', name: 'Docs', include: '**/file-1.js\n**/file-2.js', exclude: '' },
  ] } });
  await waitFor(() => page.control(), 'Buttons missing');
  const docs = () => page.document.querySelector('#viewed-state-checkbox-docs');
  assert.equal(page.document.querySelectorAll('#viewed-state-controls input').length, 2);
  page.control().click();
  assert.equal(docs().disabled, true, 'Sibling button allowed concurrent batches');
  await waitFor(() => !page.control().disabled, 'Tests batch stayed busy');
  assert.deepEqual(page.states(), [true, true, false]);
  assert.equal(docs().indeterminate, true);
  docs().click();
  await waitFor(() => !docs().disabled, 'Docs batch stayed busy');
  assert.deepEqual(page.states(), [true, true, true]);
  assert.equal(page.control().checked, true);
  page.control().click();
  await waitFor(() => !page.control().disabled, 'Tests unview batch stayed busy');
  assert.deepEqual(page.states(), [false, false, true]);
  assert.equal(docs().indeterminate, true);
  page.setPatterns({ buttons: [{ id: 'docs', name: 'Documentation', include: '**/file-2.js', exclude: '' }] });
  await waitFor(() => page.document.querySelectorAll('#viewed-state-controls input').length === 1, 'Removed button stayed mounted');
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Documentation (1)');
  page.setPatterns({ buttons: [] });
  await waitFor(() => !page.control(), 'Empty configuration still shows a button');
  assert.ok(page.document.querySelector('#viewed-state-settings'), 'Settings must remain accessible with no buttons');
});

test('settings changes during a batch apply to the next action without expanding its targets', async t => {
  const page = setup(t, modernPage([false, false, false]), undefined, { rerender: true, patterns: { include: '**/file-0.js', exclude: '' } });
  await waitFor(() => page.control(), 'Button missing');
  page.control().click();
  page.setPatterns({ include: '**/*.js', exclude: '' });
  await waitFor(() => !page.control().disabled, 'Batch stayed busy');
  assert.deepEqual(page.states(), [true, false, false]);
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark Matching Files (3)');
});

// Structure derived from GitHub's DiffUnmemoized and DiffFileHeader renderer:
// https://github.githubassets.com/assets/ux-3d12fe8ed63c00d2.js
// https://github.githubassets.com/assets/jf-a46481f0216cad9e.js
function currentGitHubFile(name, index, checked) {
  return `<section role="region" id="diff-${index}" aria-labelledby="heading-${index}" class="Diff-module__diff__rx9XH"><div data-diff-header-wrapper><h3 id="heading-${index}"><a href="#diff-${index}"><code>\u200e${name}\u200e</code></a></h3><button class="MarkAsViewedButton-module__iconOnly__kEP4e" aria-pressed="${checked}">Viewed</button></div></section>`;
}

for (const route of ['files', 'changes']) {
  test(`second Tests button recognizes current GitHub headers on /${route}`, async t => {
    const names = [
      'src/mail/send.test.ts',
      'src/orders/finalize.test.ts',
      'src/orders/log.test.ts',
      'src/orders/utils/project.test.ts',
      'src/orders/processing.ts',
    ];
    const page = setup(t, toolbar() + names.map((name, index) => currentGitHubFile(name, index, false)).join(''), `/org/repo/pull/3247/${route}`, { rerender: true, patterns: { buttons: [
      { id: 'all', name: 'All Files', include: '', exclude: '' },
      { id: 'tests', name: 'Tests', include: '**/*.test.*', exclude: '' },
    ] } });
    await waitFor(() => page.control(), 'Buttons missing');
    const tests = () => page.document.querySelector('#viewed-state-checkbox-tests');
    assert.equal(tests().nextElementSibling.textContent, 'Mark Tests (4)');
    assert.equal(tests().disabled, false);
    tests().nextElementSibling.click();
    await waitFor(() => JSON.stringify(page.states()) === '[true,true,true,true,false]', 'Matching tests were missed or production file changed');
    await waitFor(() => !tests().disabled, 'Tests batch stayed busy');
    tests().click();
    await waitFor(() => JSON.stringify(page.states()) === '[false,false,false,false,false]', 'Tests did not unmark');
  });
}

test('current header paths preserve exclusions and leave ambiguous or unrelated text untouched', async t => {
  const html = toolbar()
    + currentGitHubFile('root.test.ts', 0, false)
    + currentGitHubFile('fixtures/data.test.ts', 1, false)
    + currentGitHubFile('src/main.ts', 2, false)
    + currentGitHubFile('src/renamed.test.ts', 3, false).replace('<code>\u200esrc/renamed.test.ts\u200e</code>', '<code><span aria-hidden="true">old.ts → renamed.test.ts</span><span class="sr-only">old.ts renamed to renamed.test.ts </span></code>');
  const page = setup(t, html, undefined, { patterns: { include: '**/*.test.*', exclude: '**/fixtures/**' } });
  page.document.querySelector('#diff-2').insertAdjacentHTML('beforeend', '<pre><code>src/unrelated.test.ts</code></pre>');
  await waitFor(() => page.control(), 'Button missing');
  assert.equal(page.control().nextElementSibling.textContent, 'Mark Matching Files (1)');
  page.control().click();
  await waitFor(() => JSON.stringify(page.states()) === '[true,false,false,false]', 'Exclusion or unknown-path safety failed');
  await waitFor(() => !page.control().disabled, 'Batch stayed busy');
  page.setPatterns({ include: '**/*.spec.*', exclude: '' });
  await waitFor(() => page.control().disabled, 'Zero-target button was enabled');
  assert.match(page.control().title, /No matching loaded files.*Could not read paths for 1 loaded file\./);
  assert.equal(page.control().parentElement.title, page.control().title, 'Disabled input needs a tooltip on its label');
});

// Progress markup captured from the reported GitHub page on 2026-10-19.
function accessibleToolbar(total = 7) {
  return `<div id="review-toolbar"><div class="hide-viewed-progress-on-small__u9jCpF"><span aria-hidden="true" class="ProgressContainer__b1ofBm"><span>0</span> / <span>${total}</span> <span>viewed</span></span><span class="sr-only">0 of ${total} files viewed</span></div><div><button>Submit review</button></div></div>`;
}

function accessibleFiles() {
  return ['src/first.test.js', 'src/main.js', 'src/last.test.js'].map((name, index) => currentGitHubFile(name, index, false)
    .replace('class="MarkAsViewedButton-module__iconOnly__kEP4e"', 'class="completely-new-class" aria-label="Not Viewed"')).join('');
}

for (const route of ['files', 'changes']) {
  test(`uses accessible progress and Viewed labels after GitHub class changes on /${route}`, async t => {
    const page = setup(t, accessibleToolbar() + accessibleFiles(), `/org/repo/pull/1007/${route}`, { rerender: true });
    await waitFor(() => page.control(), 'Controls missing with captured GitHub markup');
    assert.equal(page.control().nextElementSibling.textContent, 'Mark Loaded Files');
    const ownedToolbar = page.document.querySelector('#viewed-state-toolbar');
    assert.equal(ownedToolbar.parentElement.id, 'review-toolbar');
    assert.equal(ownedToolbar.closest('[class*="hide-viewed-progress"]'), null, 'Tools must stay outside the responsive progress wrapper');
    page.control().click();
    await waitFor(() => page.states().every(Boolean), 'Accessible Viewed controls did not update');
    await waitFor(() => !page.control().disabled, 'Batch stayed busy');
    page.setPatterns({ include: '**/*.test.js', exclude: '' });
    await waitFor(() => page.control().nextElementSibling.textContent === 'Mark Matching Files (2)', 'Custom scope lost');
    page.control().click();
    await waitFor(() => JSON.stringify(page.states()) === '[false,true,false]', 'Nonmatching file was changed');
  });
}

test('class-free progress, nested wrappers, and toolbar replacement retain one set of controls', async t => {
  const html = accessibleToolbar(3).replaceAll(/ class="[^"]*"/g, '');
  const page = setup(t, html + accessibleFiles());
  await waitFor(() => page.control(), 'Controls depend on progress CSS classes');
  assert.equal(page.control().nextElementSibling.textContent, 'Mark All Files');
  const replacement = html.replace('0 of 3 files viewed', '0 of 7 files viewed').replace('<span>3</span>', '<span>7</span>');
  page.document.querySelector('#review-toolbar').outerHTML = replacement;
  await waitFor(() => page.control()?.nextElementSibling.textContent === 'Mark Loaded Files', 'Toolbar replacement lost the progress count');
  assert.equal(page.document.querySelectorAll('#viewed-state-toolbar').length, 1);
  assert.equal(page.document.querySelectorAll('#viewed-state-settings').length, 1);
});

test('missing toolbar anchors leave usable independent tools and unknown totals stay conservative', async t => {
  const page = setup(t, accessibleFiles());
  await waitFor(() => page.control(), 'Tools disappeared when GitHub toolbar could not be identified');
  assert.equal(page.control().nextElementSibling.textContent, 'Mark Loaded Files');
  assert.equal(page.document.querySelector('#viewed-state-toolbar').dataset.placement, 'floating');
  assert.ok(page.document.querySelector('#viewed-state-settings'));
  page.control().click();
  await waitFor(() => page.states().every(Boolean), 'Independent controls are unusable');
  page.document.body.insertAdjacentHTML('afterbegin', accessibleToolbar(3));
  await waitFor(() => page.document.querySelector('#viewed-state-toolbar').parentElement.id === 'review-toolbar', 'Tools did not return to the toolbar');
  assert.equal(page.document.querySelector('#viewed-state-toolbar').dataset.placement, 'inline');
  assert.equal(page.document.querySelectorAll('#viewed-state-toolbar').length, 1);
  page.window.history.pushState({}, '', '/org/repo/pull/1007');
  page.document.dispatchEvent(new page.window.Event('turbo:load'));
  await waitFor(() => !page.document.querySelector('#viewed-state-toolbar'), 'Independent tools leaked outside the diff route');
});

test('file content imitating progress or Submit review is not a toolbar anchor', async t => {
  const page = setup(t, accessibleFiles());
  page.document.querySelector('#diff-0').insertAdjacentHTML('beforeend', '<pre><span>0 of 999 files viewed</span><button>Submit review</button></pre>');
  await waitFor(() => page.control(), 'Independent toolbar missing');
  assert.equal(page.document.querySelector('#viewed-state-toolbar').dataset.placement, 'floating');
  assert.equal(page.control().nextElementSibling.textContent, 'Mark Loaded Files');
  assert.equal(page.document.querySelector('pre #viewed-state-toolbar'), null);
});

test('ARIA progress metadata and labelled file headings survive changed tags and header attributes', async t => {
  const html = '<div role="toolbar" aria-label="Pull request review"><div role="progressbar" aria-label="Files viewed" aria-valuemax="7"></div><button aria-label="Submit review">Review</button></div>';
  const page = setup(t, html + accessibleFiles().replaceAll(' data-diff-header-wrapper', ''), undefined, { patterns: { include: '**/*.test.js', exclude: '' } });
  await waitFor(() => page.control(), 'ARIA toolbar missing');
  assert.equal(page.document.querySelector('#viewed-state-toolbar').dataset.placement, 'inline');
  assert.equal(page.control().nextElementSibling.textContent, 'Mark Matching Files (2)');
  page.control().click();
  await waitFor(() => JSON.stringify(page.states()) === '[true,false,true]', 'Labelled headings did not preserve filtered paths');
  await waitFor(() => !page.control().disabled, 'Batch stayed busy');
  page.setPatterns(undefined);
  await waitFor(() => page.control().nextElementSibling.textContent === 'Mark Loaded Files', 'ARIA total was ignored');
  page.document.querySelector('[role="progressbar"]').setAttribute('aria-valuemax', '3');
  await waitFor(() => page.control().nextElementSibling.textContent === 'Mark All Files', 'ARIA progress updates were ignored');
});

function placement(page, mode) {
  const select = page.document.querySelector('#viewed-state-placement');
  select.value = mode;
  select.dispatchEvent(new page.window.Event('change', { bubbles: true }));
}

test('floating mode stays chosen when GitHub replaces its header; Header resets it', async t => {
  const page = setup(t, modernPage());
  const saved = [];
  page.window.chrome.storage.local.set = async value => saved.push(value);
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'floating');
  await waitFor(() => page.document.querySelector('#viewed-state-toolbar').parentElement === page.document.body, 'Floating tools not mounted in body');
  page.document.querySelector('.d-flex').outerHTML = toolbar();
  await delay(30);
  assert.equal(page.document.querySelector('#viewed-state-toolbar').dataset.placement, 'floating');
  assert.equal(saved.at(-1).reviewToolbarPlacement.mode, 'floating');
  placement(page, 'header');
  await waitFor(() => page.document.querySelector('.d-flex > #viewed-state-toolbar'), 'Header reset failed');
});

test('review dialogs hide tools and closing them restores the controls', async t => {
  const page = setup(t, modernPage());
  await waitFor(() => page.control(), 'Tools missing');
  const tools = page.document.querySelector('#viewed-state-toolbar');
  const modal = page.document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = '<button>Submit review</button>';
  page.document.body.append(modal);
  await waitFor(() => tools.hidden, 'Toolbar overlaps review dialog');
  modal.hidden = true;
  await waitFor(() => !tools.hidden, 'Toolbar did not return');
  const dialog = page.document.createElement('dialog');
  page.document.body.append(dialog);
  dialog.setAttribute('open', '');
  await waitFor(() => tools.hidden, 'Native dialog not detected');
  dialog.removeAttribute('open');
  await waitFor(() => !tools.hidden, 'Native dialog close not detected');
});

test('keyboard movement clamps to viewport and reports persistence failure', async t => {
  const page = setup(t, modernPage());
  page.window.chrome.storage.local.set = async () => { throw new Error('disk full'); };
  await waitFor(() => page.control(), 'Tools missing');
  const handle = page.document.querySelector('#viewed-state-drag');
  handle.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  const tools = page.document.querySelector('#viewed-state-toolbar');
  assert.equal(tools.style.left, '8px');
  assert.equal(tools.parentElement, page.document.body);
  await waitFor(() => page.document.querySelector('#viewed-state-placement-status').textContent.includes('disk full'), 'Save error not visible');
});

test('chosen page container survives replacement and falls back if removed', async t => {
  const page = setup(t, modernPage() + '<aside id="custom-place"><p>Dock here</p></aside>');
  const saved = [];
  page.window.chrome.storage.local.set = async value => saved.push(value);
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'custom');
  page.document.querySelector('#custom-place p').click();
  await waitFor(() => page.document.querySelector('#custom-place > #viewed-state-toolbar'), 'Custom dock failed');
  assert.equal(saved.at(-1).reviewToolbarPlacement.mode, 'custom');
  page.document.querySelector('#custom-place').outerHTML = '<aside id="custom-place"><p>Replacement</p></aside>';
  await waitFor(() => page.document.querySelector('#custom-place > #viewed-state-toolbar'), 'Custom dock did not recover from replacement');
  page.document.querySelector('#custom-place').remove();
  await waitFor(() => page.document.querySelector('#viewed-state-toolbar')?.dataset.placement === 'floating', 'Missing custom dock did not fall back');
});

test('Escape cancels docking without consuming subsequent page clicks', async t => {
  const page = setup(t, modernPage() + '<aside><button id="native-action">Action</button></aside>');
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'custom');
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  let clicked = false;
  page.document.querySelector('#native-action').addEventListener('click', () => { clicked = true; });
  page.document.querySelector('#native-action').click();
  assert.equal(clicked, true);
  await delay(20);
  assert.equal(page.document.querySelector('#viewed-state-placement').value, 'header');
});

test('saved floating placement restores after reload without changing button settings', async t => {
  const page = setup(t, modernPage(), undefined, { placementPreference: { mode: 'floating', x: 140, y: 160 } });
  await waitFor(() => page.control(), 'Tools missing');
  const tools = page.document.querySelector('#viewed-state-toolbar');
  assert.equal(tools.parentElement, page.document.body);
  assert.equal(tools.style.left, '140px');
  assert.equal(tools.style.top, '160px');
  assert.equal(page.document.querySelector('#viewed-state-label').textContent, 'Mark All Files');
});

test('drag captures after reparenting, Shift drop docks, and cancellation restores preference', async t => {
  const page = setup(t, modernPage() + '<aside id="custom-place"><p>Dock here</p></aside>');
  page.window.chrome.storage.local.set = async () => {};
  await waitFor(() => page.control(), 'Tools missing');
  const tools = page.document.querySelector('#viewed-state-toolbar');
  const handle = page.document.querySelector('#viewed-state-drag');
  handle.setPointerCapture = () => assert.equal(tools.parentElement, page.document.body, 'Capture must follow reparenting');
  page.document.elementsFromPoint = () => [page.document.querySelector('#custom-place p')];
  const pointer = (name, options = {}) => {
    const event = new page.window.MouseEvent(name, { bubbles: true, clientX: 100, clientY: 100, ...options });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    handle.dispatchEvent(event);
  };
  pointer('pointerdown');
  pointer('pointermove', { clientX: 250, clientY: 200, shiftKey: true });
  assert.ok(page.document.querySelector('#custom-place').hasAttribute('data-review-dock-target'));
  pointer('pointerup', { shiftKey: true });
  await waitFor(() => tools.parentElement.id === 'custom-place', 'Shift drop failed');
  pointer('pointerdown');
  pointer('pointermove', { clientX: 400 });
  pointer('pointercancel');
  page.document.dispatchEvent(new page.window.Event('change'));
  await waitFor(() => tools.parentElement.id === 'custom-place', 'Cancelled drag did not restore docking');
  assert.equal(page.document.querySelector('[data-review-dock-target]'), null);
});

test('Review changes header anchors tools even without a visible progress count', async t => {
  const page = setup(t, '<div id="review-actions"><button>Review changes</button></div>' + modernPage().replace(toolbar(), ''));
  await waitFor(() => page.control(), 'Tools missing');
  assert.equal(page.document.querySelector('#viewed-state-toolbar').parentElement.id, 'review-actions');
});

test('docking confirmation clears after five seconds without moving the toolbar', async t => {
  const page = setup(t, modernPage() + '<aside id="custom-place"><p>Dock here</p></aside>');
  page.window.chrome.storage.local.set = async () => {};
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'custom');
  page.document.querySelector('#custom-place p').click();
  const status = page.document.querySelector('#viewed-state-placement-status');
  assert.equal(status.textContent, 'Toolbar docked. Choose Header to reset.');
  await delay(5200);
  assert.equal(status.textContent, '');
  assert.equal(page.document.querySelector('#viewed-state-toolbar').parentElement.id, 'custom-place');
});

test('new docking instructions and save errors survive an older confirmation timer', async t => {
  const page = setup(t, modernPage() + '<aside id="custom-place"><p>Dock here</p></aside>');
  page.window.chrome.storage.local.set = async () => {};
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'custom');
  page.document.querySelector('#custom-place p').click();
  placement(page, 'custom');
  const status = page.document.querySelector('#viewed-state-placement-status');
  await delay(5200);
  assert.equal(status.textContent, 'Select a page container to dock here. Press Escape to cancel.');
  placement(page, 'header');
  await waitFor(() => page.document.querySelector('.d-flex > #viewed-state-toolbar'), 'Header reset failed');
  page.window.chrome.storage.local.set = async () => { throw new Error('disk full'); };
  placement(page, 'custom');
  page.document.querySelector('#custom-place p').click();
  await waitFor(() => status.textContent.includes('disk full'), 'Save error missing');
  await delay(5200);
  assert.match(status.textContent, /disk full/);
});

test('custom placement saved by docking restores on a fresh page', async t => {
  const html = modernPage() + '<aside id="custom-place"><p>Dock here</p></aside>';
  const page = setup(t, html);
  let saved;
  page.window.chrome.storage.local.set = async value => { saved = value.reviewToolbarPlacement; };
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'custom');
  page.document.querySelector('#custom-place p').click();
  await waitFor(() => saved, 'Placement not saved');
  const restored = setup(t, html, undefined, { placementPreference: saved });
  await waitFor(() => restored.document.querySelector('#custom-place > #viewed-state-toolbar'), 'Saved custom placement not restored');
  assert.equal(restored.document.querySelector('#viewed-state-placement-status').textContent, '');
});

test('docking inside the header restores without counting the injected toolbar as page structure', async t => {
  const html = '<header id="review-header"><span>0 / 3 viewed</span><button>Submit review</button><div><p>Dock here</p></div></header>'
    + modernFile('src/file.js', 0, false);
  const page = setup(t, html);
  let saved;
  page.window.chrome.storage.local.set = async value => { saved = value.reviewToolbarPlacement; };
  await waitFor(() => page.control(), 'Tools missing');
  placement(page, 'custom');
  page.document.querySelector('#review-header > div > p').click();
  await waitFor(() => saved, 'Placement not saved');
  const restored = setup(t, html, undefined, { placementPreference: saved, placementLoadDelay: 50 });
  await waitFor(() => restored.document.querySelector('#review-header > div > #viewed-state-toolbar'), 'Saved location points to the injected toolbar instead of its dock container');
});

test('saved custom dock follows other PRs and restores after a missing container returns', async t => {
  const html = modernPage() + '<aside id="custom-place"><p>Dock here</p></aside>';
  const page = setup(t, html, '/other/repo/pull/42/files', {
    placementPreference: { mode: 'custom', selector: '#custom-place', path: '/Hikyo-Org/Hikyo/pull/858/changes' },
  });
  await waitFor(() => page.document.querySelector('#custom-place > #viewed-state-toolbar'), 'Dock was restricted to its original PR route');
  page.document.querySelector('#custom-place').remove();
  await waitFor(() => page.document.querySelector('#viewed-state-toolbar')?.dataset.placement === 'floating', 'Missing container did not fall back');
  page.window.history.pushState({}, '', '/another/repo/pull/99/changes');
  const container = page.document.createElement('aside');
  container.id = 'custom-place';
  page.document.body.append(container);
  await waitFor(() => container.querySelector('#viewed-state-toolbar'), 'Dock did not return on another PR');
});
