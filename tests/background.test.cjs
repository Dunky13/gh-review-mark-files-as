const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

test('toolbar and extension icon open Options through the worker and report failures', async () => {
  let messageListener;
  let actionListener;
  let calls = 0;
  let failure = false;
  const context = vm.createContext({ console, chrome: {
    action: { onClicked: { addListener: listener => { actionListener = listener; } } },
    runtime: {
      id: 'extension-id',
      onMessage: { addListener: listener => { messageListener = listener; } },
      openOptionsPage: async () => { calls++; if (failure) throw new Error('Options unavailable'); },
    },
  } });
  vm.runInContext(readFileSync('background.js', 'utf8'), context);
  actionListener();
  assert.equal(calls, 1);
  const request = { type: 'open-file-review-settings' };
  let response;
  assert.equal(messageListener(request, { id: 'other-extension' }, value => { response = value; }), undefined);
  assert.equal(calls, 1);
  assert.equal(messageListener(request, { id: 'extension-id' }, value => { response = value; }), true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(response.opened, true);
  failure = true;
  messageListener(request, { id: 'extension-id' }, value => { response = value; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(response.opened, false);
  assert.equal(response.error, 'Options unavailable');
});
