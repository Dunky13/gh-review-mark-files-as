const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

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

function setup(t, html, route = '/Hikyo-Org/Hikyo/pull/858/changes', { rerender = false, iconOnly = false } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM(html, { url: `https://github.com${route}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const clicks = [];
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[class*="MarkAsViewedButton-module__"]');
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
  dom.window.eval(source);
  return {
    document, window: dom.window, errors, clicks,
    control: () => document.querySelector('#viewed-state-checkbox'),
    states: () => Array.from(document.querySelectorAll('input.js-reviewed-checkbox, button[class*="MarkAsViewedButton-module__"]'), (node) => node.tagName === 'INPUT' ? node.checked : iconOnly ? !!node.querySelector('.octicon-checkbox-fill') : node.getAttribute('aria-pressed') === 'true'),
  };
}

for (const route of ['files', 'changes']) {
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
  await waitFor(() => page.control(), 'Control missing after delayed DOM insertion');
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
