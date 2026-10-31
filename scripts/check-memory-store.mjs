import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, ...globals });
  return module.exports;
}
const forms = load('../src/app/lib/superformula.ts');
const key = 'nijimu.memories.v1';
const storage = new Map();
let blocked = false;
const sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => {
    if (blocked) throw new Error('QuotaExceededError');
    storage.set(key, value);
  },
};
const restore = () => load('../src/app/lib/memoryStore.ts', {
  sessionStorage,
  localStorage: { removeItem: () => {} },
  require: name => { assert.equal(name, './superformula'); return forms; },
});
const plain = value => JSON.parse(JSON.stringify(value));
const memory = {
  id: 'guest-memory', title: 'Summer', year: '2026', transcript: 'A complete memory.\nWith another paragraph.',
  highlightedWords: ['Summer'], createdAt: '2026-10-10T12:00:00Z', colorIndex: 3,
  shape: { form: forms.createArtifactForm({ seed: 'session-test', category: 'flower' }),
    matPresetIndex: 2, fluidity: .3, evolve: .8, bumpAmount: .1 },
  look: { photoUrl: 'data:image/png;base64,cGhvdG8=', oklch: { l: .8, c: .12, h: 210 }, vividness: .7 },
  assignment: { source: 'sample', evidence: ['Summer'] },
};
memory.shape.form.side.m = 5.25;
let store = restore();
assert.equal(store.loadMemories().length, 0);
assert.equal(store.saveMemory(memory), true);
store = restore(); // A new module instance models a full page refresh.
assert.deepEqual(plain(store.loadMemories()), plain([memory]), 'refresh restores the complete artifact and data-URL photo');
const edited = { ...memory, title: 'Summer revisited' };
assert.equal(store.saveMemory(edited), true);
assert.equal(store.saveMemory({ ...memory, id: 'second-memory' }), true);
store = restore();
assert.deepEqual(plain(store.loadMemories()).map(m => [m.id, m.title]), [
  ['guest-memory', 'Summer revisited'], ['second-memory', 'Summer'],
], 'same-id saves update without duplicates and retain order');
store.loadMemories().pop();
assert.equal(store.loadMemories().length, 2, 'callers cannot mutate the stored list');
const before = storage.get(key);
blocked = true;
assert.equal(store.saveMemory({ ...memory, id: 'failed-memory' }), false);
assert.equal(storage.get(key), before, 'failed writes preserve existing storage');
assert.equal(store.loadMemories().length, 2, 'failed writes never masquerade as a saved memory');
blocked = false;
for (const corrupt of ['{broken', '{}', 'null']) {
  storage.set(key, corrupt);
  assert.equal(restore().loadMemories().length, 0, 'corrupt session storage is safe');
}
storage.set(key, JSON.stringify([null, {}, { ...memory, shape: {} }, { ...memory, look: { vividness: 'bad' } }, memory]));
assert.deepEqual(plain(restore().loadMemories()), plain([memory]), 'invalid entries do not hide valid memories');
storage.clear();
assert.equal(restore().loadMemories().length, 0, 'a fresh session starts without guest memories');
console.log('Memory store checks passed: refresh, full artifact/photo, updates, session isolation, corrupt data and failed writes.');
