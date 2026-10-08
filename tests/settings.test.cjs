const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const vm = require('node:vm');
const source = readFileSync('settings.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const { compile } = context.reviewFileSettings;

test('glob patterns match root and nested tests with exclusion precedence and literal punctuation', () => {
  const filter = compile({ include: '**/*.test.*\r\n **/tests/**\n\n', exclude: '**/fixtures/**' });
  for (const path of ['foo.test.js', 'src/foo.test.ts', 'tests/unit/a.js', 'pkg/tests/a.py']) assert.equal(filter.matches(path), true, path);
  for (const path of ['src/main.js', 'tests/fixtures/data.test.js', 'foo.TEST.js']) assert.equal(filter.matches(path), false, path);
  const exact = compile({ include: '/src/[sample](1)+.js', exclude: '' });
  assert.equal(exact.matches('src/[sample](1)+.js'), true);
  assert.equal(exact.matches('src/sample1.js'), false);
  const star = compile({ include: 'src/*.js', exclude: '' });
  assert.equal(star.matches('src/a.js'), true);
  assert.equal(star.matches('src/nested/a.js'), false);
});

async function options(t, { stored, failure } = {}) {
  const dom = new JSDOM(readFileSync('options.html', 'utf8'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const writes = [];
  dom.window.chrome = { storage: { local: {
    get: async () => ({ filePatterns: stored }),
    set: async value => { if (failure) throw new Error(failure); writes.push(value.filePatterns); },
  } } };
  dom.window.eval(source);
  dom.window.eval(readFileSync('options.js', 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 0));
  return { document: dom.window.document, window: dom.window, writes };
}

test('options load, save, and reset persistent patterns', async t => {
  const page = await options(t, { stored: { buttons: [{ id: 'tests', name: 'Tests', include: '**/*.test.*', exclude: '**/fixtures/**' }] } });
  const include = page.document.querySelector('[name=include]');
  assert.equal(include.value, '**/*.test.*');
  include.value = '**/tests/**';
  page.document.querySelector('form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.writes[0].buttons[0].include, '**/tests/**');
  assert.match(page.document.querySelector('#status').textContent, /Settings saved/);
  page.document.querySelector('#reset').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.writes[1].buttons[0].include, '');
  assert.equal(page.writes[1].buttons[0].exclude, '');
  assert.equal(page.document.querySelector('[name=include]').value, '');
});

test('options show save failures and let malformed stored settings be repaired', async t => {
  const page = await options(t, { stored: { include: null }, failure: 'Disk full' });
  assert.match(page.document.querySelector('#status').textContent, /invalid/);
  page.document.querySelector('#add').click();
  page.document.querySelector('[name=name]').value = 'Tests';
  page.document.querySelector('[name=include]').value = '**/*.test.*';
  page.document.querySelector('form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(page.document.querySelector('#status').textContent, /Could not save settings: Disk full/);
  assert.equal(page.document.querySelector('fieldset').disabled, false);
  assert.equal(page.writes.length, 0);
});

test('options add, name, save and remove independent buttons', async t => {
  const page = await options(t);
  page.document.querySelector('#add').click();
  const cards = page.document.querySelectorAll('.button-settings');
  assert.equal(cards.length, 2);
  cards[1].querySelector('[name=name]').value = 'Tests';
  cards[1].querySelector('[name=include]').value = '**/*.test.*';
  cards[1].querySelector('[name=exclude]').value = '**/fixtures/**';
  page.document.querySelector('form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.writes[0].buttons.length, 2);
  assert.equal(page.writes[0].buttons[1].name, 'Tests');
  assert.equal(page.writes[0].buttons[1].include, '**/*.test.*');
  page.document.querySelectorAll('.remove')[0].click();
  page.document.querySelector('form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.writes[1].buttons.length, 1);
  assert.equal(page.writes[1].buttons[0].name, 'Tests');
});

test('settings reject duplicate IDs and blank names and allow an explicitly empty list', () => {
  const { normalize, defaults } = context.reviewFileSettings;
  assert.throws(() => normalize({ buttons: [defaults.buttons[0], defaults.buttons[0]] }), /unique ID/);
  assert.throws(() => normalize({ buttons: [{ ...defaults.buttons[0], name: ' ' }] }), /name/);
  assert.equal(normalize({ buttons: [] }).buttons.length, 0);
});

test('individual pattern rows load existing lines, add and remove with focus, and save independently', async t => {
  const page = await options(t, { stored: { buttons: [{ id: 'tests', name: 'Tests', include: '**/*.test.*\r\n**/tests/**', exclude: '**/fixtures/**\n**/generated/**' }] } });
  const group = page.document.querySelector('.pattern-group');
  const inputs = () => Array.from(group.querySelectorAll('input'));
  assert.deepEqual(inputs().map(input => input.value), ['**/*.test.*', '**/tests/**']);
  assert.equal(page.document.querySelectorAll('textarea').length, 0);
  group.querySelector('.add-pattern').click();
  assert.equal(inputs().length, 3);
  assert.equal(page.document.activeElement, inputs()[1]);
  inputs()[1].value = ' **/*.spec.* ';
  group.querySelector('.remove-pattern').click();
  assert.equal(page.document.activeElement, inputs()[0]);
  assert.deepEqual(inputs().map(input => input.value), [' **/*.spec.* ', '**/tests/**']);
  assert.equal(group.querySelector('.remove-pattern').getAttribute('aria-label'), 'Remove include pattern 1');
  const ids = Array.from(page.document.querySelectorAll('input'), input => input.id);
  assert.equal(new Set(ids).size, ids.length);
  page.document.querySelector('form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.writes[0].buttons[0].include, '**/*.spec.*\n**/tests/**');
  assert.equal(page.writes[0].buttons[0].exclude, '**/fixtures/**\n**/generated/**');
});

test('removing the last pattern leaves an editable blank field and saves an empty scope', async t => {
  const page = await options(t, { stored: { buttons: [{ id: 'tests', name: 'Tests', include: '**/*.test.*', exclude: '' }] } });
  const group = page.document.querySelector('.pattern-group');
  group.querySelector('.remove-pattern').click();
  const input = group.querySelector('input');
  assert.equal(group.querySelectorAll('input').length, 1);
  assert.equal(input.value, '');
  assert.equal(page.document.activeElement, input);
  group.querySelector('.add-pattern').click();
  group.querySelector('.add-pattern').click();
  const last = group.querySelector('.pattern-row:last-child');
  last.querySelector('.remove-pattern').click();
  assert.equal(page.document.activeElement, group.querySelector('.pattern-row:last-child input'));
  page.document.querySelector('form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.writes[0].buttons[0].include, '');
  assert.equal(page.writes[0].buttons[0].exclude, '');
});

test('repeated wildcards avoid exponential backtracking and retain folder boundary semantics', () => {
  assert.equal(compile({ include: '*a'.repeat(40) + 'b', exclude: '' }).matches('a'.repeat(300)), false);
  assert.equal(compile({ include: '*a'.repeat(40) + 'b', exclude: '' }).matches('a'.repeat(300) + 'b'), true);
  const nested = compile({ include: '**/src/**/a?.js', exclude: '' });
  assert.equal(nested.matches('src/a1.js'), true);
  assert.equal(nested.matches('pkg/src/nested/a2.js'), true);
  assert.equal(nested.matches('pkg/src/a/b.js'), false);
  assert.equal(nested.matches('othersrc/a1.js'), false);
});
