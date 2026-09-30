const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../extension');

function environment() {
  const listeners = new Map();
  const attributes = new Map();
  class XHR { open() {} send() {} setRequestHeader() {} }
  const sandbox = {
    URL, URLSearchParams, Headers, Request, Response, FormData,
    location: new URL('https://app.slack.com/client/TTEST00001/CTEST00001'),
    XMLHttpRequest: XHR,
    MutationObserver: class { observe() {} },
    NodeFilter: { SHOW_TEXT: 4 },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval() {},
    document: {
      documentElement: { setAttribute: (name, value) => attributes.set(name, value) },
      addEventListener() {},
      querySelectorAll: () => []
    },
    chrome: {
      storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } },
      runtime: { id: 'fixture-extension', onMessage: { addListener() {} }, sendMessage: async () => ({ ok: true }) }
    },
    fetch: async () => new Response('{"ok":true}')
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type, listener) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(listener);
  };
  sandbox.postMessage = data => {
    for (const listener of listeners.get('message') || []) {
      listener({ data, source: sandbox, origin: sandbox.location.origin });
    }
  };
  const context = vm.createContext(sandbox);
  // Events crossing into a VM need its window identity, not the outer sandbox.
  const pageWindow = vm.runInContext('window', context);
  sandbox.postMessage = data => {
    for (const listener of listeners.get('message') || []) {
      listener({ data, source: pageWindow, origin: sandbox.location.origin });
    }
  };
  return { context, attributes };
}

for (const order of [['content.js', 'bridge.js'], ['bridge.js', 'content.js']]) {
  test(`startup without shared helper: ${order.join(' then ')}`, async () => {
    const { context, attributes } = environment();
    assert.equal(vm.runInContext('globalThis.__SVNCore', context), undefined);
    for (const file of order) vm.runInContext(readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    await new Promise(resolve => setImmediate(resolve));
    const state = JSON.parse(attributes.get('data-slack-unslop'));
    assert.equal(state.team, 'TTEST00001');
    assert.equal(state.version, '0.1.1');
    assert.equal(state.bridgeReady, true);
    assert.equal(state.state, 'waiting-session');
    assert.equal(vm.runInContext('globalThis.__SVNCore', context), undefined);
  });
}
